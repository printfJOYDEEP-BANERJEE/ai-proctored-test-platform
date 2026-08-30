// Malpractice Service — YOLO phone detection proxy
// Calls the Python YOLO microservice (yolo-service/) for server-side phone detection
// Configured via YOLO_SERVICE_URL env var
const fetch = require('node-fetch');
const FormData = require('form-data');

const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:8001';

/**
 * Send a webcam frame to the YOLO service for phone detection.
 * @param {Buffer} imageBuffer - Raw image buffer from candidate webcam
 * @returns {{ phoneDetected: boolean, confidence?: number }}
 */
const detectPhone = async (imageBuffer) => {
  try {
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'frame.jpg',
      contentType: 'image/jpeg',
    });

    const response = await fetch(`${YOLO_SERVICE_URL}/detect`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 10000, // 10s timeout — must complete within heartbeat interval
    });

    if (!response.ok) {
      console.error('[YOLO] Service error:', response.status);
      return { phoneDetected: false }; // fail-open: don't flag on service error
    }

    const data = await response.json();
    // YOLO service returns: { phoneDetected: boolean, confidence: float, detections: [...] }
    return {
      phoneDetected: data.phoneDetected === true,
      confidence: data.confidence,
    };
  } catch (err) {
    console.error('[YOLO] Detection failed:', err.message);
    // Fail-open: if YOLO service is unavailable, don't flag as violation
    return { phoneDetected: false };
  }
};

module.exports = { detectPhone };
