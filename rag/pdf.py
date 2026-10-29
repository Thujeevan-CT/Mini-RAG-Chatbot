"""Extract text from PDF files, page by page."""

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


def extract_pages_from_bytes(data: bytes) -> list[str]:
    reader = PdfReader(BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return pages


def extract_pages_from_path(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return pages
