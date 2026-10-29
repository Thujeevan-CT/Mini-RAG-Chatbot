"""
Small RAG Chatbot — FastAPI entrypoint.

Run: ./run.sh   (or see README.md)
"""

from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel, Field

from rag import config
from rag import answer
from rag import documents
from rag import retrieve

config.validate_settings()
config.ensure_data_dirs()

app = FastAPI(title="Small RAG Chatbot", version="0.1.0")

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def _http_error_from_value(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


class RetrieveRequest(BaseModel):
    message: str = Field(..., min_length=1)


@app.post("/api/retrieve")
def search_documents(body: RetrieveRequest) -> dict[str, Any]:
    try:
        results = retrieve.retrieve_chunks(body.message)
    except ValueError as exc:
        raise _http_error_from_value(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Retrieval failed: {exc}") from exc

    return {"query": body.message.strip(), "results": results}


class ChatTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatTurn] | None = None


@app.post("/api/chat")
def chat(body: ChatRequest) -> dict[str, Any]:
    history = [{"role": t.role, "content": t.content} for t in body.history or []]
    try:
        result = answer.answer_question(body.message, history=history or None)
    except ValueError as exc:
        raise _http_error_from_value(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chat failed: {exc}") from exc

    return result


@app.get("/api/documents")
def list_documents() -> dict[str, Any]:
    return {"documents": documents.list_documents()}


@app.post("/api/documents")
async def upload_document(
    file: UploadFile = File(...),
    include_chunks: bool = Query(False, description="Include full chunk text in the response"),
) -> dict[str, Any]:
    raw = await file.read()
    try:
        record = documents.ingest_pdf(file.filename or "document.pdf", raw)
    except ValueError as exc:
        raise _http_error_from_value(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Indexing failed: {exc}") from exc

    return documents.public_record(record, include_chunks=include_chunks)


@app.delete("/api/documents/{doc_id}")
def remove_document(doc_id: str) -> dict[str, bool]:
    try:
        documents.delete_document(doc_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Document not found.") from exc
    return {"ok": True}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
