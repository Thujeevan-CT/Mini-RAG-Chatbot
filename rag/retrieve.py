"""Search indexed chunks for a user question."""

from rag import config
from rag import documents
from rag import embed
from rag import store


def retrieve_chunks(query: str) -> list[dict]:
    message = query.strip()
    if not message:
        raise ValueError("Message cannot be empty.")

    indexed = [d for d in documents.list_documents() if d.get("indexed")]
    if not indexed:
        raise ValueError("No indexed documents yet. Upload a PDF in the library first.")

    if store.chunk_count() == 0:
        raise ValueError("The vector store is empty. Re-upload your PDFs to index them.")

    query_vector = embed.embed_texts([message])[0]
    return store.query_similar(query_vector, n_results=config.TOP_K)
