// CandidateInstructions — show test.instructions before start-attempt
// Also requests webcam permission and enters fullscreen (FR-5.2)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';
import toast from 'react-hot-toast';

export default function CandidateInstructions() {
  const navigate = useNavigate();
  const [joinData, setJoinData] = useState(null);
  const [webcamGranted, setWebcamGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('joinData');
    if (!stored) {
      navigate('/candidate/join');
      return;
    }
    setJoinData(JSON.parse(stored));
  }, [navigate]);

  const requestWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setWebcamGranted(true);
      toast.success('Webcam access granted!');
    } catch (err) {
      setError('Webcam access is required to take this test. Please grant permission and try again.');
    }
  };

  const handleStartTest = async () => {
    if (!webcamGranted) {
      setError('Please grant webcam access before starting.');
      return;
    }

    setLoading(true);
    try {
      // FR-5.2: Enter fullscreen before starting
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }

      // POST /tests/:testId/start-attempt (§9.5)
      const { data } = await api.startAttempt(joinData.test._id, { roomId: joinData.room._id });

      // Store session data for the test screen
      sessionStorage.setItem('testSession', JSON.stringify({
        test: joinData.test,
        room: joinData.room,
        questions: data.questions,
        candidateStartTime: data.candidateStartTime,
        candidateEndTime: data.candidateEndTime,
        submissionSessionId: data.submissionSessionId,
        webcamStream: null, // stream passed via ref context if needed
      }));

      // Stop preview stream (proctoring module will manage the actual stream)
      // The stream stays active for proctoring — don't stop it here

      // Navigate based on test type
      if (joinData.test.testType === 'AI_TEST') {
        navigate('/candidate/ai-test');
      } else {
        navigate('/candidate/test');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start test');
      // Exit fullscreen on error
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!joinData) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FA', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#1A2B3C', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#0E7C86', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🌐</div>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>Globussoft Technology</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>Technology Ahead of Time</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 32, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <span className="badge badge-teal" style={{ marginBottom: 8 }}>{joinData.test.testType}</span>
          <h1 style={{ fontSize: '1.8rem', color: '#1A2B3C', marginBottom: 8 }}>{joinData.test.title}</h1>
          <div style={{ display: 'flex', gap: 24, color: '#6b7280', fontSize: '0.875rem' }}>
            <span>⏱️ Duration: <strong>{joinData.test.durationMinutes} minutes</strong></span>
            <span>📋 Questions: <strong>{joinData.test.totalQuestions}</strong></span>
            <span>🏠 Room: <strong>{joinData.room.roomName}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          {/* Instructions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📋 Test Instructions</h2>
            </div>
            <div
              style={{ lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: joinData.instructions }}
            />

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A2B3C', marginBottom: 12 }}>
                ⚠️ Important Rules
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Stay in fullscreen mode throughout the test. Exiting fullscreen will be flagged.',
                  'Do not switch tabs or minimize the browser window. This will be flagged.',
                  'Do not use your mobile phone. Phone detection is active.',
                  'Copy-paste from external sources is disabled in the code editor.',
                  'Your webcam must be visible and unobstructed at all times.',
                  'The test will auto-submit when time expires.',
                ].map((rule, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: '0.875rem', color: '#374151' }}>
                    <span style={{ color: '#E74C3C', flexShrink: 0 }}>✗</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Webcam + Start panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📸 Webcam Check</h3>
              </div>
              <div style={{
                width: '100%',
                aspectRatio: '4/3',
                background: '#1A2B3C',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {webcamGranted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: '0.8rem' }}>Camera not started</div>
                  </div>
                )}
                {webcamGranted && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: '#2ECC71', borderRadius: 4, padding: '2px 8px',
                    fontSize: '0.7rem', fontWeight: 700, color: 'white',
                  }}>
                    ● LIVE
                  </div>
                )}
              </div>

              {!webcamGranted ? (
                <button
                  id="grant-webcam-btn"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={requestWebcam}
                >
                  📷 Grant Camera Access
                </button>
              ) : (
                <div className="alert alert-success" style={{ margin: 0 }}>
                  ✅ Camera active — you're ready!
                </div>
              )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card" style={{ background: '#1A2B3C', borderColor: '#1A2B3C' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: 12 }}>
                By clicking Start, you agree to be monitored via webcam. The test will enter fullscreen mode.
              </div>
              <button
                id="start-test-btn"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleStartTest}
                disabled={loading || !webcamGranted}
              >
                {loading
                  ? <><span className="spinner" /> Starting test...</>
                  : '🚀 Start Test — Enter Fullscreen'}
              </button>
              {!webcamGranted && (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textAlign: 'center', marginTop: 8 }}>
                  Grant webcam access first
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
