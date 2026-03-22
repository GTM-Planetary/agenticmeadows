#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}Updating AgenticMeadows...${NC}"

echo "Pulling latest changes..."
git pull origin main

echo "Rebuilding images..."
docker compose build

echo "Restarting services..."
docker compose up -d

echo ""
echo "Waiting for services..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001 >/dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}${BOLD}✅ AgenticMeadows updated and running at ${CYAN}http://localhost:3001${NC}"
    exit 0
  fi
  printf "."
  sleep 5
done

echo ""
echo -e "${YELLOW}Services are still starting. Check: docker compose ps${NC}"
