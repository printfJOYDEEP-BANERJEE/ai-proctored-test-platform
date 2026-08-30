// CandidateAITestScreen — Module 4: AI Test (Sandpack + Kimi Chat)
// Implements FR-6.1 through FR-6.5 (§11.6)
// Multi-file editor + Sandpack live preview + Kimi chat interface with internal copy-paste support
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
import Editor from '@monaco-editor/react';

// Default starter project templates if question doesn't have custom starter files
const DEFAULT_FILES = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Test Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <h1>Welcome to your AI Test</h1>
    <p>Use the AI chat assistant on the right to design, code, and refine your application.</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
  'style.css': `body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 24px;
  background: #f8fafc;
  color: #1e293b;
}

#app {
  max-width: 600px;
  margin: 40px auto;
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #0E7C86;
  margin-top: 0;
}`,
  'script.js': `// Your JavaScript logic here
console.log('AI Test Project Initialized');
`
};

export default function CandidateAITestScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // File management
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState('index.html');
  const [newFileName, setNewFileName] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);

  // Preview & Tab mode: 'split' | 'code' | 'preview'
  const [viewMode, setViewMode] = useState('split');
  const [previewKey, setPreviewKey] = useState(0);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const internalClipboard = useRef('');

  // Execution & Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState(new Set());
  const [disqualified, setDisqualified] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const heartbeatRef = useRef(null);
  const isSubmittingAll = useRef(false);
  const chatEndRef = useRef(null);

  // Load session from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('testSession');
    if (!stored) {
      navigate('/candidate/join');
      return;
    }
    const s = JSON.parse(stored);
    setSession(s);

    const currentQ = s.questions?.[0];
    if (currentQ?.aiTestBriefFiles && currentQ.aiTestBriefFiles.length > 0) {
      const initial = {};
      currentQ.aiTestBriefFiles.forEach(f => {
        initial[f.fileName] = f.initialContent || '';
      });
      setFiles(initial);
      setActiveFile(currentQ.aiTestBriefFiles[0].fileName);
    }
  }, [navigate]);

  const activeQuestion = session?.questions?.[activeQuestionIdx];

  // Scroll chat to bottom on update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiTyping]);

  // Timer expiry handler
  const handleTimerExpire = useCallback(async () => {
    if (isSubmittingAll.current) return;
    isSubmittingAll.current = true;
    toast('⏰ Time is up! Submitting your AI test...', { icon: '⏰' });
    try {
      if (activeQuestion) {
        await api.submitAiTest(activeQuestion._id, { filesJson: files });
      }
      await api.submitAll(session.test._id);
    } catch (_) {}
    navigate('/candidate/complete');
  }, [session, activeQuestion, files, navigate]);

  const { formatted: timerDisplay, urgency } = useTimer(
    session?.candidateEndTime,
    handleTimerExpire
  );

  // Socket join + Heartbeat every 5s
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
      emitCandidateHeartbeat({
        candidateId: user.id,
        testId: session.test._id,
        currentQuestionId: activeQuestion?._id,
        questionsCompleted: submittedQuestions.size,
      });
    }, 5000);

    return () => clearInterval(heartbeatRef.current);
  }, [session, user, activeQuestion, submittedQuestions]);

  // ── Client-Side AI Proctoring (FR-5.2, FR-5.3, FR-5.4, FR-6.1, FR-7.1, FR-7.2) ──
  // allowInternalCopyPaste: true allows candidate to copy code from Kimi Chat into Monaco files (FR-6.1)
  const proctoring = useProctoring({
    testId: session?.test?._id,
    roomId: session?.room?._id,
    candidateId: user?.id,
    enabled: Boolean(session && user && !disqualified),
    allowInternalCopyPaste: true,
  });

  // Socket proctor warnings / disqualifications
  useEffect(() => {
    const onWarning = ({ message }) => {
      setWarningMessage(message);
      toast.error(`⚠️ ${message}`, { duration: 8000 });
    };
    const onDisqualify = () => {
      setDisqualified(true);
      toast.error('🚫 You have been disqualified by the proctor.', { duration: 0 });
    };
    const onEnded = () => {
      toast('📢 Test ended. Submitting...', { icon: '📢' });
      handleTimerExpire();
    };

    onCandidateWarning(onWarning);
    onCandidateDisqualified(onDisqualify);
    onTestEnded(onEnded);

    return () => {
      offCandidateWarning(onWarning);
      offCandidateDisqualified(onDisqualify);
      offTestEnded(onEnded);
    };
  }, [handleTimerExpire]);

  // Autosave files every 30s (NFR §13 Availability)
  useAutosave(
    useCallback(async () => {
      if (!activeQuestion || !files || disqualified) return;
      try {
        setIsSaving(true);
        await api.saveFiles(activeQuestion._id, { filesJson: files });
      } catch (_) {} finally {
        setIsSaving(false);
      }
    }, [activeQuestion, files, disqualified]),
    30000,
    !!session && !disqualified
  );

  // File operations
  const handleFileChange = (newContent) => {
    setFiles((prev) => ({
      ...prev,
      [activeFile]: newContent || '',
    }));
  };

  const handleAddFile = (e) => {
    e.preventDefault();
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    if (files[trimmed]) {
      toast.error('File already exists');
      return;
    }
    setFiles(prev => ({ ...prev, [trimmed]: '' }));
    setActiveFile(trimmed);
    setNewFileName('');
    setShowAddFile(false);
    toast.success(`Created ${trimmed}`);
  };

  const handleDeleteFile = (fileName) => {
    if (Object.keys(files).length <= 1) {
      toast.error('Cannot delete the only file');
      return;
    }
    if (confirm(`Delete ${fileName}?`)) {
      const copy = { ...files };
      delete copy[fileName];
      setFiles(copy);
      if (activeFile === fileName) {
        setActiveFile(Object.keys(copy)[0]);
      }
    }
  };

  // ── FR-6.1 & FR-6.2: Send chat message to Kimi ───────────────────────────────
  const handleSendChat = async (e) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || isAiTyping || !activeQuestion) return;

    const userEntry = { role: 'candidate', message: msg, timestamp: new Date().toISOString() };
    setChatMessages((prev) => [...prev, userEntry]);
    setChatInput('');
    setIsAiTyping(true);

    try {
      const { data } = await api.aiChat(activeQuestion._id, { message: msg });
      const aiEntry = { role: 'ai', message: data.reply, timestamp: new Date().toISOString() };
      setChatMessages((prev) => [...prev, aiEntry]);
    } catch (err) {
      toast.error('AI assistant error: ' + (err.response?.data?.error || err.message));
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', message: '⚠️ Error communicating with AI assistant. Please try again.', timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Copy AI response to internal clipboard (User decision: allow within-interface copy paste)
  const handleCopyFromChat = (text) => {
    internalClipboard.current = text;
    // Also copy to standard clipboard for user convenience
    navigator.clipboard?.writeText(text).catch(() => {});
    toast.success('Copied to editor clipboard! You can paste into your code files.');
  };

  // Submit AI Test question
  const handleSubmitQuestion = async () => {
    if (!activeQuestion || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.submitAiTest(activeQuestion._id, {
        filesJson: files,
        promptLog: chatMessages,
      });
      setSubmittedQuestions(prev => new Set([...prev, activeQuestion._id]));
      toast.success(`Q${activeQuestionIdx + 1} submitted successfully!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit all
  const handleSubmitAll = async () => {
    if (!confirm('Submit all questions and finalize your AI test?')) return;
    isSubmittingAll.current = true;
    try {
      if (activeQuestion) {
        await api.submitAiTest(activeQuestion._id, { filesJson: files, promptLog: chatMessages });
      }
      await api.submitAll(session.test._id);
      navigate('/candidate/complete');
    } catch (err) {
      toast.error('Submit all failed');
      isSubmittingAll.current = false;
    }
  };

  // Generate safe HTML bundle for live iframe preview (FR-6.3)
  const generatePreviewSrcDoc = () => {
    const html = files['index.html'] || files['index.htm'] || '<h1>No index.html found</h1>';
    const css = files['style.css'] || files['styles.css'] || files['app.css'] || '';
    const js = files['script.js'] || files['app.js'] || files['index.js'] || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${css}</style>
        </head>
        <body>
          ${html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '').replace(/<script[^>]*src=["'][^"']*["'][^>]*><\/script>/gi, '')}
          <script>
            try {
              ${js}
            } catch (err) {
              console.error('Preview runtime error:', err);
            }
          </script>
        </body>
      </html>
    `;
  };

  // Determine language for Monaco editor
  const getMonacoLanguage = (fileName) => {
    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner spinner-dark" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

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
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>
      {/* ── Top Timer Bar ──────────────────────────────────────────────────── */}
      <div className="timer-bar" style={{ zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
            🤖 {session.test.title} (AI Test)
          </span>
          <span className="badge badge-teal">{session.room.roomName}</span>
          {isSaving && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>💾 Saving...</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Time Remaining</span>
          <span className={`timer-countdown ${urgency}`} aria-live="polite">
            {timerDisplay}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            id="ai-submit-question-btn"
            className="btn btn-primary btn-sm"
            onClick={handleSubmitQuestion}
            disabled={isSubmitting || submittedQuestions.has(activeQuestion?._id)}
          >
            {isSubmitting ? 'Submitting...' : submittedQuestions.has(activeQuestion?._id) ? '✓ Submitted' : 'Submit Project'}
          </button>
          <button
            id="ai-submit-all-btn"
            className="btn btn-danger btn-sm"
            onClick={handleSubmitAll}
          >
            Submit All &amp; Finish
          </button>
        </div>
      </div>

      {/* Warning banner if active */}
      {warningMessage && (
        <div style={{ background: '#E74C3C', color: 'white', padding: '6px 20px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>
          ⚠️ {warningMessage}
          <button onClick={() => setWarningMessage('')} style={{ background: 'none', border: 'none', color: 'white', marginLeft: 12, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Main Workspace: 3-column Layout ──────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 380px', overflow: 'hidden' }}>

        {/* ── Left Column: Question Brief & Instructions ─────────────────────── */}
        <div style={{ background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', overflowY: 'auto', color: '#e2e8f0', padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <span className="badge badge-teal" style={{ marginBottom: 6 }}>AI Development Task</span>
            <h2 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 700, margin: '6px 0 10px 0' }}>
              Q{activeQuestionIdx + 1}. {activeQuestion?.title}
            </h2>
          </div>

          <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: 20 }}>
            {activeQuestion?.description}
          </div>

          <div style={{ background: '#0f172a', padding: 14, borderRadius: 8, border: '1px solid #334155', marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>
              💡 AI Test Instructions
            </div>
            <ul style={{ paddingLeft: 16, fontSize: '0.75rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Ask the AI assistant on the right for code, architecture, or bug fixes.</li>
              <li>AI code does not auto-insert: copy from chat and paste into your files.</li>
              <li>You can create HTML, CSS, and JS files to structure your project.</li>
              <li>Click the <strong>Preview</strong> tab to test your live app rendering.</li>
            </ul>
          </div>
        </div>

        {/* ── Center Column: Multi-file Editor & Live Preview ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>

          {/* Tab Toolbar: File tabs + View mode toggle */}
          <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: 44 }}>
            {/* File tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
              {Object.keys(files).map((fileName) => (
                <div
                  key={fileName}
                  onClick={() => setActiveFile(fileName)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    background: activeFile === fileName ? '#0f172a' : 'transparent',
                    color: activeFile === fileName ? '#38bdf8' : '#94a3b8',
                    borderBottom: activeFile === fileName ? '2px solid #38bdf8' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{fileName}</span>
                  {Object.keys(files).length > 1 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(fileName); }}
                      style={{ opacity: 0.6, fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      ✕
                    </span>
                  )}
                </div>
              ))}

              {showAddFile ? (
                <form onSubmit={handleAddFile} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text"
                    placeholder="filename.ext"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    autoFocus
                    style={{ background: '#0f172a', border: '1px solid #38bdf8', color: 'white', padding: '2px 6px', fontSize: '0.75rem', borderRadius: 4, width: 100 }}
                  />
                  <button type="submit" style={{ background: '#0E7C86', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>Add</button>
                  <button type="button" onClick={() => setShowAddFile(false)} style={{ background: 'none', color: '#94a3b8', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddFile(true)}
                  style={{ background: 'none', border: '1px dashed #475569', color: '#94a3b8', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  + New File
                </button>
              )}
            </div>

            {/* View Mode toggle (Split, Code Only, Preview Only) */}
            <div style={{ display: 'flex', gap: 4, background: '#0f172a', padding: 2, borderRadius: 6 }}>
              {[
                { id: 'split', label: '◫ Split' },
                { id: 'code', label: '⌨ Code' },
                { id: 'preview', label: '▶ Preview' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => { setViewMode(m.id); setPreviewKey(k => k + 1); }}
                  style={{
                    background: viewMode === m.id ? '#0E7C86' : 'transparent',
                    color: viewMode === m.id ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Area: Monaco Editor + Live Preview */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr', overflow: 'hidden' }}>

            {/* Monaco Editor Panel */}
            {(viewMode === 'split' || viewMode === 'code') && (
              <div style={{ height: '100%', borderRight: viewMode === 'split' ? '1px solid #334155' : 'none', overflow: 'hidden' }}>
                <Editor
                  height="100%"
                  language={getMonacoLanguage(activeFile)}
                  value={files[activeFile] || ''}
                  onChange={handleFileChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: '"Fira Code", monospace',
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                  }}
                />
              </div>
            )}

            {/* Live Preview Panel (FR-6.3: Client-side rendering) */}
            {(viewMode === 'split' || viewMode === 'preview') && (
              <div style={{ height: '100%', background: 'white', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>🌐 Live Output Sandbox</span>
                  <button
                    onClick={() => setPreviewKey(k => k + 1)}
                    style={{ background: 'none', border: 'none', color: '#0E7C86', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ↻ Refresh
                  </button>
                </div>
                <iframe
                  key={previewKey}
                  title="Live Preview"
                  srcDoc={generatePreviewSrcDoc()}
                  sandbox="allow-scripts allow-modals allow-same-origin"
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Kimi AI Chat Panel (FR-6.1, FR-6.2) ────────────────── */}
        <div style={{ background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#0E7C86', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              🤖
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>Kimi AI Assistant</div>
              <div style={{ color: '#2ECC71', fontSize: '0.7rem' }}>● Connected</div>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: '0.8rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
                <div>Start brainstorming with Kimi.</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  Ask for code snippets, designs, logic, or bug fixes.
                </div>
              </div>
            )}

            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === 'candidate' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: msg.role === 'candidate' ? '#0E7C86' : '#334155',
                  color: 'white',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  position: 'relative',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.7rem', color: msg.role === 'candidate' ? '#a5f3fc' : '#38bdf8', marginBottom: 4 }}>
                  {msg.role === 'candidate' ? 'You' : 'Kimi AI'}
                </div>
                <div>{msg.message}</div>
                {msg.role === 'ai' && (
                  <button
                    onClick={() => handleCopyFromChat(msg.message)}
                    style={{
                      marginTop: 8,
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#cbd5e1',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    📋 Copy Snippet
                  </button>
                )}
              </div>
            ))}

            {isAiTyping && (
              <div style={{ alignSelf: 'flex-start', background: '#334155', borderRadius: 8, padding: '8px 12px', color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spinner spinner-dark" style={{ width: 12, height: 12 }} /> Kimi is writing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendChat} style={{ padding: 12, background: '#0f172a', borderTop: '1px solid #334155', display: 'flex', gap: 8 }}>
            <input
              id="kimi-chat-input"
              type="text"
              placeholder="Ask Kimi anything..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isAiTyping}
              style={{
                flex: 1,
                background: '#1e293b',
                border: '1px solid #475569',
                color: 'white',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              id="kimi-send-btn"
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isAiTyping || !chatInput.trim()}
              style={{ padding: '8px 14px' }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* ── Corner AI Proctoring PIP Feed (FR-5.2, FR-7.1, FR-7.2) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
          background: '#1A2B3C',
          padding: 6,
          borderRadius: 8,
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          border: '1.5px solid #334155',
        }}
      >
        <div style={{ position: 'relative', width: 130, height: 98, borderRadius: 6, overflow: 'hidden', background: '#000' }}>
          <video
            ref={proctoring.videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.65)', padding: '2px 6px', borderRadius: 4, fontSize: '0.62rem', color: '#2ECC71', fontWeight: 700 }}>
            ● REC
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              right: 4,
              background:
                proctoring.faceCount === 1
                  ? 'rgba(46, 204, 113, 0.85)'
                  : proctoring.faceCount > 1
                  ? 'rgba(231, 76, 60, 0.95)'
                  : 'rgba(241, 196, 15, 0.95)',
              padding: '2px 4px',
              borderRadius: 3,
              fontSize: '0.6rem',
              color: '#fff',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {proctoring.faceCount === 1
              ? '✓ Face Detected'
              : proctoring.faceCount > 1
              ? '⚠️ Multiple Faces!'
              : '❌ No Face!'}
          </div>
        </div>
      </div>

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
