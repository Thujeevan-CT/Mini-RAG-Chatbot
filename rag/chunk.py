"""Split document text into overlapping chunks."""

from dataclasses import dataclass

from rag import config


@dataclass(frozen=True)
class Chunk:
    page: int
    chunk_index: int
    text: str


def _find_break(text: str, start: int, end: int, min_pos: int) -> int:
    window = text[start:end]
    for sep in ("\n\n", "\n", " "):
        idx = window.rfind(sep)
        if idx >= min_pos:
            return start + idx + len(sep)
    return end


def chunk_page_text(page_text: str, page: int, start_index: int) -> tuple[list[Chunk], int]:
    text = page_text.strip()
    if not text:
        return [], start_index

    size = config.CHUNK_SIZE
    overlap = config.CHUNK_OVERLAP
    chunks: list[Chunk] = []
    start = 0
    index = start_index

    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            min_break = max(0, size // 2)
            end = _find_break(text, start, end, min_break)

        piece = text[start:end].strip()
        if piece:
            chunks.append(Chunk(page=page, chunk_index=index, text=piece))
            index += 1

        if end >= len(text):
            break
        start = max(start + 1, end - overlap)

    return chunks, index


def chunk_document(pages: list[str]) -> list[Chunk]:
    all_chunks: list[Chunk] = []
    next_index = 0
    for i, page_text in enumerate(pages, start=1):
        page_chunks, next_index = chunk_page_text(page_text, page=i, start_index=next_index)
        all_chunks.extend(page_chunks)
    return all_chunks
