# ReviewIQ — AI-Powered Customer Review Intelligence

> **Hack Malenadu '26** | Transform raw customer reviews into actionable business intelligence in seconds.

ReviewIQ is a full-stack AI platform that ingests customer reviews (CSV/JSON/text paste), automatically cleans and translates multilingual data, detects bot activity, scores 6 product features per review using Google Gemini AI, surfaces emerging complaint trends through a sliding-window algorithm, and generates AI-powered action cards — all streamed live to a premium dark dashboard via Server-Sent Events.

> *"A human catches this in 3 days. ReviewIQ in 47 seconds."*

---

## Table of Contents

- [Features](#-features)
- [Architecture & Request Flow](#-architecture--request-flow)
- [AI Pipeline](#-ai-pipeline)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Demo Walkthrough](#-demo-walkthrough)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Environment Variables](#-environment-variables)
- [How It Works — Deep Dive](#-how-it-works--deep-dive)

---

## Features

### Data Ingestion
- **Smart Column Detection** — Automatically detects review text, product name, and date columns from any CSV/JSON structure using keyword matching and data-type heuristics
- **Column Mapper UI** — If confidence is low, presents an interactive mapping interface with a 3-row data preview
- **Multi-Format Input** — Drag-and-drop CSV/JSON files or paste raw review text directly
- **SSE Streaming** — Real-time progress events (parsing → preprocessing → AI analysis → trend detection → complete) streamed to the frontend via `EventSource`

### NLP Preprocessing
- **Emoji Stripping** — Removes all emojis before analysis to reduce noise
- **Deduplication** — Exact-match duplicate reviews are filtered out
- **Language Detection** — Detects 55+ languages using `langdetect`
- **Auto-Translation** — Non-English reviews translated to English via `deep-translator` (Google Translate backend)
- **Bot Detection** — TF-IDF vectorization + cosine similarity (threshold >0.90 flags duplicates) + short-review filter (<3 words)
- **Sarcasm Flagging** — AI flags sarcastic/ambiguous reviews for human review

### AI Analysis (6-Feature Scoring)
- **Gemini 1.5 Flash** (primary) → **Groq Llama 3.1** (fallback) → **Heuristic keyword fallback** (guaranteed output)
- Each review scored across 6 features: Battery Life, Build Quality, Packaging, Delivery Speed, Price Value, Customer Support
- Per-feature output: `sentiment` (positive/negative/neutral), `confidence` (0–1), and `explanation`
- Batched processing: 25 reviews per prompt, 4 concurrent batches via `asyncio.gather`

### Trend Detection
- **Sliding Window Algorithm** — Compares a window of 50 recent reviews against the previous 50
- **Severity Classification** — Critical / High / Medium / Low based on complaint percentage delta
- **Health Score** — 0–100 score calculated from positive vs. negative sentiment ratio
- **Time Series Generation** — Daily sentiment percentages per feature for chart rendering

### AI Action Cards
- Gemini generates business decisions from critical/high alerts
- Each card includes: title, issue summary, what happened, who is affected, 3 recommended actions, estimated impact, urgency level (immediate / this week / monitor)

### Dashboard & Visualization
- **4 Stat Cards** — Total Reviews, Bots Detected, Flagged Count, Health Score (animated count-up)
- **Sentiment Donut Chart** — Interactive pie chart with positive/negative/neutral distribution
- **Active Alerts Panel** — Severity-coded alerts with real-time pulse animation for critical issues
- **Feature Intelligence Grid** — 6 feature cards with sentiment bars and confidence indicators
- **Trend Chart** — Area chart with feature tabs, anomaly zone highlighting, and tooltips
- **Review Explorer** — Paginated table with filters (All/Positive/Negative/Neutral/Flagged/Bots) + search + detail drawer
- **Language Breakdown** — Visual tag cloud of detected languages

### Reports & Auth
- **PDF Reports** — 5-page dark-themed professional reports generated via ReportLab (metrics, alerts, flagged reviews, feature breakdown)
- **JWT Authentication** — Register/login with bcrypt-hashed passwords, Bearer token auth on all protected routes

---

## Architecture & Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User uploads CSV/JSON                                                      │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────────────┐     ┌─────────────────────────────────────────────┐   │
│  │  Column Detector  │────▶│  If confidence=low → Column Mapper UI      │   │
│  │  (auto-detect)    │     │  If confidence=high → Skip to streaming    │   │
│  └──────────────────┘     └─────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SSE STREAMING PIPELINE                             │   │
│  │                                                                      │   │
│  │  1. PARSE        → Read CSV/JSON into Pandas DataFrame               │   │
│  │       │              ↓ emit SSE event: {type: "parsed"}              │   │
│  │       ▼                                                              │   │
│  │  2. PREPROCESS  → Strip emojis, deduplicate, detect language,       │   │
│  │       │              translate to English, detect bots                │   │
│  │       │              ↓ emit SSE event: {type: "preprocessed"}        │   │
│  │       ▼                                                              │   │
│  │  3. AI ANALYSIS → Batch 25 reviews × 4 concurrent calls             │   │
│  │       │              Gemini 1.5 Flash → Groq Llama 3.1 → Heuristic  │   │
│  │       │              Score 6 features per review                     │   │
│  │       │              ↓ emit SSE event: {type: "batch_done", %}        │   │
│  │       ▼                                                              │   │
│  │  4. TRENDS      → Sliding window (50 reviews) comparison            │   │
│  │       │              Calculate severity, health score, time series   │   │
│  │       │              ↓ emit SSE event: {type: "trends_analyzing"}     │   │
│  │       ▼                                                              │   │
│  │  5. ACTION CARDS → Gemini generates business decisions from alerts   │   │
│  │       │              ↓ emit SSE event: {type: "complete"}            │   │
│  │       ▼                                                              │   │
│  │  6. STORE       → Save Reviews, Alerts, ActionCards, Product to DB  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  Frontend receives SSE events → Updates progress bar, step indicators,     │
│  and latest processed reviews in real-time                                  │
│       │                                                                     │
│       ▼                                                                     │
│  Dashboard fetches aggregated data from REST endpoints                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SSE Event Protocol

| Event Type | When | Payload |
|---|---|---|
| `parsed` | File parsed into DataFrame | — |
| `preprocessed` | Cleaning/translation done | — |
| `batch_done` | Each AI batch completes | `percent`, `latest_reviews[]` (last 3) |
| `trends_analyzing` | Trend engine starts | — |
| `complete` | All analysis finished | `alerts_count`, `action_cards[]`, `product_name` |

---

## AI Pipeline

### 3-Tier Fallback Strategy

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: Google Gemini 1.5 Flash                       │
│  - Fast, high-quality multi-feature scoring             │
│  - 25 reviews per prompt, structured JSON output        │
│  - If it fails ↓                                        │
│                                                         │
│  TIER 2: Groq Llama 3.1 8B (via Groq Cloud API)        │
│  - Ultra-fast inference (~500 tok/s)                    │
│  - Same prompt structure, same JSON schema              │
│  - If it fails ↓                                        │
│                                                         │
│  TIER 3: Heuristic Keyword Fallback                     │
│  - Zero API dependency, instant execution              │
│  - Regex-based sentiment + feature matching             │
│  - Guarantees output even if all AI services are down   │
└─────────────────────────────────────────────────────────┘
```

### Gemini Prompt Design

Each batch of 25 reviews is sent with a structured prompt requesting:
- Overall sentiment (positive/negative/neutral)
- Per-feature scoring: sentiment + confidence (0–1) + explanation
- Sarcasm flag + reason
- Flag for human review + reason

The response is parsed via `safe_json_parse()` which handles markdown-wrapped JSON, malformed output, and partial responses.

### Action Card Generation

For each critical/high alert, Gemini generates an action card with:
- **Title** + **Issue Summary**
- **What Happened** — Root cause analysis
- **Who Is Affected** — Customer segment impacted
- **3 Recommended Actions** — Prioritized business decisions
- **Estimated Impact** — Revenue/reputation risk assessment
- **Urgency** — `immediate` / `this_week` / `monitor`

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend Framework** | Python 3.11 + FastAPI + Uvicorn | Async REST API with auto-generated OpenAPI docs |
| **Primary AI** | Google Gemini 1.5 Flash | Feature scoring, action card generation |
| **Fallback AI** | Groq Llama 3.1 8B | Backup when Gemini is unavailable |
| **Database** | SQLite + SQLAlchemy ORM | Lightweight persistent storage (6 models) |
| **NLP — Language** | langdetect | Detects 55+ languages per review |
| **NLP — Translation** | deep-translator (Google Translate) | Auto-translates non-English reviews |
| **NLP — Bot Detection** | scikit-learn (TF-IDF + cosine similarity) | Identifies duplicate/suspicious reviews |
| **SSE Streaming** | sse-starlette | Real-time server-sent events to frontend |
| **PDF Generation** | ReportLab | 5-page dark-themed professional reports |
| **Authentication** | JWT (python-jose) + bcrypt (passlib) | Secure user auth with token-based access |
| **Frontend Framework** | React 18 + Vite | Fast SPA with hot module replacement |
| **Styling** | TailwindCSS | Utility-first CSS with custom dark design system |
| **Charts** | Recharts | Sentiment donut, trend area charts |
| **Animations** | Framer Motion | Page transitions, card animations, drawer |
| **Icons** | Lucide React | Consistent icon set across all components |
| **HTTP Client** | Axios | API requests with auto-auth headers |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Gemini API key — [Get one here](https://aistudio.google.com/apikey)
- Groq API key (optional, for fallback) — [Get one here](https://console.groq.com)

### 1. Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and GROQ_API_KEY

# Start server
python3 main.py
```

Server runs at `http://localhost:8000` (API docs at `/docs`)

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

App runs at `http://localhost:5173`

### 3. Try It

1. Open `http://localhost:5173`
2. Register a new account
3. Go to **Upload** → drag & drop `reviewiq_rich_demo.csv` (from project root)
4. Watch the real-time streaming analysis
5. Explore the dashboard, trends, alerts, and reviews

---

## Demo Walkthrough

The included `reviewiq_rich_demo.csv` contains **123 reviews** engineered to activate every dashboard feature:

| Feature Activated | How |
|---|---|
| All 6 Feature Cards | Battery, Build, Packaging, Delivery, Price, Support — all have 10+ mentions |
| Critical Packaging Alert | Phase 1: ~8% complaints → Phase 2: ~90% complaints = massive spike |
| Health Score: At Risk (~53) | Negative trend in later reviews drags score down |
| Trend Chart with Anomaly | 30-day range with clear packaging sentiment shift |
| Bot Detection (8 bots) | Duplicate "Good product. Nice quality. Recommended." reviews |
| Language Breakdown | 6 Hindi + 3 Kannada reviews → auto-translated, stats shown |
| Sarcasm Flagging | 5 sarcastic reviews flagged for human review |
| AI Action Cards | Critical packaging alert generates business recommendations |
| Mixed Sentiment | ~20 reviews mention 2+ features with conflicting sentiments |

---

## Project Structure

```
Review-IQ/
├── reviewiq_rich_demo.csv          # Rich demo data (123 reviews)
├── README.md
│
├── backend/
│   ├── main.py                      # FastAPI app — all routes, SSE streaming, auth
│   ├── models.py                    # 6 SQLAlchemy models (User, Review, Batch, Alert, Product, ActionCard)
│   ├── database.py                  # SQLite engine + session management
│   ├── auth.py                      # JWT tokens + bcrypt password hashing
│   ├── ai_engine.py                 # Gemini → Groq → Heuristic fallback pipeline
│   ├── preprocessor.py              # Emoji strip, dedup, langdetect, translate, bot detect
│   ├── trend_engine.py              # Sliding window trend detection + health score
│   ├── action_cards.py              # AI-powered action card generation from alerts
│   ├── column_detector.py           # Auto-detect CSV/JSON column mapping
│   ├── pdf_generator.py             # 5-page dark-themed PDF reports (ReportLab)
│   ├── requirements.txt             # Python dependencies
│   ├── .env.example                 # Environment variable template
│   └── .env                         # Your API keys (not committed)
│
└── frontend/
    ├── package.json                 # Node dependencies + scripts
    ├── vite.config.js               # Vite config with API proxy
    ├── tailwind.config.js           # TailwindCSS design tokens
    └── src/
        ├── main.jsx                 # App entry — providers (Auth, Product, Toast)
        ├── App.jsx                  # Routes + ProtectedRoute + animated page transitions
        ├── index.css                # Global styles, design system, animations
        ├── context/
        │   ├── AuthContext.jsx      # JWT auth state + login/register/logout
        │   ├── ProductContext.jsx   # Product list + selected product state
        │   └── ToastContext.jsx     # Toast notification system
        ├── hooks/
        │   ├── useAuth.js           # Re-export hook for backward compat
        │   └── useCountUp.js        # Animated number counter (easeOutQuart)
        ├── pages/
        │   ├── Login.jsx            # Login form with animated UI
        │   ├── Register.jsx         # Registration form
        │   ├── Dashboard.jsx        # Stat cards, charts, alerts, features, reviews
        │   ├── Upload.jsx           # Upload page wrapper
        │   ├── Trends.jsx           # Health gauge, trend chart, alert windows
        │   ├── Reviews.jsx          # Paginated review explorer with filters
        │   └── Alerts.jsx           # Severity tabs, expandable alerts, action cards
        └── components/
            ├── Sidebar.jsx          # Navigation + alert badge + user info
            ├── TopBar.jsx           # Page title + product selector + PDF download
            ├── Toast.jsx            # Animated toast notifications
            ├── StatCard.jsx         # Animated stat cards with count-up
            ├── FeatureCard.jsx      # Feature sentiment bars + status badge
            ├── ActionCard.jsx       # Expandable AI action card with urgency
            ├── AlertBanner.jsx      # Critical alert banner with dismiss
            ├── TrendChart.jsx       # Area chart with feature tabs + anomaly zones
            ├── ReviewTable.jsx      # Paginated table with filters + search
            ├── ReviewDrawer.jsx     # Slide-out review detail panel
            ├── ColumnMapper.jsx     # Interactive column mapping UI
            ├── SkeletonLoader.jsx   # Shimmer loading placeholders
            └── UploadPanel.jsx      # Drag-drop + text paste + SSE progress
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account → returns JWT + user |
| `POST` | `/api/auth/login` | Login → returns JWT + user |
| `GET` | `/api/auth/me` | Get current user (requires Bearer token) |

### Upload & Analysis (SSE Streaming)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/detect-columns` | Auto-detect columns from uploaded file |
| `POST` | `/api/upload/csv-stream` | SSE streaming CSV analysis |
| `POST` | `/api/upload/json-stream` | SSE streaming JSON analysis |
| `POST` | `/api/upload/text-stream` | SSE streaming text analysis |

### Data & Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | List user's products |
| `GET` | `/api/dashboard/{product}` | Full dashboard aggregation |
| `GET` | `/api/reviews/{product}` | Paginated + filterable reviews |
| `GET` | `/api/trends/{product}` | Trend time series + health score |
| `GET` | `/api/alerts/{product}` | Alert list for product |
| `POST` | `/api/alerts/{id}/resolve` | Mark alert as resolved |

### Action Cards & Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/action-cards/{product}` | AI action cards for product |
| `POST` | `/api/action-cards/{id}/dismiss` | Dismiss an action card |
| `GET` | `/api/report/{product}` | Download PDF report |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI analysis + action cards |
| `GROQ_API_KEY` | Yes | Groq API key for fallback AI analysis |
| `SECRET_KEY` | Yes | JWT signing secret (any random string) |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiry (default: `1440` = 24 hours) |

---

## How It Works — Deep Dive

### Bot Detection Algorithm

1. All reviews are TF-IDF vectorized using `scikit-learn`
2. Pairwise cosine similarity is computed
3. Reviews with similarity >0.90 to another review are flagged as potential bots
4. Additionally, reviews with <3 words are flagged as suspicious short reviews
5. Flagged reviews are stored with `is_bot_suspected=True` but still analyzed

### Trend Detection Algorithm

1. Reviews are sorted by date and grouped into windows of 50
2. For each feature, the complaint percentage in the current window is compared to the previous window
3. Severity is assigned based on the delta:
   - **Critical**: complaint delta >20% OR current >50%
   - **High**: complaint delta >10%
   - **Medium**: complaint delta >5%
   - **Low**: any detectable increase
4. Health score = `positive_pct × 0.7 + (100 - negative_pct) × 0.3` (weighted toward positive sentiment)

### Sliding Window Time Series

1. Reviews are bucketed by date
2. For each date bucket, per-feature sentiment percentages are calculated
3. The result is a `time_series` object: `{dates: [...], features: {packaging: {positive: [...], negative: [...], neutral: [...]}}}`
4. The frontend renders this as an area chart with feature tab switching

### Why Gemini 1.5 Flash?

- **Speed**: Processes 25 reviews in ~3 seconds (vs. ~15s for Gemini Pro)
- **Cost**: Flash tier is significantly cheaper per token
- **Quality**: Sufficient accuracy for sentiment + feature extraction
- **Context window**: 1M tokens — can handle large batches if needed
- **Structured output**: Returns clean JSON with per-feature scores

---

## Team

Built for **Hack Malenadu '26**

---

*Powered by Google Gemini AI*
