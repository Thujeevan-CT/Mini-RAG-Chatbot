"""Persist uploaded documents, chunk them, and index in Chroma."""

import json
import uuid
from pathlib import Path
from typing import Any

from rag import config
from rag.chunk import Chunk, chunk_document
from rag import embed
from rag.pdf import extract_pages_from_bytes
from rag import store

META_DIR = config.APP_DIR / "data" / "documents"


def _meta_path(doc_id: str) -> Path:
    META_DIR.mkdir(parents=True, exist_ok=True)
    return META_DIR / f"{doc_id}.json"


def _chunk_to_dict(doc_id: str, filename: str, chunk: Chunk) -> dict[str, Any]:
    return {
        "doc_id": doc_id,
        "filename": filename,
        "page": chunk.page,
        "chunk_index": chunk.chunk_index,
        "text": chunk.text,
    }


def _load_record(doc_id: str) -> dict[str, Any]:
    path = _meta_path(doc_id)
    if not path.is_file():
        raise KeyError(doc_id)
    return json.loads(path.read_text(encoding="utf-8"))


def _save_record(record: dict[str, Any]) -> None:
    _meta_path(record["doc_id"]).write_text(
        json.dumps(record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _index_record(record: dict[str, Any]) -> None:
    chunk_dicts = record["chunks"]
    texts = [str(c["text"]) for c in chunk_dicts]
    vectors = embed.embed_texts(texts)
    store.upsert_chunks(record["doc_id"], record["filename"], chunk_dicts, vectors)
    record["indexed"] = True
    _save_record(record)


def ingest_pdf(filename: str, data: bytes) -> dict[str, Any]:
    if not data:
        raise ValueError("The uploaded file is empty.")

    name = (filename or "").strip()
    if not name.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are supported.")

    pages = extract_pages_from_bytes(data)
    if not pages:
        raise ValueError("Could not read any pages from this PDF.")

    chunks = chunk_document(pages)
    if not chunks:
        raise ValueError(
            "No text could be extracted from this PDF. Scanned image PDFs are not supported."
        )

    doc_id = str(uuid.uuid4())
    stored_name = f"{doc_id}.pdf"
    pdf_path = config.UPLOADS_DIR / stored_name
    pdf_path.write_bytes(data)

    chunk_dicts = [_chunk_to_dict(doc_id, name, c) for c in chunks]
    record: dict[str, Any] = {
        "doc_id": doc_id,
        "filename": name,
        "stored_path": stored_name,
        "page_count": len(pages),
        "chunk_count": len(chunks),
        "indexed": False,
        "chunks": chunk_dicts,
    }
    _save_record(record)
    _index_record(record)

    return record


def list_documents() -> list[dict[str, Any]]:
    if not META_DIR.is_dir():
        return []

    items: list[dict[str, Any]] = []
    for path in sorted(META_DIR.glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        items.append(
            {
                "doc_id": record["doc_id"],
                "filename": record["filename"],
                "page_count": record["page_count"],
                "chunk_count": record["chunk_count"],
                "indexed": bool(record.get("indexed")),
            }
        )
    items.sort(key=lambda d: d["filename"].lower())
    return items


def delete_document(doc_id: str) -> None:
    record = _load_record(doc_id)

    store.delete_document(doc_id)

    pdf_path = config.UPLOADS_DIR / record["stored_path"]
    if pdf_path.is_file():
        pdf_path.unlink()

    _meta_path(doc_id).unlink(missing_ok=True)


def public_record(record: dict[str, Any], include_chunks: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "doc_id": record["doc_id"],
        "filename": record["filename"],
        "page_count": record["page_count"],
        "chunk_count": record["chunk_count"],
        "indexed": bool(record.get("indexed")),
    }
    if include_chunks:
        payload["chunks"] = record["chunks"]
    return payload
