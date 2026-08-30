// CandidateInstructions — show test.instructions before start-attempt
// Explicitly requests and verifies mandatory Webcam AND Microphone permissions before starting (FR-5.2)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';
import toast from 'react-hot-toast';

export default function CandidateInstructions() {
  const navigate = useNavigate();
  const [joinData, setJoinData] = useState(null);
  const [webcamGranted, setWebcamGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
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

  // FR-5.2: Mandatory Webcam + Mic permission check
  const requestMediaPermissions = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      streamRef.current = stream;
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      const hasVideo = videoTracks.length > 0 && videoTracks[0].enabled;
      const hasAudio = audioTracks.length > 0 && audioTracks[0].enabled;

      setWebcamGranted(hasVideo);
      setMicGranted(hasAudio);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (hasVideo && hasAudio) {
        toast.success('Webcam and Microphone access verified!');
      } else {
        setError('Both camera and microphone access are required.');
      }
    } catch (err) {
      setWebcamGranted(false);
      setMicGranted(false);
      setError('Camera and Microphone access are mandatory to take this proctored test. Please grant permissions in your browser and try again.');
    }
  };

  const handleStartTest = async () => {
    // Strict requirement 1: Block start action until both permissions are granted
    if (!webcamGranted || !micGranted) {
      setError('Both camera and microphone permissions must be granted before starting the test (FR-5.2).');
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
      }));

      // Navigate based on test type
      if (joinData.test.testType === 'AI_TEST') {
        navigate('/candidate/ai-test');
      } else {
        navigate('/candidate/test');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start test attempt');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  if (!joinData) return null;

  const isPermissionsComplete = webcamGranted && micGranted;

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
              style={{ lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}
              dangerouslySetInnerHTML={{ __html: joinData.instructions }}
            />

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A2B3C', marginBottom: 12 }}>
                ⚠️ Mandatory Proctoring Rules
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Stay in fullscreen mode throughout the test. Exiting fullscreen will be logged as a violation.',
                  'Do not switch tabs or minimize the browser window. Tab switches are logged with proof.',
                  'Do not use your mobile phone. Automated AI phone detection is active.',
                  'Copy-paste and context menus are disabled.',
                  'Your webcam and microphone must remain active and unobstructed at all times.',
                  'The test will automatically submit when your countdown timer expires.',
                ].map((rule, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: '0.85rem', color: '#374151' }}>
                    <span style={{ color: '#E74C3C', flexShrink: 0 }}>✗</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Media Permission Verification & Start Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📸 Device Permissions (FR-5.2)</h3>
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
                    <div style={{ fontSize: '0.8rem' }}>Webcam &amp; Mic Not Connected</div>
                  </div>
                )}
                {webcamGranted && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: '#2ECC71', borderRadius: 4, padding: '2px 8px',
                    fontSize: '0.7rem', fontWeight: 700, color: 'white',
                  }}>
                    ● LIVE PREVIEW
                  </div>
                )}
              </div>

              {/* Status Indicators for Webcam & Mic */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#4b5563' }}>Webcam:</span>
                  <span style={{ fontWeight: 600, color: webcamGranted ? '#2ECC71' : '#E74C3C' }}>
                    {webcamGranted ? '✅ Granted' : '❌ Not Granted'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#4b5563' }}>Microphone:</span>
                  <span style={{ fontWeight: 600, color: micGranted ? '#2ECC71' : '#E74C3C' }}>
                    {micGranted ? '✅ Granted' : '❌ Not Granted'}
                  </span>
                </div>
              </div>

              {!isPermissionsComplete ? (
                <button
                  id="grant-media-btn"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={requestMediaPermissions}
                >
                  📷 Grant Camera &amp; Mic Access
                </button>
              ) : (
                <div className="alert alert-success" style={{ margin: 0, fontSize: '0.8rem' }}>
                  ✅ Devices verified — ready to begin!
                </div>
              )}
            </div>

            {error && <div className="alert alert-danger" style={{ fontSize: '0.8rem' }}>{error}</div>}

            <div className="card" style={{ background: '#1A2B3C', borderColor: '#1A2B3C' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: 12 }}>
                Clicking Start will initiate your timer and lock the browser in full-screen mode.
              </div>
              <button
                id="start-test-btn"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleStartTest}
                disabled={loading || !isPermissionsComplete}
              >
                {loading
                  ? <><span className="spinner" /> Starting test...</>
                  : '🚀 Start Test — Enter Fullscreen'}
              </button>
              {!isPermissionsComplete && (
                <p style={{ color: '#f87171', fontSize: '0.75rem', textAlign: 'center', marginTop: 8 }}>
                  🔒 Camera &amp; Mic access must be granted to start
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
