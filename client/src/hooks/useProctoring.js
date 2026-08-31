// useProctoring.js — Client-Side AI Proctoring Hook using MediaPipe FaceDetector
// Implements PRD Section 2.1, Section 9.8, Section 10, Section 11.5 (FR-5.2-5.4), Section 11.7 (FR-7.1, FR-7.2), Section 15 (MediaPipe FaceDetector)
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import api from '../services/apiClient';
import { emitTabSwitch, emitFullscreenExit } from '../services/socketClient';

/**
 * Custom hook for full client-side proctoring:
 * 1. Mandatory webcam + mic stream management (FR-5.2)
 * 2. Official MediaPipe FaceDetector task for continuous face presence & multi-face counting (FR-7.1, Section 15)
 * 3. Periodic YOLO phone detection frame upload every 7.5s (FR-7.2)
 * 4. Fullscreen lock & exit detection (FR-5.2, FR-5.3)
 * 5. Tab switch / blur detection (FR-5.3)
 * 6. Copy-paste / right-click prevention (FR-5.4)
 */
export function useProctoring({
  testId,
  roomId,
  candidateId,
  enabled = true,
  allowInternalCopyPaste = false, // true only for AI Test internal chat-to-editor (FR-6.1)
  onWarning,
  onDisqualified,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);

  // Statuses
  const [hasWebcam, setHasWebcam] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [faceCount, setFaceCount] = useState(1);
  const [proctoringActive, setProctoringActive] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);

  // Absence Tracking for NO_FACE_15MIN (PRD FR-7.1)
  const noFaceStartTimeRef = useRef(null);
  const noFaceReportedRef = useRef(false);

  // Debounce refs for violations (prevent spamming API within 10s per violation type)
  const lastViolationTimeRef = useRef({});

  // ── Helper: Capture Real-time Proof Screenshot for any Violation ──────────────
  const captureViolationProof = useCallback((violationType) => {
    try {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const vw = videoRef.current.videoWidth || 640;
        const vh = videoRef.current.videoHeight || 480;

        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');

        // 1. Draw live webcam frame
        ctx.drawImage(videoRef.current, 0, 0, vw, vh);

        // 2. Overlay proctoring violation watermark header
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(0, 0, vw, 40);

        // Violation badge indicator
        ctx.fillStyle = violationType === 'PHONE_DETECTED' || violationType === 'MULTIPLE_FACES' ? '#EF4444' : '#F59E0B';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`⚠️ PROCTORING EVIDENCE: ${violationType.replace(/_/g, ' ')}`, 14, 25);

        // Timestamp & metadata footer
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(0, vh - 26, vw, 26);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '11px monospace';
        ctx.fillText(`Time: ${new Date().toLocaleTimeString()} · ${new Date().toLocaleDateString()}`, 14, vh - 9);

        return canvas.toDataURL('image/jpeg', 0.85);
      }

      // Fallback: create high-visibility violation banner snapshot
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`⚠️ PROCTORING VIOLATION: ${violationType.replace(/_/g, ' ')}`, 30, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px monospace';
      ctx.fillText(`Detected At: ${new Date().toLocaleString()}`, 30, 130);
      ctx.fillText(`Candidate ID: ${candidateId}`, 30, 160);
      ctx.fillText(`Test ID: ${testId} | Room: ${roomId}`, 30, 190);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.error('Failed to capture violation proof:', e);
      return null;
    }
  }, [candidateId, testId, roomId]);

  // ── Helper: Report Violation with Debounce ──────────────────────────────────
  const reportViolation = useCallback(async (violationType, screenshotBase64) => {
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[violationType] || 0;
    if (now - lastTime < 5000) {
      // Throttle violation reports to at most once per 5s per type
      return;
    }
    lastViolationTimeRef.current[violationType] = now;

    // Capture real-time proof frame if none explicitly provided
    const proof = screenshotBase64 || captureViolationProof(violationType);

    console.warn(`[Proctoring] Reporting violation: ${violationType} with proof screenshot`);
    try {
      await api.reportViolation({
        candidateId,
        testId,
        roomId,
        violationType,
        screenshotBase64: proof,
      });
    } catch (err) {
      console.error(`[Proctoring] Failed to report ${violationType}:`, err);
    }
  }, [candidateId, testId, roomId, captureViolationProof]);

  // ── 1. Mandatory Media Stream Initialization (FR-5.2) ───────────────────────
  const initMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      streamRef.current = stream;
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setHasWebcam(videoTracks.length > 0 && videoTracks[0].enabled);
      setHasMic(audioTracks.length > 0 && audioTracks[0].enabled);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setIsMediaReady(true);
      return stream;
    } catch (err) {
      console.error('[Proctoring] Media permission error:', err);
      setHasWebcam(false);
      setHasMic(false);
      setIsMediaReady(false);
      toast.error('Webcam and Microphone permissions are required to take this assessment.');
      return null;
    }
  }, []);

  // ── 2. Official MediaPipe FaceDetector Task Initialization (PRD §15) ────────
  // Uses MediaPipe BlazeFace short-range vision model for in-browser face count detection
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        if (!isMounted) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });

        if (isMounted) {
          faceDetectorRef.current = detector;
          setDetectorReady(true);
          console.log('[Proctoring] MediaPipe FaceDetector initialized successfully');
        }
      } catch (err) {
        console.warn('[Proctoring] MediaPipe GPU delegate fallback to CPU:', err.message);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
          if (!isMounted) return;
          const detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5,
          });
          if (isMounted) {
            faceDetectorRef.current = detector;
            setDetectorReady(true);
          }
        } catch (fallbackErr) {
          console.error('[Proctoring] MediaPipe FaceDetector initialization failed:', fallbackErr);
        }
      }
    };

    setupMediaPipe();

    return () => {
      isMounted = false;
      if (faceDetectorRef.current) {
        faceDetectorRef.current.close();
        faceDetectorRef.current = null;
      }
    };
  }, [enabled]);

  // ── Continuous In-Browser MediaPipe Face Detection Loop (FR-7.1, PRD §2.1) ──
  useEffect(() => {
    if (!enabled || !isMediaReady || !detectorReady) return;

    let isCancelled = false;
    let detectionInterval = null;

    detectionInterval = setInterval(() => {
      if (
        isCancelled ||
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        !faceDetectorRef.current
      ) {
        return;
      }

      try {
        const startTimeMs = performance.now();
        // MediaPipe FaceDetector task detectForVideo
        const result = faceDetectorRef.current.detectForVideo(videoRef.current, startTimeMs);
        const detections = result.detections || [];
        const detectedFaces = detections.length;

        setFaceCount(detectedFaces);

        // FR-7.1: Multiple faces detected violation
        if (detectedFaces > 1) {
          const proof = captureWebcamScreenshot();
          reportViolation('MULTIPLE_FACES', proof);
          toast.error('⚠️ Multiple faces detected! Only the candidate is permitted in frame.');
        }

        // FR-7.1 & Point 7: No face detected — 15 minute continuous absence tracking
        if (detectedFaces === 0) {
          if (!noFaceStartTimeRef.current) {
            noFaceStartTimeRef.current = Date.now();
          } else {
            const absenceDuration = Date.now() - noFaceStartTimeRef.current;
            // 15 minutes = 15 * 60 * 1000 = 900,000 ms
            if (absenceDuration >= 15 * 60 * 1000 && !noFaceReportedRef.current) {
              noFaceReportedRef.current = true;
              const proof = captureWebcamScreenshot();
              reportViolation('NO_FACE_15MIN', proof);
              toast.error('⚠️ Absence violation: No face detected for over 15 minutes.');
            }
          }
        } else {
          // Reset absence tracking when face is detected
          noFaceStartTimeRef.current = null;
          noFaceReportedRef.current = false;
        }
      } catch (err) {
        console.debug('[Proctoring] Face detection frame error:', err.message);
      }
    }, 1000); // 1s loop running client-side on GPU/WASM

    return () => {
      isCancelled = true;
      if (detectionInterval) clearInterval(detectionInterval);
    };
  }, [enabled, isMediaReady, detectorReady, captureWebcamScreenshot, reportViolation]);

  // ── 3. Periodic YOLO Phone Detection Frame Upload (FR-7.2) ───────────────────
  // Sent every 7.5s (in the 5-10s range) as throttled multipart/form-data
  useEffect(() => {
    if (!enabled || !isMediaReady || !testId) return;

    const frameInterval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const formData = new FormData();
          formData.append('image', blob, 'webcam_frame.jpg');

          // Send to POST /api/v1/proctoring/:testId/frame
          api.submitFrame(testId, formData).catch((err) => {
            console.debug('[Proctoring] Periodic frame submit result:', err.message);
          });
        }, 'image/jpeg', 0.75);
      } catch (err) {
        console.error('[Proctoring] Frame capture error:', err);
      }
    }, 7500); // 7.5s interval (PRD FR-7.2: every 5-10s)

    return () => clearInterval(frameInterval);
  }, [enabled, isMediaReady, testId]);

  // ── 4. Fullscreen Enforcement & Exit Detection (FR-5.2, FR-5.3) ─────────────
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(inFullscreen);

      if (!inFullscreen) {
        emitFullscreenExit({ candidateId, testId, roomId });
        const proof = captureViolationProof('FULLSCREEN_EXIT');
        reportViolation('FULLSCREEN_EXIT', proof);
        toast.error('⚠️ Fullscreen exited! You must remain in full-screen mode.', { duration: 4000 });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [enabled, candidateId, testId, roomId, captureViolationProof, reportViolation]);

  // ── 5. Tab Switch / Window Blur Detection (FR-5.3) ───────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        emitTabSwitch({ candidateId, testId, roomId });
        const proof = captureViolationProof('TAB_SWITCH');
        reportViolation('TAB_SWITCH', proof);
        toast.error('⚠️ Tab switch detected! Switching tabs is strictly prohibited.', { duration: 4000 });
      }
    };

    const handleWindowBlur = () => {
      emitTabSwitch({ candidateId, testId, roomId });
      const proof = captureViolationProof('TAB_SWITCH');
      reportViolation('TAB_SWITCH', proof);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [enabled, candidateId, testId, roomId, captureViolationProof, reportViolation]);

  // ── 6. Copy-Paste / Right-Click Blocking (FR-5.4) ───────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = (e) => {
      if (!allowInternalCopyPaste) {
        e.preventDefault();
        toast.error('Copying is disabled during the assessment (FR-5.4).');
      }
    };

    const handlePaste = (e) => {
      if (!allowInternalCopyPaste) {
        e.preventDefault();
        toast.error('Pasting is disabled during the assessment (FR-5.4).');
      }
    };

    const handleCut = (e) => {
      if (!allowInternalCopyPaste) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault(); // Disable right-click context menu
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, allowInternalCopyPaste]);

  // Enter Fullscreen Helper
  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  // Auto-init media stream on mount
  useEffect(() => {
    initMediaStream().then(() => {
      setProctoringActive(true);
    });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [initMediaStream]);

  return {
    videoRef,
    streamRef,
    hasWebcam,
    hasMic,
    isMediaReady,
    isFullscreen,
    faceCount,
    detectorReady,
    proctoringActive,
    requestFullscreen,
    initMediaStream,
    captureWebcamScreenshot,
    captureScreenSnapshot,
  };
}

export default useProctoring;
