#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${GREEN}${BOLD}Starting AgenticMeadows...${NC}"

# Check Docker is running
if ! docker info &>/dev/null; then
  echo -e "${YELLOW}Docker is not running. Attempting to start...${NC}"
  if [ "$(uname -s)" = "Darwin" ]; then
    open -a Docker 2>/dev/null || true
    echo "Waiting for Docker to start..."
    for i in $(seq 1 30); do
      if docker info &>/dev/null; then break; fi
      sleep 2
    done
  fi
  if ! docker info &>/dev/null; then
    echo "Error: Docker is not running. Please start Docker Desktop and try again."
    exit 1
  fi
fi

docker compose up -d

echo ""
echo "Waiting for services to be ready..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001 >/dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}${BOLD}✅ AgenticMeadows is running at ${CYAN}http://localhost:3001${NC}"

    # Open browser
    OS="$(uname -s)"
    if [ "$OS" = "Darwin" ]; then
      open "http://localhost:3001" 2>/dev/null || true
    elif command -v xdg-open &>/dev/null; then
      xdg-open "http://localhost:3001" 2>/dev/null || true
    elif command -v wslview &>/dev/null; then
      wslview "http://localhost:3001" 2>/dev/null || true
    fi
    exit 0
  fi
  printf "."
  sleep 5
done

echo ""
echo -e "${YELLOW}Services are still starting. Check: docker compose ps${NC}"
