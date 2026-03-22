# AgenticMeadows NemoClaw + OpenClaw Agent Container
# Ubuntu 22.04 with NemoClaw security sandbox + OpenClaw agent framework
# Runs our AI service with MCP tools inside an OpenShell security sandbox
#
# Architecture:
#   OpenClaw (agent brain — reasoning, tool calling)
#     └── MCP Server (agenticmeadows tools — 17 tools for CRM/FSM operations)
#       └── NemoClaw (security sandbox — network/filesystem/process isolation)
#         └── Ollama (local LLM inference — Qwen 3.5, no cloud required)

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# ── System dependencies ───────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    g++ \
    jq \
    && rm -rf /var/lib/apt/lists/*

# ── Install Node.js 20 (required by NemoClaw + OpenClaw CLI) ─────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Install Docker CLI (needed for sandbox management) ────────────────────
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# ── Install NemoClaw (security sandbox layer) ─────────────────────────────
# NemoClaw wraps OpenClaw with OpenShell security policies.
# If install fails (alpha preview), we fall back gracefully.
RUN curl -fsSL https://nvidia.com/nemoclaw.sh -o /tmp/nemoclaw-install.sh 2>/dev/null \
    && chmod +x /tmp/nemoclaw-install.sh \
    && bash /tmp/nemoclaw-install.sh --non-interactive 2>/dev/null || true \
    && rm -f /tmp/nemoclaw-install.sh

RUN nemoclaw onboard --non-interactive 2>/dev/null || true

# ── Install OpenClaw (agent framework) ────────────────────────────────────
# OpenClaw is the agentic brain. NemoClaw wraps it for security.
# If NemoClaw installed OpenClaw already, this is a no-op.
RUN npm install -g @anthropic/openclaw@latest 2>/dev/null \
    || npm install -g openclaw@latest 2>/dev/null \
    || echo "OpenClaw CLI not available via npm — will use bundled version"

# ── Create directory structure ────────────────────────────────────────────
RUN mkdir -p /sandbox/ai-service /sandbox/mcp-server /sandbox/skills \
    /sandbox/policies /sandbox/.openclaw /app/photos

# ── Install Python dependencies ──────────────────────────────────────────
COPY ai-service/requirements.txt /sandbox/ai-service/requirements.txt
RUN cd /sandbox/ai-service && pip3 install --no-cache-dir -r requirements.txt

# Install MCP server dependencies
COPY mcp-server/requirements.txt /sandbox/mcp-server/requirements.txt
RUN cd /sandbox/mcp-server && pip3 install --no-cache-dir -r requirements.txt 2>/dev/null || true

# ── Copy application code ─────────────────────────────────────────────────
COPY ai-service/ /sandbox/ai-service/
COPY mcp-server/ /sandbox/mcp-server/
COPY skills/ /sandbox/skills/

# ── Copy NemoClaw policies ────────────────────────────────────────────────
COPY nemoclaw/policies/ /sandbox/policies/

# ── Configure OpenClaw with our MCP server + skills ───────────────────────
COPY nemoclaw/openclaw.json /sandbox/.openclaw/openclaw.json

# ── Copy entrypoint ──────────────────────────────────────────────────────
COPY nemoclaw/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=60s \
    CMD curl -sf http://127.0.0.1:8000/health || exit 1

CMD ["/entrypoint.sh"]
