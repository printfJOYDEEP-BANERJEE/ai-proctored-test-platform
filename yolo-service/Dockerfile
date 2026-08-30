FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Pillow/NumPy/OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU directly to avoid multi-gigabyte CUDA bloat and timeouts
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download YOLOv8n model checkpoint
RUN mkdir -p /app/model
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" && \
    mv yolov8n.pt /app/model/yolov8n.pt || \
    echo "Model will be downloaded on first run"

EXPOSE 8001

CMD ["python", "app.py"]
