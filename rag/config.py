"""Load settings from environment and ensure data directories exist."""

from pathlib import Path

from dotenv import load_dotenv
import os

APP_DIR = Path(__file__).resolve().parent.parent
load_dotenv(APP_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001").strip()

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
TOP_K = 4
CHAT_TEMPERATURE = 0.2
CHAT_MAX_OUTPUT_TOKENS = 512

UPLOADS_DIR = APP_DIR / "data" / "uploads"
CHROMA_DIR = APP_DIR / "data" / "chroma"

def ensure_data_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)


def validate_settings() -> None:
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is missing. Copy app/.env.example to app/.env and set your key."
        )
