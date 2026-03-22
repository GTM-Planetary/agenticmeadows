# 🌿 AgenticMeadows

**Open-source, locally-runnable landscaping field service management platform.**
Think Jobber, but every workflow is powered by a local AI agent running on your own hardware — no cloud, no subscriptions.

---

## What Makes It Different

**Agentic & Vision by Design.** Every module is wired to a local AI assistant powered by **Qwen 3.5** (via Ollama). Because Qwen 3.5 is natively multimodal, the AI handles both:
- **Text tasks** — reading context, drafting quotes, checking the schedule
- **Vision tasks** — analyzing job site photos to identify work needed and suggest pricing

**NVIDIA NeMo Guardrails** enforces policy-based safety: the AI stays in scope, resists prompt injection, and never executes write operations without user confirmation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Node.js + Express + Prisma ORM |
| AI Service | Python FastAPI + NeMo Guardrails |
| Local LLM | Ollama running `qwen2.5` (auto-sized by RAM) |
| Database | PostgreSQL 16 |
| Deployment | Docker Compose |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Docker Compose Stack                      │
│                                                              │
│  ┌────────────┐    ┌────────────┐    ┌──────────────────┐   │
│  │  Frontend  │───▶│  Backend   │───▶│   PostgreSQL 16  │   │
│  │ React/Vite │    │ Node/Prism │    │                  │   │
│  │  Port 3001 │    │  Port 4000 │    │    Port 5433     │   │
│  └─────┬──────┘    └─────┬──────┘    └──────────────────┘   │
│        │                 │                                    │
│        ▼                 ▼                                    │
│  ┌──────────────────────────┐    ┌────────────────────────┐  │
│  │      AI Service          │───▶│        Ollama          │  │
│  │   FastAPI + NeMo Rails   │    │    Qwen 3.5 (local)    │  │
│  │        Port 8000         │    │       Port 11435       │  │
│  └──────────────────────────┘    └────────────────────────┘  │
│                                                              │
│  Shared Volume: photos_volume (/app/photos)                  │
│  Backend saves uploads → AI Service reads for vision         │
└──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker Desktop | Version 24+ recommended |
| RAM | 4GB minimum · 8GB+ for better AI quality |
| Storage | ~10GB for Docker images + model weights |
| OS | macOS, Linux, or Windows (WSL2) |

**Qwen 3.5 model auto-selection by RAM:**
| Your RAM | Model Used | Quality |
|---|---|---|
| 32GB+ | `qwen3.5:27b` | Excellent |
| 16-31GB | `qwen3.5:9b` | Great |
| 8-15GB | `qwen3.5:4b` | Good |
| 4-7GB | `qwen3.5:2b` | Decent |
| <4GB | `qwen3.5:0.8b` | Basic |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/agenticmeadows.git
cd agenticmeadows

# 2. Copy environment file (defaults work out of the box)
cp .env.example .env

# 3. Start everything — grab a coffee, first run downloads the AI model
docker-compose up -d

# 4. Open the app
open http://localhost:3001

# Default login: admin@turf.local / password123
```

That's it. One command.

---

## How the Vision AI Works

1. **Open a Job** → navigate to any job detail page
2. **Upload a photo** → click "Upload Photo", select Before/After/Mapping Idea, pick a file
3. **Ask the AI** → type a prompt like "What work is needed here and what should I charge?"
4. **Qwen 3.5 analyzes** → the photo is sent to the locally-running multimodal model via Ollama's vision API
5. **Review the analysis** → AI describes what it sees (sq footage, plant conditions, specific services needed) and estimates costs
6. **Draft a Quote** → click "Draft Quote from Analysis" — the AI prepares a quote with line items
7. **Confirm** → review the quote in the chat panel, click Confirm — it's created in the system

The AI **never** executes write operations without your confirmation. Every proposed action appears as a confirmation card.

---

## Project Structure

```
agenticmeadows/
├── docker-compose.yml          # Orchestration (start everything here)
├── .env.example                # Copy to .env
├── frontend/                   # React + Vite + TailwindCSS
│   └── src/
│       ├── components/
│       │   ├── layout/         # Sidebar, TopBar, AIChatPanel
│       │   ├── jobs/           # SitePhotoSection (photo upload + AI)
│       │   └── ai/             # ChatMessage, PendingActionCard
│       └── pages/              # Dashboard, Clients, Schedule, Jobs, Quotes, Invoices
├── backend/                    # Node.js + Express + Prisma
│   └── src/
│       ├── routes/             # REST API routes
│       ├── controllers/        # Business logic
│       ├── middleware/         # JWT auth, error handling
│       └── prisma/             # schema.prisma + migrations
├── ai-service/                 # Python FastAPI + NeMo Guardrails
│   ├── main.py                 # Chat & confirm-action endpoints
│   ├── guardrails/             # NeMo config, prompts, Colang flows
│   └── tools/                 # Vision, quote, schedule, client tools
└── postgres/
    └── init.sql                # Schema constraints + seed data
```

---

## API Reference

### Backend (port 4000)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in, get JWT |
| POST | `/api/auth/register` | Create account |
| GET | `/api/clients` | List clients (supports `?search=`) |
| POST | `/api/clients` | Create client (with nested properties) |
| GET | `/api/jobs` | List jobs (supports `?status=&clientId=`) |
| POST | `/api/jobs/:id/photos` | Upload job site photo (multipart) |
| GET | `/api/schedule?start=&end=` | Jobs in date range |
| POST | `/api/quotes/:id/convert` | Convert approved quote to invoice |

### AI Service (port 8000)

| Method | Path | Description |
|---|---|---|
| POST | `/ai/chat` | Send message, optionally with image URL |
| POST | `/ai/confirm-action` | Execute a pending action after confirmation |
| DELETE | `/ai/pending-action/:id` | Cancel a pending action |
| GET | `/health` | Check AI service + model status |

---

## Development

```bash
# Run just the database and backend in dev mode
docker-compose up -d db backend

# Run frontend outside Docker (hot reload)
cd frontend && npm install && npm run dev

# View backend logs
docker-compose logs -f backend

# Check which Ollama model was selected
docker-compose logs ollama-init

# Prisma Studio (DB GUI)
docker-compose exec backend npx prisma studio
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built with Qwen 3.5 · NeMo Guardrails · Ollama · No cloud dependencies*
