#!/usr/bin/env bash
# One-command local run from the app folder: ./run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required."
  exit 1
fi

if [[ ! -d .venv ]]; then
  echo "Creating virtual environment…"
  python3 -m venv .venv
fi

# shellcheck source=/dev/null
source .venv/bin/activate

pip install -q -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo "Created .env from .env.example"
  echo "Add your GEMINI_API_KEY (free): https://aistudio.google.com/apikey"
  echo "Then run: ./run.sh"
  exit 1
fi

if ! grep -qE '^GEMINI_API_KEY=.+' .env; then
  echo "Set GEMINI_API_KEY in .env (free key: https://aistudio.google.com/apikey)"
  exit 1
fi

echo "Starting server at http://127.0.0.1:8000"
exec uvicorn main:app --reload --host 127.0.0.1 --port 8000
