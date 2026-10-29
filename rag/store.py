"""Chroma vector store for document chunks."""

from typing import Any

import chromadb

from rag import config

COLLECTION_NAME = "rag_chunks"

_client: chromadb.PersistentClient | None = None
_collection: Any | None = None


def _collection_instance():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def upsert_chunks(doc_id: str, filename: str, chunks: list[dict[str, Any]], embeddings: list[list[float]]) -> None:
    if len(chunks) != len(embeddings):
        raise ValueError("Chunk and embedding counts must match.")

    collection = _collection_instance()
    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for chunk, vector in zip(chunks, embeddings, strict=True):
        chunk_index = int(chunk["chunk_index"])
        ids.append(f"{doc_id}:{chunk_index}")
        documents.append(str(chunk["text"]))
        metadatas.append(
            {
                "doc_id": doc_id,
                "filename": filename,
                "page": int(chunk["page"]),
                "chunk_index": chunk_index,
            }
        )

    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )


def delete_document(doc_id: str) -> None:
    collection = _collection_instance()
    collection.delete(where={"doc_id": doc_id})


def chunk_count() -> int:
    collection = _collection_instance()
    return int(collection.count())


def _distance_to_score(distance: float) -> float:
    """Map Chroma cosine distance to a 0–1 similarity-style score."""
    score = 1.0 - float(distance)
    return max(0.0, min(1.0, round(score, 4)))


def query_similar(query_embedding: list[float], n_results: int) -> list[dict[str, Any]]:
    collection = _collection_instance()
    total = collection.count()
    if total == 0:
        return []

    k = max(1, min(n_results, total))
    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=k,
        include=["documents", "metadatas", "distances"],
    )

    documents_out = result.get("documents") or [[]]
    metadatas_out = result.get("metadatas") or [[]]
    distances_out = result.get("distances") or [[]]

    hits: list[dict[str, Any]] = []
    for text, meta, distance in zip(
        documents_out[0],
        metadatas_out[0],
        distances_out[0],
        strict=True,
    ):
        meta = meta or {}
        body = str(text or "")
        hits.append(
            {
                "filename": str(meta.get("filename", "")),
                "page": int(meta.get("page", 0)),
                "chunk_index": int(meta.get("chunk_index", 0)),
                "doc_id": str(meta.get("doc_id", "")),
                "score": _distance_to_score(distance),
                "snippet": body[:400] + ("…" if len(body) > 400 else ""),
                "text": body,
            }
        )
    return hits
