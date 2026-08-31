"""
YOLO Phone Detection Microservice
FastAPI wrapper around YOLOv8n for server-side phone detection (Section 2.1, §15)
Runs as a separate Docker container, called from Node backend.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from contextlib import asynccontextmanager
import uvicorn
import io
import os
from PIL import Image
import numpy as np

# Load YOLOv8n model on startup
model = None
PHONE_CLASS_ID = 67  # COCO dataset class ID for 'cell phone'
CONFIDENCE_THRESHOLD = 0.45  # Minimum confidence to flag as phone detected


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    try:
        import torch  # type: ignore
        # PyTorch 2.6 compatibility: allow loading trusted ultralytics checkpoint
        _orig_torch_load = torch.load

        def safe_load(*args, **kwargs):
            kwargs["weights_only"] = False
            return _orig_torch_load(*args, **kwargs)

        torch.load = safe_load

        from ultralytics import YOLO  # type: ignore

        model_path = os.path.join(os.path.dirname(__file__), "model", "yolov8n.pt")
        if not os.path.exists(model_path):
            model_path = "yolov8n.pt"
        model = YOLO(model_path)
        print(f"[YOLO] Model loaded successfully: {model_path}")
    except Exception as e:
        print(f"[YOLO] WARNING: Model failed to load: {e}")
        print("[YOLO] Service will return phoneDetected=false for all frames.")

    yield


app = FastAPI(
    title="YOLO Phone Detection Service",
    version="1.0",
    lifespan=lifespan,
)

# Allow requests from the Node.js backend and browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


def _run_inference_sync(image_bytes: bytes):
    """
    Synchronous CPU-bound inference helper executed inside FastAPI thread pool.
    Prevents blocking the async event loop during high candidate concurrency.
    """
    if model is None:
        return {"phoneDetected": False, "confidence": 0.0, "detections": []}

    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
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

        return {
            "phoneDetected": len(phone_detections) > 0,
            "confidence": max_confidence,
            "detections": phone_detections,
        }
    except Exception as e:
        print(f"[YOLO] Inference error: {e}")
        return {"phoneDetected": False, "confidence": 0.0, "detections": []}


@app.post("/detect")
async def detect_phone(image: UploadFile = File(...)):
    """
    Receive a webcam frame and detect whether a phone is present.
    Offloads CPU inference to worker thread pool for high concurrency (FR-7.2).
    Returns: { phoneDetected: bool, confidence: float, detections: list }
    """
    try:
        image_bytes = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image upload: {str(e)}")

    # Offload CPU inference to worker thread pool
    result = await run_in_threadpool(_run_inference_sync, image_bytes)
    return result


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
