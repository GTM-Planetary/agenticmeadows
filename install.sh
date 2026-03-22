#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ── Banner ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       AgenticMeadows Installer        ║"
echo "  ║  AI-Powered Landscaping Management    ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ── Detect OS ─────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
IS_WSL=false
if [ -f /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=true
fi

echo -e "${BLUE}Detected:${NC} $OS ($ARCH)${IS_WSL:+ (WSL)}"
echo ""

# ── Helper: command exists ────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

# ── Step 1: Check/Install Git ─────────────────────────────────────────────
echo -e "${BOLD}[1/5] Checking Git...${NC}"
if has git; then
  echo -e "  ${GREEN}✓${NC} Git $(git --version | awk '{print $3}')"
else
  echo -e "  ${YELLOW}Installing Git...${NC}"
  case "$OS" in
    Darwin)
      xcode-select --install 2>/dev/null || true
      ;;
    Linux)
      if has apt-get; then sudo apt-get update -qq && sudo apt-get install -y -qq git
      elif has yum; then sudo yum install -y git
      elif has pacman; then sudo pacman -S --noconfirm git
      fi
      ;;
  esac
  if has git; then
    echo -e "  ${GREEN}✓${NC} Git installed"
  else
    echo -e "  ${RED}✗ Failed to install Git. Please install manually.${NC}"
    exit 1
  fi
fi

# ── Step 2: Check/Install Docker ──────────────────────────────────────────
echo -e "${BOLD}[2/5] Checking Docker...${NC}"
DOCKER_OK=false
if has docker && docker compose version &>/dev/null; then
  DOCKER_OK=true
  echo -e "  ${GREEN}✓${NC} Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  echo -e "  ${GREEN}✓${NC} Docker Compose $(docker compose version --short 2>/dev/null || echo 'available')"
fi

if [ "$DOCKER_OK" = false ]; then
  echo -e "  ${YELLOW}Docker not found. Installing...${NC}"
  case "$OS" in
    Darwin)
      if [ "$ARCH" = "arm64" ]; then
        DMG_URL="https://desktop.docker.com/mac/main/arm64/Docker.dmg"
      else
        DMG_URL="https://desktop.docker.com/mac/main/amd64/Docker.dmg"
      fi
      echo "  Downloading Docker Desktop..."
      curl -fsSL -o /tmp/Docker.dmg "$DMG_URL"
      echo ""
      echo -e "  ${YELLOW}${BOLD}Action required:${NC}"
      echo "    1. Install Docker Desktop from the opened DMG"
      echo "    2. Drag Docker to Applications"
      echo "    3. Open Docker from Applications"
      echo "    4. Wait for the whale icon in your menu bar"
      echo "    5. Re-run this installer"
      open /tmp/Docker.dmg
      exit 0
      ;;
    Linux)
      if [ "$IS_WSL" = true ]; then
        echo ""
        echo -e "  ${YELLOW}${BOLD}Docker Desktop for Windows is required.${NC}"
        echo "  Install from: https://www.docker.com/products/docker-desktop/"
        echo "  Enable 'Use WSL 2 based engine' in Docker Desktop settings."
        echo "  Then re-run this installer."
        exit 0
      fi
      echo "  Installing Docker Engine..."
      curl -fsSL https://get.docker.com | sudo sh
      sudo usermod -aG docker "$USER" 2>/dev/null || true
      echo -e "  ${GREEN}✓${NC} Docker installed"
      echo -e "  ${YELLOW}Note: You may need to log out and back in for Docker permissions.${NC}"
      ;;
  esac
fi

# ── Step 3: Verify Docker is running ──────────────────────────────────────
echo -e "${BOLD}[3/5] Verifying Docker is running...${NC}"
if ! docker info &>/dev/null; then
  echo -e "  ${YELLOW}Docker daemon not running. Attempting to start...${NC}"
  if [ "$OS" = "Darwin" ]; then
    open -a Docker 2>/dev/null || true
    echo "  Waiting for Docker to start..."
    for i in $(seq 1 30); do
      if docker info &>/dev/null; then break; fi
      sleep 2
    done
  fi
  if ! docker info &>/dev/null; then
    echo -e "  ${RED}✗ Docker is not running. Please start Docker Desktop and re-run.${NC}"
    exit 1
  fi
fi
echo -e "  ${GREEN}✓${NC} Docker is running"

# ── Step 4: Clone or update repo ──────────────────────────────────────────
echo -e "${BOLD}[4/5] Setting up AgenticMeadows...${NC}"
INSTALL_DIR="${AGENTICMEADOWS_DIR:-$HOME/agenticmeadows}"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Found existing installation at $INSTALL_DIR"
  echo "  Updating..."
  cd "$INSTALL_DIR"
  git pull origin main 2>/dev/null || echo "  (skipped git pull — may be on a local branch)"
else
  echo "  Cloning to $INSTALL_DIR..."
  git clone https://github.com/GTM-Planetary/agenticmeadows.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Step 5: Build and start ───────────────────────────────────────────────
echo -e "${BOLD}[5/5] Starting AgenticMeadows...${NC}"
echo "  Building images (first run may take 5-10 minutes)..."
docker compose build --quiet 2>/dev/null || docker compose build
echo "  Starting services..."
docker compose up -d

echo ""
echo "  Waiting for services to be ready..."
READY=false
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001 >/dev/null 2>&1; then
    READY=true
    break
  fi
  printf "."
  sleep 5
done
echo ""

if [ "$READY" = true ]; then
  # Open browser
  if [ "$OS" = "Darwin" ]; then
    open "http://localhost:3001" 2>/dev/null || true
  elif has xdg-open; then
    xdg-open "http://localhost:3001" 2>/dev/null || true
  elif has wslview; then
    wslview "http://localhost:3001" 2>/dev/null || true
  fi

  echo ""
  echo -e "${GREEN}${BOLD}  ✅ AgenticMeadows is running!${NC}"
  echo ""
  echo -e "  🌐 Open:  ${CYAN}http://localhost:3001${NC}"
  echo -e "  📁 Path:  ${CYAN}$INSTALL_DIR${NC}"
  echo ""
  echo -e "  ${BOLD}Commands:${NC}"
  echo -e "    Start:   ${CYAN}cd $INSTALL_DIR && ./start.sh${NC}"
  echo -e "    Stop:    ${CYAN}cd $INSTALL_DIR && ./stop.sh${NC}"
  echo -e "    Update:  ${CYAN}cd $INSTALL_DIR && ./update.sh${NC}"
  echo ""
  echo -e "  ${BOLD}First time?${NC} Create your admin account at the setup wizard."
  echo ""
else
  echo -e "  ${YELLOW}Services are still starting. This is normal on first run.${NC}"
  echo -e "  Check status: ${CYAN}cd $INSTALL_DIR && docker compose ps${NC}"
  echo -e "  Once ready:   ${CYAN}http://localhost:3001${NC}"
fi
