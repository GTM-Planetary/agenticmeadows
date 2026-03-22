#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Find the backend container ────────────────────────────────────────────
CONTAINER=$(docker compose ps --format '{{.Name}}' 2>/dev/null | grep -E 'backend' | head -1)
if [ -z "$CONTAINER" ]; then
  echo -e "${RED}Error: Backend container is not running.${NC}"
  echo "Start AgenticMeadows first: ./start.sh"
  exit 1
fi

echo -e "${BOLD}AgenticMeadows Password Reset${NC}"
echo ""

# ── Get email ─────────────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  EMAIL="$1"
else
  # List users
  echo "Current users:"
  docker exec "$CONTAINER" node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRaw\`SELECT email, role, \"isActive\" FROM \"User\" ORDER BY \"createdAt\"\`
      .then(u => { u.forEach(x => console.log('  ' + x.email + ' (' + x.role + ')' + (x.isActive === false ? ' [INACTIVE]' : ''))); process.exit(0); })
      .catch(e => { console.error(e.message); process.exit(1); });
  " 2>/dev/null || echo "  (could not list users)"
  echo ""
  read -rp "Email to reset: " EMAIL
fi

if [ -z "$EMAIL" ]; then
  echo -e "${RED}No email provided.${NC}"
  exit 1
fi

# ── Get new password ──────────────────────────────────────────────────────
if [ -n "${2:-}" ]; then
  NEWPASS="$2"
else
  read -rsp "New password (min 6 chars): " NEWPASS
  echo ""
  if [ ${#NEWPASS} -lt 6 ]; then
    echo -e "${RED}Password must be at least 6 characters.${NC}"
    exit 1
  fi
  read -rsp "Confirm password: " CONFIRM
  echo ""
  if [ "$NEWPASS" != "$CONFIRM" ]; then
    echo -e "${RED}Passwords do not match.${NC}"
    exit 1
  fi
fi

# ── Reset the password ────────────────────────────────────────────────────
RESULT=$(docker exec "$CONTAINER" node -e "
  const bcrypt = require('bcryptjs');
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  async function run() {
    const email = '$EMAIL';
    const pass = '$NEWPASS';
    const user = await p.\$queryRaw\`SELECT id, email, role FROM \"User\" WHERE email = \${email}\`;
    if (!user.length) { console.log('NOT_FOUND'); return; }
    const hash = await bcrypt.hash(pass, 10);
    await p.\$executeRaw\`UPDATE \"User\" SET \"passwordHash\" = \${hash} WHERE email = \${email}\`;
    console.log('OK:' + user[0].role);
  }
  run().then(() => process.exit(0)).catch(e => { console.log('ERROR:' + e.message); process.exit(0); });
" 2>/dev/null)

case "$RESULT" in
  OK:*)
    ROLE="${RESULT#OK:}"
    echo ""
    echo -e "${GREEN}${BOLD}Password reset successfully!${NC}"
    echo -e "  Email: ${CYAN}$EMAIL${NC}"
    echo -e "  Role:  ${CYAN}$ROLE${NC}"
    echo ""
    echo "You can now log in at http://localhost:3001"
    ;;
  NOT_FOUND)
    echo -e "${RED}No user found with email: $EMAIL${NC}"
    echo ""
    echo "To create a new admin account, use the onboarding wizard:"
    echo "  1. Stop the app: ./stop.sh"
    echo "  2. Clear the database: docker volume rm turfmindai_pg_data"
    echo "  3. Start fresh: ./start.sh"
    exit 1
    ;;
  ERROR:*)
    echo -e "${RED}Error: ${RESULT#ERROR:}${NC}"
    exit 1
    ;;
  *)
    echo -e "${RED}Unexpected error. Is the backend running?${NC}"
    exit 1
    ;;
esac
