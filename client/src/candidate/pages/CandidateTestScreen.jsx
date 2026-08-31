// CandidateTestScreen — Standard Coding Test (SPOJ / JAVASCRIPT / REACT types)
// Implements FR-5.1 through FR-5.6 (§11.5)
// NFR: 60fps timer, autosave every 30s, debounced socket heartbeat
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/apiClient';
import { useTimer } from '../../hooks/useTimer';
import { useAutosave } from '../../hooks/useAutosave';
import {
  initSocket, emitCandidateJoin, emitCandidateHeartbeat,
  emitTabSwitch, emitFullscreenExit,
  onCandidateWarning, offCandidateWarning,
  onCandidateDisqualified, offCandidateDisqualified,
  onTestEnded, offTestEnded,
} from '../../services/socketClient';
import { useAuth } from '../../hooks/useAuthContext';
import { useProctoring } from '../../hooks/useProctoring';
import DraggableWebcamPip from '../../shared/DraggableWebcamPip';

// ── Monaco Editor (lazy-loaded to avoid bundle bloat) ─────────────────────────
import Editor from '@monaco-editor/react';

const LANGUAGE_MAP = {
  python: 'python', java: 'java', cpp: 'cpp', c: 'c',
  javascript: 'javascript', react: 'javascript',
};

// ── Memoized question list item (NFR: React.memo for 60fps list updates) ──────
const QuestionTab = memo(({ question, index, isActive, visiblePassed, visibleTotal, onClick }) => {
  const progress = visibleTotal > 0 ? visiblePassed / visibleTotal : 0;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 16px',
        background: isActive ? 'rgba(14, 124, 134, 0.1)' : 'transparent',
        border: 'none', borderLeft: isActive ? '3px solid #0E7C86' : '3px solid transparent',
        cursor: 'pointer', transition: 'all 200ms', fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1A2B3C' }}>
          Q{index + 1}. {question.title}
        </span>
        <span className={`badge badge-${question.difficulty === 'HARD' ? 'danger' : question.difficulty === 'MEDIUM' ? 'warning' : 'success'}`}
          style={{ fontSize: '0.65rem' }}>
          {question.difficulty || 'N/A'}
        </span>
      </div>
      {visibleTotal > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="progress-bar-container" style={{ flex: 1 }}>
            <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
            {visiblePassed}/{visibleTotal}
          </span>
        </div>
      )}
    </button>
  );
});
QuestionTab.displayName = 'QuestionTab';

// ── Test Result row (memoized) ─────────────────────────────────────────────────
const TestCaseResult = memo(({ tc, index }) => (
  <div style={{
    padding: '8px 12px', borderRadius: 6, marginBottom: 6,
    background: tc.passed ? '#d1fae5' : '#fee2e2',
    border: `1px solid ${tc.passed ? '#6ee7b7' : '#fca5a5'}`,
    fontSize: '0.8rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <strong>Test {index + 1}</strong>
      <span style={{ color: tc.passed ? '#065f46' : '#991b1b', fontWeight: 700 }}>
        {tc.passed ? '✓ Passed' : '✗ Failed'}
      </span>
    </div>
    {tc.error && <div style={{ color: '#991b1b', fontFamily: 'monospace', fontSize: '0.75rem' }}>{tc.error}</div>}
    {!tc.passed && (
      <div style={{ color: '#374151', fontFamily: 'monospace', fontSize: '0.75rem', marginTop: 4 }}>
        Expected: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 3 }}>{tc.expectedOutput}</code>
        &nbsp;Got: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 3 }}>{tc.actualOutput}</code>
      </div>
    )}
  </div>
));
TestCaseResult.displayName = 'TestCaseResult';

// ── Main Test Screen ───────────────────────────────────────────────────────────
export default function CandidateTestScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [customInput, setCustomInput] = useState('');
  const [runResults, setRunResults] = useState([]);
  const [runOutput, setRunOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState(new Set());
  const [questionProgress, setQuestionProgress] = useState({}); // { questionId: { passed, total } }
  const [disqualified, setDisqualified] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const heartbeatRef = useRef(null);
  const isSubmittingAll = useRef(false);

  // Load session from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('testSession');
    if (!stored) { navigate('/candidate/join'); return; }
    const s = JSON.parse(stored);
    setSession(s);
    setLanguage(s.test.supportedLanguages?.[0] || 'python');
  }, [navigate]);

  const activeQuestion = session?.questions?.[activeQuestionIdx];

  // ── FR-5.6: Server-side auto-submit is already handled by server timer.
  // Client-side timer expiry triggers submit-all as backup.
  const handleTimerExpire = useCallback(async () => {
    if (isSubmittingAll.current) return;
    isSubmittingAll.current = true;
    toast('⏰ Time is up! Submitting your test...', { icon: '⏰' });
    try {
      await api.submitAll(session.test._id);
    } catch (_) {}
    navigate('/candidate/complete');
  }, [session, navigate]);

  const { formatted: timerDisplay, urgency } = useTimer(
    session?.candidateEndTime,
    handleTimerExpire
  );

  // ── FR-5.1: Socket heartbeat every 5s (§12.2 loop)
  // NFR: throttled — max one emit per 5s
  useEffect(() => {
    if (!session || !user) return;
    const token = localStorage.getItem('token');
    initSocket(token);
    emitCandidateJoin({
      candidateId: user.id,
      testId: session.test._id,
      roomId: session.room._id,
    });

    heartbeatRef.current = setInterval(() => {
      // FR-5.5: questionsCompleted = sum of (visiblePassed/visibleTotal) per question, capped at 1.0
      const questionsCompleted = session.questions.reduce((sum, q) => {
        const prog = questionProgress[q._id] || { passed: 0, total: q.visibleTestCases?.length || 0 };
        return sum + Math.min(1.0, prog.total > 0 ? prog.passed / prog.total : 0);
      }, 0);

      emitCandidateHeartbeat({
        candidateId: user.id,
        testId: session.test._id,
        currentQuestionId: activeQuestion?._id,
        questionsCompleted,
      });
    }, 5000);

    return () => clearInterval(heartbeatRef.current);
  }, [session, user, activeQuestion, questionProgress]);

  // ── Client-Side AI Proctoring (FR-5.2, FR-5.3, FR-5.4, FR-7.1, FR-7.2) ────────
  const proctoring = useProctoring({
    testId: session?.test?._id,
    roomId: session?.room?._id,
    candidateId: user?.id,
    enabled: Boolean(session && user && !disqualified),
    allowInternalCopyPaste: false,
  });

  // ── Socket: candidate:warning + candidate:disqualified + test:ended ───────────
  useEffect(() => {
    const onWarning = ({ violationType, message }) => {
      setWarningMessage(message);
      toast.error(`⚠️ ${message}`, { duration: 8000 });
    };

    const onDisqualified = ({ reason }) => {
      setDisqualified(true);
      toast.error('🚫 You have been disqualified from this test.', { duration: 0 });
    };

    const onEnded = () => {
      toast('📢 Test has ended. Submitting...', { icon: '📢' });
      handleTimerExpire();
    };

    onCandidateWarning(onWarning);
    onCandidateDisqualified(onDisqualified);
    onTestEnded(onEnded);

    return () => {
      offCandidateWarning(onWarning);
      offCandidateDisqualified(onDisqualified);
      offTestEnded(onEnded);
    };
  }, [handleTimerExpire]);

  // ── FR-5.4: Copy-paste disabled in editor ─────────────────────────────────────
  // Monaco editor handles this via options; also prevent at DOM level for textarea/inputs
  const preventCopyPaste = useCallback((e) => {
    // FR-5.4: Ctrl+C, Ctrl+V, right-click all call preventDefault()
    e.preventDefault();
    toast('Copy-paste is disabled during the test.', { icon: '🚫', duration: 2000 });
  }, []);

  // ── Autosave every 30s (NFR §13 Availability) ────────────────────────────────
  useAutosave(
    useCallback(async () => {
      if (!activeQuestion || !code || disqualified) return;
      try {
        await api.saveCode(activeQuestion._id, { code, language });
      } catch (_) {}
    }, [activeQuestion, code, language, disqualified]),
    30000,
    !!session && !disqualified
  );

  // ── Run code against visible test cases ──────────────────────────────────────
  const handleRun = async () => {
    if (!activeQuestion || !code) return;
    setIsRunning(true);
    setRunResults([]);
    setRunOutput('');
    try {
      const { data } = await api.runCode(activeQuestion._id, {
        code, language,
        ...(customInput ? { customInput } : {}),
      });
      setRunOutput(data.output || '');
      setRunResults(data.visibleTestResults || []);
    } catch (err) {
      setRunOutput(err.response?.data?.error || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // ── Submit single question ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!activeQuestion || !code || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data } = await api.submitCode(activeQuestion._id, { code, language });
      const sub = data.submission;
      setSubmittedQuestions((prev) => new Set([...prev, activeQuestion._id]));
      setQuestionProgress((prev) => ({
        ...prev,
        [activeQuestion._id]: {
          passed: sub.visibleTestCasesPassed,
          total: sub.visibleTestCasesTotal,
        },
      }));
      toast.success(`Q${activeQuestionIdx + 1} submitted! ${sub.visibleTestCasesPassed}/${sub.visibleTestCasesTotal} visible cases passed.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit all ────────────────────────────────────────────────────────────────
  const handleSubmitAll = async () => {
    if (!confirm('Submit the entire test? This cannot be undone.')) return;
    isSubmittingAll.current = true;
    try {
      await api.submitAll(session.test._id);
      navigate('/candidate/complete');
    } catch (err) {
      toast.error('Submit failed');
      isSubmittingAll.current = false;
    }
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner spinner-dark" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  // ── Disqualified screen ───────────────────────────────────────────────────────
  if (disqualified) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1A2B3C', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32,
      }}>
        <div style={{ fontSize: '4rem' }}>🚫</div>
        <h1 style={{ color: 'white', fontSize: '2rem' }}>Disqualified</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 480 }}>
          You have been disqualified from this test by the proctor.
          Please contact the exam coordinator for further instructions.
        </p>
      </div>
    );
  }

  // Set starter code or saved draft when question or language changes
  useEffect(() => {
    if (!activeQuestion) {
      setCode('');
      return;
    }
    const key = `draft_${session?.test?._id}_${activeQuestion._id}_${language}`;
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      setCode(saved);
    } else {
      const defaultTemplates = {
        python: `# Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\nimport sys\n\ndef solve():\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    solve()\n`,
        javascript: `// Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\nfunction solve() {\n    // Write your solution here\n}\n`,
        cpp: `// Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\n#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
        c: `// Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\n#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
        java: `// Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n        Scanner sc = new Scanner(System.in);\n    }\n}\n`,
        react: `// Q${activeQuestionIdx + 1}: ${activeQuestion.title || 'Solution'}\nimport React from 'react';\n\nexport default function Solution() {\n    return (\n        <div>\n            {/* Write your React solution here */}\n        </div>\n    );\n}\n`,
      };
      setCode(defaultTemplates[language] || '// Write your solution here\n');
    }
  }, [activeQuestion, language, activeQuestionIdx, session?.test?._id]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Fixed Stacked Header: (a) Test name + Room/ID row, then (b) Timer + Action row ── */}
      <div className="test-screen-header">
        {/* Row (a): Test Name & Room ID Badge */}
        <div className="test-header-top-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: '#0E7C86', borderRadius: '50%', width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem'
            }}>
              🌐
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.01em' }}>
              {session.test.title}
            </span>
            <span className="badge badge-teal" style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
              {session.room.roomName || session.room.roomCode}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Candidate: <strong style={{ color: 'white' }}>{user?.name || user?.email}</strong>
            </span>
          </div>
        </div>

        {/* Row (b): Timer & Actions */}
        <div className="timer-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}>
              Progress:
            </span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
              {submittedQuestions.size}/{session.questions?.length || 0} Submitted
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600 }}>
              Time Remaining:
            </span>
            <span className={`timer-countdown ${urgency}`} aria-live="polite" aria-label="Time remaining">
              {timerDisplay}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              id="submit-all-btn"
              className="btn btn-danger btn-sm"
              onClick={handleSubmitAll}
              style={{ fontWeight: 700, padding: '6px 16px' }}
            >
              Submit All &amp; Finish
            </button>
          </div>
        </div>
      </div>

      {/* Warning banner */}
      {warningMessage && (
        <div style={{
          background: '#E74C3C', color: 'white', padding: '8px 24px',
          fontSize: '0.875rem', textAlign: 'center', fontWeight: 600,
        }}>
          ⚠️ {warningMessage}
          <button
            onClick={() => setWarningMessage('')}
            style={{ background: 'none', border: 'none', color: 'white', marginLeft: 16, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', overflow: 'hidden' }}>

        {/* ── Question List sidebar ─────────────────────────────────────────── */}
        <div style={{ borderRight: '1px solid #e5e7eb', background: 'white', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Questions
            </div>
          </div>
          {(!session.questions || session.questions.length === 0) ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
              No questions found for this test session.
            </div>
          ) : (
            session.questions.map((q, idx) => (
              <QuestionTab
                key={q._id}
                question={q}
                index={idx}
                isActive={idx === activeQuestionIdx}
                visiblePassed={questionProgress[q._id]?.passed || 0}
                visibleTotal={questionProgress[q._id]?.total || q.visibleTestCases?.length || 0}
                onClick={() => setActiveQuestionIdx(idx)}
              />
            ))
          )}
        </div>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>

          {/* Question panel */}
          <div className="test-question-panel" style={{ borderRight: '1px solid #e5e7eb' }}>
            {activeQuestion && (
              <>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2B3C' }}>
                      Q{activeQuestionIdx + 1}. {activeQuestion.title}
                    </span>
                    {submittedQuestions.has(activeQuestion._id) && (
                      <span className="badge badge-success">✓ Submitted</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {activeQuestion.difficulty && (
                      <span className={`badge badge-${activeQuestion.difficulty === 'HARD' ? 'danger' : activeQuestion.difficulty === 'MEDIUM' ? 'warning' : 'success'}`}>
                        {activeQuestion.difficulty}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ lineHeight: 1.7, color: '#374151', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                  {activeQuestion.description}
                </div>

                {activeQuestion.inputFormat && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1A2B3C', marginBottom: 4 }}>Input Format</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f8fafc', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                      {activeQuestion.inputFormat}
                    </div>
                  </div>
                )}

                {activeQuestion.outputFormat && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1A2B3C', marginBottom: 4 }}>Output Format</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f8fafc', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                      {activeQuestion.outputFormat}
                    </div>
                  </div>
                )}

                {activeQuestion.constraints && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1A2B3C', marginBottom: 4 }}>Constraints</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#fff3cd', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                      {activeQuestion.constraints}
                    </div>
                  </div>
                )}

                {/* Visible test cases (FR-4.2: shown to candidate) */}
                {activeQuestion.visibleTestCases?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1A2B3C', marginBottom: 8 }}>
                      Sample Test Cases
                    </div>
                    {activeQuestion.visibleTestCases.map((tc, i) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 6, padding: 10, marginBottom: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>
                          Example {i + 1}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          <div><strong>Input:</strong> {tc.input}</div>
                          <div><strong>Output:</strong> {tc.expectedOutput}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Editor + Output panel ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#1e1e2e', overflow: 'hidden' }}>

            {/* Editor toolbar */}
            <div className="editor-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    background: '#2d2d44', color: 'white', border: '1px solid #444',
                    borderRadius: 6, padding: '4px 10px', fontSize: '0.85rem',
                    fontFamily: 'monospace', cursor: 'pointer',
                  }}
                >
                  {(session.test.supportedLanguages || ['python']).map((lang) => (
                    <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  id="run-code-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRun}
                  disabled={isRunning || !code}
                  style={{ background: '#2d2d44', color: '#cdd6f4', border: '1px solid #444' }}
                >
                  {isRunning ? <><span className="spinner" style={{ borderTopColor: '#cdd6f4', width: 14, height: 14 }} /> Running...</> : '▶ Run'}
                </button>
                <button
                  id="submit-question-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !code || submittedQuestions.has(activeQuestion?._id)}
                >
                  {isSubmitting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting...</>
                    : submittedQuestions.has(activeQuestion?._id) ? '✓ Submitted'
                    : 'Submit Question'}
                </button>
              </div>
            </div>

            {/* Monaco Editor — FR-5.4: copy-paste disabled */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={LANGUAGE_MAP[language] || 'python'}
                value={code}
                onChange={(val) => setCode(val || '')}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                  fontLigatures: true,
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  // FR-5.4: Disable copy-paste in editor
                  readOnly: false,
                  copyWithSyntaxHighlighting: false,
                  // Prevent paste from outside by catching events
                  contextmenu: false, // FR-5.4: disable right-click context menu
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
                onMount={(editor) => {
                  // FR-5.4: Intercept Ctrl+C / Ctrl+V at the Monaco level
                  editor.addCommand(
                    // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyC
                    2048 | 33,
                    () => toast('Copy is disabled during the test.', { icon: '🚫', duration: 1500 })
                  );
                  editor.addCommand(
                    // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyV
                    2048 | 52,
                    () => toast('Paste is disabled during the test.', { icon: '🚫', duration: 1500 })
                  );
                }}
              />
            </div>

            {/* Custom input + output panel */}
            <div style={{ height: 200, borderTop: '1px solid #333', display: 'flex', background: '#1e1e2e' }}>
              {/* Custom input */}
              <div style={{ flex: 1, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '6px 12px', background: '#2d2d44', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>
                  Custom Input (optional)
                </div>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onCopy={preventCopyPaste}
                  onPaste={preventCopyPaste}
                  onContextMenu={preventCopyPaste}
                  placeholder="Enter custom input here..."
                  style={{
                    flex: 1, resize: 'none', background: '#1e1e2e', color: '#cdd6f4',
                    border: 'none', padding: 12, fontFamily: 'monospace', fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Output */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '6px 12px', background: '#2d2d44', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>
                  Output
                </div>
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  {runOutput && (
                    <pre style={{ color: '#a6e3a1', fontFamily: 'monospace', fontSize: '0.8rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {runOutput}
                    </pre>
                  )}
                  {runResults.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {runResults.map((r, i) => (
                        <TestCaseResult key={i} tc={r} index={i} />
                      ))}
                    </div>
                  )}
                  {!runOutput && runResults.length === 0 && (
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Click "▶ Run" to execute your code against test cases.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Movable AI Proctoring PIP Feed (FR-5.2, FR-7.1, FR-7.2) ── */}
      <DraggableWebcamPip videoRef={proctoring.videoRef} faceCount={proctoring.faceCount} />

      {/* ── Fullscreen Enforcement Lock Overlay (FR-5.2, FR-5.3) ── */}
      {!proctoring.isFullscreen && !disqualified && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.96)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: '#fff', fontSize: '1.6rem', marginBottom: 8, fontWeight: 800 }}>
            Fullscreen Mode Required
          </h2>
          <p style={{ color: '#94a3b8', maxWidth: 480, textAlign: 'center', marginBottom: 24, lineHeight: 1.6, fontSize: '0.9rem' }}>
            You have exited full-screen mode. This proctored assessment strictly requires fullscreen operation throughout the entire session (FR-5.2). Exiting has been logged.
          </p>
          <button
            onClick={proctoring.requestFullscreen}
            className="btn btn-primary btn-lg"
            style={{ fontSize: '1rem', padding: '12px 28px' }}
          >
            ⛶ Re-enter Fullscreen Mode
          </button>
        </div>
      )}
    </div>
  );
}
