# ClassPulse AI — Your AI Classroom Companion

> **Tagline:** Your live AI learning companion that runs alongside your real Google Meet class.

---

## 1. Project Overview

**ClassPulse AI** is an intelligent, live study companion designed to empower students during real-time online classes on Google Meet. Rather than attempting fragile and brittle headless bots or creating fake classroom simulations, ClassPulse uses a reliable, high-fidelity **Companion Architecture**:
- When the student enters their Google Meet link, their **real Google Meet session opens in a new browser tab/window** (`window.open`).
- In the original tab, **ClassPulse AI runs alongside the class** as a focused, distraction-free study companion.
- Students can ask math, science, or conceptual doubts anytime through **text or voice** using ClassPulse's own microphone stream without disrupting their live lecture or teacher.
- Powered by a local deterministic **Algebraic Step-by-Step Math Solver** and a **Keyword/Lexical Relevance-Scored (TF-IDF/BM25) RAG Engine**, ClassPulse answers questions dynamically with grounded explanations and natural AI voice synthesis.

---

## 2. Problem Statement

During live virtual classes on Google Meet:
1. **Students hesitate to interrupt:** Asking questions in the main class chat or unmuting can disrupt the teacher's flow or create anxiety.
2. **Delayed resolution:** Doubts left unresolved during a lecture snowball, leading to learning loss.
3. **No automated personal tutor:** Existing chat tools are disconnected from the class session and lack multi-turn context retention for classroom concepts.

---

## 3. Solution

ClassPulse AI provides a private, non-disruptive, live classroom companion:
- **Instant Doubts Resolution:** Step-by-step solutions for algebra (`2x+5=0`, `2x+3=11`, `3x+6=15`, `x+7=12`, `4x=16`, `2x-3=7`, `5x-10=20`, etc.) and STEM concepts (Physics, Chemistry, Biology, Computer Science).
- **Multi-Turn Context Awareness:** Retains previous questions within a session (e.g., after solving `2x+5=0`, asking *"Why do we divide by 2?"* resolves contextually).
- **Interactive Speech Interface:** Voice input with real-time transcription preview and natural female voice synthesis.
- **Session Intelligence & Summary:** Generates structured revision notes, key concepts learned, and review suggestions upon ending a session.

---

## 4. Architecture & Companion Pattern

```
+-----------------------------------------------------------------------------------------+
|                                    ClassPulse Architecture                              |
+-----------------------------------------------------------------------------------------+

  [ Student Browser Tab 1 ] ─────────────────► [ Real Google Meet Call ]
  (https://meet.google.com/xxx-yyyy-zzz)        (Teacher & Classmates Audio/Video)
           │
           │ (Runs alongside without audio interception)
           ▼
  [ Student Browser Tab 2 ] ─────────────────► [ ClassPulse AI Companion UI ]
  (http://localhost:5173)                       - Independent Mic / Speech-to-Text
                                                - Dynamic Chat Feed & Math LaTeX
                                                - Audio Wave Visualizer & Status Pulse
                                                - Session Notes & Concept Graph
                                                       │
                                                       ▼
                                         [ ClassPulse Express Backend ]
                                         (Node.js + TypeScript - Port 3001)
                                           ├── URL Normalizer & Validator (FIX 1)
                                           ├── Intent Classifier (Casual vs STEM)
                                           ├── Step-by-Step Math Solver Engine
                                           ├── Lexical RAG Engine (TF-IDF / BM25)
                                           ├── Multi-turn Session Context Tracker
                                           └── Agora Conversational AI Webhook (FIX 2 & 3)
```

---

## 5. Folder Structure

```
d:/PROJECT/ClassPulse/
├── shared/
│   ├── index.ts                     → Shared exports
│   └── types.ts                     → Universal TypeScript interfaces (Session, ChatMessage, RAG)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/
│   │   └── classpulse_db.json       → Persistent session store (Zero-native build risk)
│   └── src/
│       ├── index.ts                 → Express server setup & middleware
│       ├── config.ts                → Environment variable configuration
│       ├── routes/
│       │   ├── session.routes.ts    → /api/session/create, /join, /end, /materials/upload
│       │   ├── chat.routes.ts       → /api/chat, /api/voice/question
│       │   └── agora.routes.ts      → /api/agora/token, /agent/start, /agent/stop, /llm-webhook
│       ├── services/
│       │   ├── db.service.ts        → Pure-TS persistent session & conversation database
│       │   ├── urlValidator.ts      → Google Meet URL parser & normalizer (FIX 1)
│       │   ├── rag/
│       │   │   ├── corpus.ts        → Structured STEM knowledge base (Math, Phys, Chem, Bio, CS)
│       │   │   ├── mathSolver.ts    → Deterministic linear & algebraic equation solver
│       │   │   └── ragEngine.ts     → Lexical relevance scoring (TF-IDF/BM25) & intent routing
│       │   └── voice/
│       │       └── agora.service.ts → Agora RTC token generation, agent lifecycle & webhook auth
│       └── test/
│           └── ragSolver.test.ts    → Automated test suite for equations, intents, and URL parsing
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                  → Core router & state orchestrator
│       ├── index.css                → Tailwind CSS & custom animations
│       ├── types.ts                 → Frontend TypeScript interfaces
│       ├── hooks/
│       │   └── useVoice.ts          → Dual-mode voice hook (Agora RTC + Web Speech fallback)
│       ├── services/
│       │   ├── api.ts               → REST client for ClassPulse backend
│       │   └── demoScript.ts        → Standalone offline demo dataset
│       └── components/
│           ├── LandingPage.tsx      → Focused, dark-mode join screen
│           ├── CompanionView.tsx    → Live classroom study companion workspace
│           ├── AIAvatar.tsx         → Reactive visual avatar with status indicators
│           ├── ChatWindow.tsx       → Chronological doubt feed with math LaTeX rendering
│           ├── VoiceController.tsx  → Text/Voice controls with live transcript preview
│           ├── DemoModeBar.tsx      → Guided step-by-step demo banner
│           └── SessionSummaryModal.tsx → Session wrap-up notes & markdown export
├── .env.example                     → Template environment variables
└── README.md                        → Comprehensive system documentation
```

---

## 6. Technologies Used

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React Icons, Agora Web SDK (`agora-rtc-sdk-ng`), Web Speech API (`SpeechRecognition` & `SpeechSynthesis`).
- **Backend:** Node.js (v24+), TypeScript, Express.js, `zod` for request validation, `cors`, `dotenv`.
- **Database & Storage:** Pure TypeScript atomic persistent JSON database (`backend/src/services/db.service.ts`) ensuring 100% zero native C++ compilation friction on Windows.
- **RAG & Mathematical Reasoning:** Deterministic algebraic equation solver engine + TF-IDF/BM25 token-weighted lexical relevance index over a structured STEM curriculum.

---

## 7. Agora Integration (What It Does and Does Not Do)

### What Agora DOES:
- Powers the **real-time voice streaming layer** for the ClassPulse companion's own voice interface.
- Generates secure Agora RTC access tokens (`POST /api/agora/token`).
- Exposes an authenticated webhook (`POST /api/agora/llm-webhook`) protected by `CLASSPULSE_WEBHOOK_SECRET` for the Agora Conversational AI Agent to receive grounded RAG/solver responses.
- Provides automatic inactivity timeouts (5 minutes) and lifecycle teardown on unmount or `beforeunload` to conserve metered cloud resources.

### What Agora DOES NOT do:
- **Does NOT join or intercept Google Meet's audio room.** Google Meet and Agora are separate channels. ClassPulse captures the student's voice through ClassPulse's own microphone access.
- **Does NOT fake state via unconfigured RTM.** Voice states (Speaking, Listening, Thinking, Idle) are derived directly and heuristically from audio volume and speech activity.

---

## 8. Google Meet Integration Architecture

ClassPulse AI provides two seamless Google Meet integration modes:

1. **Official Google Meet Add-on Mode (`/addon/side-panel` & `/addon/main-stage`)**:
   - Built on the official `@googleworkspace/meet-addons` SDK and configured via `addon-manifest.json`.
   - **Side Panel (`/addon/side-panel`)**: Lightweight side-panel embedded directly inside Google Meet's Activities drawer. Students ask private doubts via text or voice without disturbing the teacher or class.
   - **Main Stage (`/addon/main-stage`)**: Collaborative STEM whiteboard presenting step-by-step mathematical breakdowns, curriculum references, and interactive solution chalkboard.
2. **Companion Window Mode (`/`)**:
   - When the student enters a Google Meet link on the home screen, ClassPulse verifies the link and calls `window.open(normalizedMeetingUrl, '_blank')`.
   - The real Google Meet lecture opens in a dedicated tab while ClassPulse AI operates alongside in the companion tab.
3. **Zero Broken iframes & Zero Fake Bots**:
   - Standard Google Meet calls strictly block arbitrary `<iframe>` embedding via `X-Frame-Options: SAMEORIGIN`. ClassPulse uses the official Add-on SDK and direct companion patterns to guarantee 100% reliable operation.

---

## 9. RAG Architecture (Keyword & Lexical Relevance Scoring)

The local RAG system uses **Keyword and Lexical Relevance Scoring (TF-IDF / BM25 token-weighted score)** rather than hosted vector databases or API-key-gated embeddings:
1. **Tokenization & Stopword Filtering:** Normalizes input text and extracts salient query terms.
2. **Intent Classification:**
   - *Casual Intent:* Greetings (`"Hi"`), name introductions (`"My name is Jeevan"`), gratitude (`"Thank you"`).
   - *Algebraic Solver Intent:* Triggers deterministic step-by-step solver for linear equations (`ax + b = c`, `ax = c`, `x + b = c`, `ax - b = c`).
   - *Contextual Follow-Up:* Resolves queries like `"Why do we divide by 2?"` against active session topics.
   - *Educational RAG Intent:* Computes BM25/TF-IDF token scores across structured STEM knowledge domains (Mathematics, Physics, Chemistry, Biology, Computer Science).
3. **Zero Static Fallbacks:** Every answer is dynamically calculated and grounded in user input.

---

## 10. Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ / v24+ recommended)
- **npm**: v9.0.0 or higher

### Step-by-Step Setup
1. **Clone or Open Workspace:**
   ```bash
   cd d:/PROJECT/ClassPulse
   ```
2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   npm run build
   ```
3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   npm run build
   ```

---

## 11. Backend Startup Command

```bash
cd d:/PROJECT/ClassPulse/backend
npm run dev
```
*The backend server will start on `http://localhost:3001`.*

---

## 12. Frontend Startup Command

```bash
cd d:/PROJECT/ClassPulse/frontend
npm run dev
```
*The frontend Vite dev server will start on `http://localhost:5173`.*

---

## 13. Environment Variables

Create `.env` in the project root or `backend/` by copying `.env.example`:

| Variable | Description | Required For |
| :--- | :--- | :--- |
| `PORT` | Server listening port (default: `3001`) | Core Backend |
| `AGORA_APP_ID` | Agora Project App ID | Agora Real-Time Voice |
| `AGORA_APP_CERTIFICATE`| Agora App Certificate (Server Token Generation) | Agora Real-Time Voice |
| `AGORA_CUSTOMER_ID` | Agora REST API Customer ID | Agora Conversational AI Agent |
| `AGORA_CUSTOMER_SECRET`| Agora REST API Customer Secret | Agora Conversational AI Agent |
| `CLASSPULSE_WEBHOOK_SECRET` | Shared secret header for `/api/agora/llm-webhook` | LLM Webhook Security |
| `CLASSPULSE_PUBLIC_URL` | Public tunnel URL (e.g. `https://xxx.ngrok-free.app`) | Agora Cloud Agent Callback |
| `OPENAI_API_KEY` | Optional external LLM key | Optional (Local RAG runs 100% keyless) |

> **Note:** The entire core application, text chat, math solver, local RAG, session summary, and Standalone Demo Mode **require ZERO environment variables or external API keys to run out-of-the-box**.

### Public URL Setup (ngrok) for Agora Cloud Agents
When using Agora's cloud Conversational AI agent during local testing:
```bash
ngrok http 3001
```
Copy the generated forwarding URL (e.g., `https://abcdef.ngrok-free.app`) and set:
```env
CLASSPULSE_PUBLIC_URL=https://abcdef.ngrok-free.app
```

---

## 14. Known Limitations

1. **Google Meet Audio Stream:** ClassPulse does not capture other meeting participants' audio directly from Google Meet. All audio queries are submitted through ClassPulse's dedicated voice interface.
2. **Pre-Loaded STEM Curriculum:** The RAG knowledge base is pre-indexed with core STEM domains. Live document uploads (`/api/materials/upload`) support session notes rather than multi-gigabyte PDF vectorization.
3. **Browser Speech Permissions:** Web Speech fallback requires granting browser microphone permission.

---

## 15. Standalone Demo Mode (Zero Credentials / Offline Fallback)

Click **"Launch Demo Mode (Zero Credentials)"** on the landing page to start an interactive, guided walkthrough. It runs **100% in-browser with zero backend dependencies, zero API keys, and no real Google Meet call required**.

Guided steps include:
1. `"Hi"` $\rightarrow$ Friendly companion introduction.
2. `"My name is Jeevan."` $\rightarrow$ Personalized name recognition.
3. `"How do I solve 2x + 5 = 0?"` $\rightarrow$ Dynamic step-by-step linear equation solution ($x = -2.5$).
4. `"Why do we divide by 2?"` $\rightarrow$ Multi-turn context resolution.
5. `"Can you explain Newton's first law?"` $\rightarrow$ Physics mechanics explanation & inertia.
6. `"What is photosynthesis?"` $\rightarrow$ Biochemical formula & chloroplast stages.
7. `"How do I solve 2x + 3 = 11?"` $\rightarrow$ Additional equation practice ($x = 4$).
8. End Session $\rightarrow$ Comprehensive summary modal with markdown export.
