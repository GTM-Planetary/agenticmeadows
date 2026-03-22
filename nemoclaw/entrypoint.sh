#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "  AgenticMeadows NemoClaw + OpenClaw Agent Starting"
echo "═══════════════════════════════════════════════════"

# ── Wait for dependencies ─────────────────────────────────────────────────
echo "[1/6] Waiting for backend..."
for i in $(seq 1 60); do
    if curl -sf http://backend:4000/health > /dev/null 2>&1; then
        echo "  ✅ Backend ready"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "  ⚠️  Backend not ready after 60s, continuing anyway..."
    fi
    sleep 2
done

echo "[2/6] Waiting for Ollama..."
for i in $(seq 1 60); do
    if curl -sf http://ollama:11434/api/tags > /dev/null 2>&1; then
        echo "  ✅ Ollama ready"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "  ⚠️  Ollama not ready after 60s, continuing anyway..."
    fi
    sleep 2
done

# ── Read model name ───────────────────────────────────────────────────────
echo "[3/6] Detecting Ollama model..."
MODEL_FILE="/app/photos/current_model.txt"
if [ -f "$MODEL_FILE" ]; then
    export OLLAMA_MODEL=$(cat "$MODEL_FILE")
    echo "  ✅ Using model: $OLLAMA_MODEL"
else
    export OLLAMA_MODEL="qwen3.5:0.8b"
    echo "  ⚠️  Model file not found, defaulting to $OLLAMA_MODEL"
fi

# ── Configure inference routing ───────────────────────────────────────────
echo "[4/6] Configuring inference..."
if [ -n "$NVIDIA_API_KEY" ]; then
    export NEMOCLAW_INFERENCE_MODE="cloud_with_fallback"
    echo "  ✅ NVIDIA API key found — cloud inference with local fallback"
    echo "  ✅ Cloud model: nvidia/nemotron-3-super-120b-a12b"
    echo "  ✅ Fallback: Ollama ($OLLAMA_MODEL)"
else
    export NEMOCLAW_INFERENCE_MODE="local_only"
    echo "  ℹ️  No NVIDIA API key — using local Ollama only"
    echo "  ✅ Model: $OLLAMA_MODEL"
fi

# ── Apply NemoClaw/OpenShell security policies ────────────────────────────
echo "[5/6] Applying NemoClaw security policies..."
NEMOCLAW_ACTIVE="false"
OPENCLAW_ACTIVE="false"

# macOS Docker Desktop workaround for DNS resolution
if ! grep -q "inference.local" /etc/hosts 2>/dev/null; then
    HOST_GW=$(ip route 2>/dev/null | awk '/default/ {print $3}' || echo "172.17.0.1")
    echo "$HOST_GW inference.local" >> /etc/hosts 2>/dev/null || true
fi

if command -v nemoclaw &> /dev/null; then
    echo "  ✅ NemoClaw CLI found"

    if [ -S /var/run/docker.sock ]; then
        echo "  ✅ Docker socket available"
        SANDBOX_LIST=$(nemoclaw list 2>/dev/null || echo "")
        if echo "$SANDBOX_LIST" | grep -q "agenticmeadows"; then
            echo "  ✅ AgenticMeadows sandbox already exists"
        else
            timeout 30 nemoclaw onboard --non-interactive 2>/dev/null && {
                echo "  ✅ NemoClaw onboard complete"
            } || {
                echo "  ⚠️  NemoClaw onboard timed out — continuing without full sandbox"
            }
        fi
    fi

    if command -v openshell &> /dev/null; then
        if openshell policy set /sandbox/policies/openclaw-sandbox.yaml 2>/dev/null; then
            NEMOCLAW_ACTIVE="true"
            echo "  ✅ OpenShell sandbox policies ACTIVE"
            echo "  ✅ Network: DENY ALL except backend, ollama, nvidia, open-meteo"
            echo "  ✅ Filesystem: writable /sandbox, /tmp, /app/photos only"
        else
            echo "  ⚠️  OpenShell policy enforcement not available"
        fi
    fi
else
    echo "  ℹ️  NemoClaw CLI not available — running with application-level safety"
fi

# ── Configure OpenClaw agent ─────────────────────────────────────────────
echo "[6/6] Configuring OpenClaw agent..."

if command -v openclaw &> /dev/null; then
    OPENCLAW_ACTIVE="true"
    export OPENCLAW_HOME="/sandbox/.openclaw"

    # Register our MCP server with OpenClaw
    openclaw config set mcpServers.agenticmeadows.command "python3" 2>/dev/null || true
    openclaw config set mcpServers.agenticmeadows.args '"/sandbox/mcp-server/server.py"' 2>/dev/null || true

    # Install skills
    for skill_dir in /sandbox/skills/*/; do
        if [ -f "$skill_dir/SKILL.md" ]; then
            skill_name=$(basename "$skill_dir")
            echo "  ✅ Loaded skill: $skill_name"
        fi
    done

    echo "  ✅ OpenClaw agent configured with AgenticMeadows MCP server"
    echo "  ✅ $(ls -d /sandbox/skills/*/ 2>/dev/null | wc -l | tr -d ' ') skills loaded"
else
    echo "  ℹ️  OpenClaw CLI not in PATH — using built-in ReAct engine"
    echo "  ℹ️  Install: npm install -g @anthropic/openclaw"
fi

export NEMOCLAW_SANDBOX_ACTIVE="$NEMOCLAW_ACTIVE"
export OPENCLAW_ACTIVE="$OPENCLAW_ACTIVE"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  AgenticMeadows Agent Status:"
echo "    OpenClaw:   ${OPENCLAW_ACTIVE}"
echo "    NemoClaw:   ${NEMOCLAW_ACTIVE}"
echo "    Inference:  ${NEMOCLAW_INFERENCE_MODE}"
echo "    Model:      ${OLLAMA_MODEL}"
echo "    MCP Tools:  17 (clients, jobs, quotes, invoices, etc.)"
echo "    Skills:     $(ls -d /sandbox/skills/*/ 2>/dev/null | wc -l | tr -d ' ')"
echo "    Port:       8000"
echo "    Platform:   $(uname -s)/$(uname -m)"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Start the AI service ──────────────────────────────────────────────────
cd /sandbox/ai-service
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
