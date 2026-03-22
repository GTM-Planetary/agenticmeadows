#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
NC='\033[0m'
BOLD='\033[1m'

echo "Stopping AgenticMeadows..."
docker compose down

echo ""
echo -e "${GREEN}${BOLD}✅ All services stopped.${NC}"
echo "Your data is preserved. Run ./start.sh to restart."
