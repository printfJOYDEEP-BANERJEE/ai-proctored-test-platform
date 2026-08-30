# Globussoft AI Proctored Online Assessment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v6-purple.svg)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6%2B-forestgreen.svg)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4-black.svg)](https://socket.io/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks--Vision-orange.svg)](https://developers.google.com/mediapipe)

Enterprise-grade AI-proctored online testing platform designed for high-concurrency recruitment assessments, supporting SPOJ-style algorithm challenges, React/JS tests, and fullstack AI application challenges. Built for **Globussoft Technology** (*"Technology Ahead of Time"*).

---

## 🏛 System Architecture

The platform follows a decoupled, microservices-oriented architecture:

```
                      ┌───────────────────────────────────────────────┐
                      │          React 19 Frontend (Vite)             │
                      │  • Monaco Multi-File Editor & Sandpack        │
                      │  • In-Browser MediaPipe FaceDetector (WASM)   │
                      │  • react-window Virtualized Live Seat Map     │
                      └───────┬───────────────────────────────┬───────┘
                              │ HTTPS / REST                  │ WSS / Socket.io
                              ▼                               ▼
                      ┌───────────────────────────────────────────────┐
                      │            Node.js / Express Server           │
                      │  • JWT Auth & Multi-Tier RBAC                 │
                      │  • Real-Time Socket Event Coordinator         │
                      │  • Multi-Parameter Evaluation Engine          │
                      │  • Branded PDFKit Shortlist Generator         │
                      └───────┬──────────────┬──────────────┬─┘───────┘
                              │              │              │
             ┌────────────────┘              │              └────────────────┐
             ▼                               ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
    │  MongoDB Database│             │ Judge0 Ce Engine│             │ YOLOv8 Detector │
    │  • TTL Sessions │             │ • Sandboxed Runt│             │ • FastAPI / Py  │
    │  • Malpractice  │             │ • Isolated Exec │             │ • Phone Detect  │
    └─────────────────┘             └─────────────────┘             └─────────────────┘
```

---

## 🚀 Key Features by Module

### Module 1: Authentication & Role-Based Access Control (RBAC)
- **Candidate Registration & Login**: Candidates register with automatic 3-day TTL session expiration (`expiresAt`).
- **Super Admin vs Admin Roles**: Strict RBAC enforced via server middleware and client route guards (`SUPER_ADMIN` can provision admin accounts, `ADMIN` manages tests and proctoring).

### Module 2: Test Management, Question Bank & Room Provisioning
- **Test Types Supported**: Standard SPOJ / Algorithmic, JavaScript, React, and Fullstack AI Tests.
- **Question Bank & Sets**: Reusable Question Sets with visible and hidden test case builders.
- **Physical Test Rooms**: Multi-room provisioning with cryptographic 8-character codes and room passwords.
- **Dynamic Threshold Controls**: Passing criteria (`≥ X Qs`) and post-test malpractice thresholds (`≤ Y violations`) editable with live recalculations.

### Module 3: Candidate Interface & Testing Environment
- **Monaco Code Editor**: Syntax highlighting, code auto-completion, and custom input runner.
- **Live Test Runner**: Real-time evaluation against visible test cases with Judge0 CE execution.
- **60fps Precision Timer**: Server-synchronized countdown timer with automatic graceful backup submission on expiry.
- **Autosave & State Recovery**: 30-second throttled autosave to prevent data loss.

### Module 4: AI Fullstack Application Test Environment
- **Multi-File Project Workspace**: Virtual file-tree (`index.html`, `style.css`, `script.js`, etc.) with dynamic file creation.
- **Sandpack Live Preview**: Real-time sandboxed DOM rendering in isolated iframe.
- **Kimi AI Chat Assistant**: Integrated conversational AI assistant powered by Moonshot Kimi LLM adapter.
- **Internal Clipboard System**: Safe copy-paste mechanism from AI chat messages into code files while maintaining strict blocking against external clipboard sources.

### Module 5: Automated Proctoring & Malpractice Detection
- **Client-Side Face Detection**: Continuous in-browser face presence and multi-face counting using official `@mediapipe/tasks-vision` `FaceDetector`.
- **Absence Duration Tracking**: Tracks continuous absence and triggers `NO_FACE_15MIN` only after 15 minutes of uninterrupted absence.
- **Periodic Phone Detection**: Throttled 7.5s loop uploading webcam frames to the YOLOv8 phone detection microservice.
- **Fullscreen & Tab-Switch Enforcement**: Browser-level listeners capturing viewport snapshot proofs on violation and displaying fullscreen re-entry lockouts.
- **Anti-Cheating Guardrails**: Document-level blocking of copy, paste, cut, and context menus.
- **Cloudinary Storage**: Automatic offsite cloud persistence for violation proof screenshots.

### Module 6: Live Proctoring Dashboard & Visual Seat Map
- **Socket.io Real-Time Layer**: Sub-second synchronization of candidate heartbeats, status transitions, and malpractice alerts.
- **Glanceable Seat Map**: Status tiles with official Globussoft color tokens:
  - 🟢 **Green (`#2ECC71`)**: Met passing criteria.
  - 🟡 **Yellow (`#F1C40F`)**: In progress / working.
  - 🔴 **Red (`#E74C3C`)**: Disqualified.
  - ⚪ **White/Grey (`#E5E7EB`)**: Disconnected / Offline.
- **Persistent Malpractice Badges**: Persistent `⚠️ count` counters visible on candidate seat tiles and roster rows at all times.
- **`react-window` List Virtualization**: Virtualized scrolling on candidate rosters for smooth 60fps performance with 300+ concurrent test takers.
- **Text-to-Speech (TTS) Voice Announcements**: Browser Web Speech API announces candidate submissions in real-time.

### Module 7: Multi-Parameter Evaluation Engine
- **Granular 10-Parameter Scoring**:
  1. Code Correctness (30%)
  2. Hidden Test Case Pass % (10%)
  3. Time Complexity (15%)
  4. Space Complexity (10%)
  5. Code Structure & Readability (10%)
  6. Problem-Solving Approach (8%)
  7. Exception & Edge Case Handling (8%)
  8. Input Validation & Robustness (5%)
  9. Code Optimization (2%)
  10. Lines of Code Economy (2%)
- **AI Test Scoring**: Prompt Quality & Strategy (60%) + Output Correctness & Design (40%).

### Module 8: Shortlisting, Recalculations & PDF Export
- **Ranked Shortlists**: Shortlist generated with strict `rank` ascending = `score` descending ordering (`Rank 1` = highest score).
- **Official Globussoft PDF Letterhead**: Branded PDF generated with PDFKit containing Primary Teal (`#0E7C86`) header banner, Globussoft corporate address, tagline *"Technology Ahead of Time"*, and sanitized candidate data (only name, email, score, and rank).

---

## 🌐 Network & Deployment Operational Notes

### MediaPipe CDN Outbound Access & Air-Gapped Fallback
> [!IMPORTANT]
> The client-side face detection engine utilizes `@mediapipe/tasks-vision`'s WebAssembly binaries and the `blaze_face_short_range.tflite` model.
>
> 1. **Default Configuration**: In standard deployments, the client loads WASM binaries from `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm` and model weights from `https://storage.googleapis.com/mediapipe-models/`. The testing lab or candidate network requires outbound HTTPS access to these domains.
> 2. **Restricted / Air-Gapped Campus Networks**: If deploying in a secured testing center with strict firewalls or air-gapped intranets, download the MediaPipe WASM package and `.tflite` model file to the client's `public/mediapipe/` static folder and update `FilesetResolver.forVisionTasks('/mediapipe/wasm')` and `modelAssetPath: '/mediapipe/blaze_face_short_range.tflite'`.

---

## 🛠 Local Setup & Running

### Prerequisites
- Node.js 18+ and npm 9+
- MongoDB instance (local or MongoDB Atlas)
- Python 3.9+ (for YOLO phone detector microservice)

### 1. Environment Variables Configuration

Copy `.env.example` in both server and client:

```bash
# Server Environment Variables (server/.env)
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-proctored-test-platform
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_here
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_judge0_key
KIMI_API_KEY=your_moonshot_kimi_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
YOLO_SERVICE_URL=http://localhost:8000/detect
```

```bash
# Client Environment Variables (client/.env)
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

### 2. Install & Start Backend Server

```bash
cd server
npm install
npm run dev
```

### 3. Install & Start Frontend Client

```bash
cd client
npm install
npm run dev
```

### 4. Start YOLOv8 Phone Detector Service

```bash
cd yolo-service
pip install -r requirements.txt
python app.py
```

### 5. Running via Docker Compose

```bash
docker-compose up --build
```

---

## 📁 Repository Structure

```
ai-proctored-test-platform/
├── client/
│   ├── src/
│   │   ├── admin/pages/           # Admin & Super Admin Pages
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminTests.jsx
│   │   │   ├── AdminTestDetail.jsx
│   │   │   ├── AdminQuestionBank.jsx
│   │   │   ├── AdminLiveDashboard.jsx
│   │   │   ├── AdminResults.jsx
│   │   │   └── AdminCreateAdmin.jsx
│   │   ├── candidate/pages/       # Candidate Assessment Flow
│   │   │   ├── CandidateRegister.jsx
│   │   │   ├── CandidateLogin.jsx
│   │   │   ├── CandidateJoinRoom.jsx
│   │   │   ├── CandidateInstructions.jsx
│   │   │   ├── CandidateTestScreen.jsx
│   │   │   ├── CandidateAITestScreen.jsx
│   │   │   └── CandidateTestComplete.jsx
│   │   ├── hooks/                 # Custom Hooks (Proctoring, Timer, Autosave)
│   │   │   ├── useProctoring.js
│   │   │   ├── useTimer.js
│   │   │   └── useAutosave.js
│   │   └── services/              # Axios & Socket.io Clients
├── server/
│   ├── src/
│   │   ├── controllers/           # Endpoint Controllers (Auth, Tests, Evaluation, etc.)
│   │   ├── models/                # Mongoose Schemas (Test, Question, Submission, etc.)
│   │   ├── routes/                # Express API Route Declarations
│   │   ├── services/              # Core Services (Judge0, Kimi, Malpractice, Shortlist)
│   │   └── socket/                # Socket.io Event Layer
└── yolo-service/
    ├── app.py                     # Ultralytics YOLOv8 Phone Detector Microservice
    ├── requirements.txt
    └── Dockerfile
```

---

## 📄 License & Confidentiality

Proprietary and Confidential. Developed for **Globussoft Technology HR & Assessment Operations**.
