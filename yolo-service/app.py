"""
YOLO Phone Detection Microservice
FastAPI wrapper around YOLOv8n for server-side phone detection (Section 2.1, §15)
Runs as a separate Docker container, called from Node backend.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import os
from PIL import Image
import numpy as np

app = FastAPI(title="YOLO Phone Detection Service", version="1.0")

# Allow requests from the Node.js backend only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to backend URL in production
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Load YOLOv8n model on startup
# Uses COCO-pretrained checkpoint filtered to 'cell phone' class (class_id=67 in COCO)
# Section 15: pip install ultralytics; use pre-trained yolov8n.pt
model = None
PHONE_CLASS_ID = 67  # COCO dataset class ID for 'cell phone'
CONFIDENCE_THRESHOLD = 0.45  # Minimum confidence to flag as phone detected

@app.on_event("startup")
async def load_model():
    global model
    try:
        import torch
        # PyTorch 2.6 compatibility: allow loading trusted ultralytics checkpoint
        _orig_torch_load = torch.load
        def safe_load(*args, **kwargs):
            kwargs['weights_only'] = False
            return _orig_torch_load(*args, **kwargs)
        torch.load = safe_load

        from ultralytics import YOLO
        model_path = os.path.join(os.path.dirname(__file__), "model", "yolov8n.pt")
        if not os.path.exists(model_path):
            model_path = "yolov8n.pt"
        model = YOLO(model_path)
        print(f"[YOLO] Model loaded successfully: {model_path}")
    except Exception as e:
        print(f"[YOLO] WARNING: Model failed to load: {e}")
        print("[YOLO] Service will return phoneDetected=false for all frames.")

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/detect")
async def detect_phone(image: UploadFile = File(...)):
    """
    Receive a webcam frame and detect whether a phone is present.
    Returns: { phoneDetected: bool, confidence: float, detections: list }
    """
    # Read image
    try:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    if model is None:
        # Model not loaded — return safe default (fail-open)
        return {"phoneDetected": False, "confidence": 0.0, "detections": []}

    try:
        img_array = np.array(pil_image)
        results = model(img_array, verbose=False)

        phone_detections = []
        max_confidence = 0.0

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                if class_id == PHONE_CLASS_ID and confidence >= CONFIDENCE_THRESHOLD:
                    phone_detections.append({
                        "class_id": class_id,
                        "confidence": confidence,
                        "bbox": box.xyxy[0].tolist(),
                    })
                    max_confidence = max(max_confidence, confidence)

        phone_detected = len(phone_detections) > 0

        return {
            "phoneDetected": phone_detected,
            "confidence": max_confidence,
            "detections": phone_detections,
        }
    except Exception as e:
        print(f"[YOLO] Inference error: {e}")
        return {"phoneDetected": False, "confidence": 0.0, "detections": []}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
