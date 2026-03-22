<div align="center">
  <img src="frontend/public/am-icon.png" alt="AgenticMeadows" width="120" />
  <h1>AgenticMeadows</h1>
  <p><strong>AI-Powered Landscaping Field Service Management</strong></p>
  <p>100% local &middot; No cloud required &middot; No subscriptions</p>
  <br />
  <a href="#one-command-install">Quick Install</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#contributing">Contributing</a>
</div>

---

## What is AgenticMeadows?

AgenticMeadows is an open-source, AI-first field service management platform built specifically for landscaping businesses. It replaces expensive SaaS tools like Jobber and HousecallPro with a locally-hosted platform that runs entirely on your hardware.

**Glen**, your AI assistant, can manage your entire business through natural conversation — create clients, schedule jobs, draft quotes, analyze lawn health, and more.

---

## One-Command Install

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/GTM-Planetary/agenticmeadows/main/install.sh | bash
```

### Manual Install (if you already have Docker)

```bash
git clone https://github.com/GTM-Planetary/agenticmeadows.git
cd agenticmeadows
docker compose up -d
# Open http://localhost:3001
```

### Start / Stop / Update

```bash
./start.sh   # Start the app (opens browser)
./stop.sh    # Stop all services (data preserved)
./update.sh  # Pull latest + rebuild + restart
```

---

## Features

### Glen AI Assistant

- Natural language CRM management — "Create a client: Jose Nunez, 208-555-1234"
- Slash commands (`/new-client`, `/schedule`, `/weather`, `/lawn-check`)
- Interactive entity cards with inline editing
- Batch actions — handle multiple operations in one message
- Fuzzy address matching — "Show me the Geneva Pl property"
- Lawn health diagnostics from built-in knowledge base
- Treatment recommendations with chemical, organic, and cultural options

### Client & Property Management

- Full CRM with clients, properties, and contact info
- Property measurements (lot size, lawn area, bed area, edging)
- Chemical application tracking with re-entry compliance
- Property health scoring and predictive maintenance

### Scheduling

- Google Calendar-style week view with 24-hour time grid
- Double-click to create jobs directly on the schedule
- Click job cards for detail popout with quick actions
- Configurable job types (Mow, Fertilize, Aeration, etc.)

### Quoting & Invoicing

- Service catalog with configurable pricing (flat, per sqft, per hour)
- Quote builder with service dropdown auto-fill
- Quote workflow: Draft &rarr; Sent &rarr; Approved &rarr; Convert to Invoice
- Invoice customization with company branding
- PDF and CSV export

### Reports & Analytics

- Revenue reports (by month, client, service type)
- Job completion metrics and productivity tracking
- Client revenue rankings and sales pipeline funnel
- Invoice aging report
- Chemical application compliance log
- CSV and PDF export

### Predictive Maintenance

- Equipment fleet tracking (mowers, trimmers, vehicles, trailers)
- Maintenance scheduling with automatic alerts
- Service logging with cost tracking
- Repair vs. replace analysis
- Property health assessments with predicted service needs

### Settings & Administration

- Organization settings (company name, logo, address)
- User management with roles (Admin, Technician, Viewer)
- Invite links for easy team onboarding
- Configurable job types
- Custom fields and sections
- API key management for external integrations
- AI Agent configuration (model, tools, skills)

### Security

- NemoClaw sandbox for AI agent isolation
- NeMo Guardrails for jailbreak/injection detection
- PendingAction pattern — AI proposes, human confirms all writes
- All data stays on your hardware

---

## Architecture

```
Frontend (React/Vite/Nginx)  ──▶  Backend (Express/Prisma)  ──▶  PostgreSQL 16
       Port 3001                       Port 4000                    Port 5433
           │                               │
           ▼                               ▼
   AI Service (FastAPI)  ──────▶  Ollama (Qwen 3.5)
   ReAct Agent Engine              Local LLM
       Port 8000                    Port 11435
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| Backend | Node.js, Express, Prisma ORM |
| AI Service | Python, FastAPI, ReAct Agent Engine |
| LLM | Qwen 3.5 via Ollama (auto-selects model size) |
| Database | PostgreSQL 16 |
| Security | NemoClaw + NeMo Guardrails |
| Agent | OpenClaw with 23 MCP tools |

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 4 GB | 16 GB+ |
| Storage | 10 GB | 20 GB+ |
| Docker | 24.0+ | Latest |
| OS | macOS, Linux, Windows (WSL2) | macOS Apple Silicon |

The AI model auto-selects based on available RAM:

| RAM | Model | Quality |
|-----|-------|---------|
| < 4 GB | Qwen 3.5 0.8B | Basic |
| 4-8 GB | Qwen 3.5 2B | Good |
| 8-16 GB | Qwen 3.5 4B | Great |
| 16-32 GB | Qwen 3.5 9B | Excellent |
| 32 GB+ | Qwen 3.5 27B | Best |

---

## Optional: NVIDIA Cloud Enhancement

For better AI responses, add a free NVIDIA API key from [build.nvidia.com](https://build.nvidia.com):

1. Go to build.nvidia.com and sign in
2. Search for **Nemotron** and click "Get API Key"
3. In AgenticMeadows: Settings &rarr; Integrations &rarr; paste key &rarr; Save

The AI will use Nemotron cloud for better responses and fall back to local Ollama when offline.

---

## Contributing

We welcome contributions!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

## AgenticMeadows Cloud

Coming soon — managed hosting with premium integrations:

- QuickBooks Online sync
- Stripe payment processing
- SMS & email notifications (Twilio)
- Google Calendar integration
- Fine-tuned AI models for landscaping
- Team GPS tracking

---

<div align="center">
  <p>Built by <a href="https://github.com/GTM-Planetary">GTM Planetary</a></p>
  <p>Powered by Qwen 3.5 &middot; OpenClaw &middot; NemoClaw</p>
</div>
