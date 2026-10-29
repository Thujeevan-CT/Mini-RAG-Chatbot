"""Gemini embedding helpers."""

from google import genai

from rag import config

_client: genai.Client | None = None

BATCH_SIZE = 100


def _client_instance() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = _client_instance()
    vectors: list[list[float]] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        response = client.models.embed_content(
            model=config.GEMINI_EMBED_MODEL,
            contents=batch,
        )
        for item in response.embeddings:
            vectors.append(list(item.values))

    return vectors
