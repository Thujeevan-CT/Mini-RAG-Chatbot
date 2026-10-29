# Mini RAG Chatbot

A minimal **Retrieval-Augmented Generation (RAG)** app in plain Python — built to study the pipeline.

Upload company PDFs → chunk → embed with **Gemini** → store in **Chroma** → retrieve relevant chunks → answer with **Gemini** using only those excerpts.

**Stack:** FastAPI · vanilla HTML/JS · `google-genai` · Chroma · pypdf · no LangChain.

---

## What you learn

| Step | Where in code |
| --- | --- |
| Load settings | `rag/config.py` |
| Extract PDF text | `rag/pdf.py` |
| Split into chunks | `rag/chunk.py` |
| Embed chunks | `rag/embed.py` |
| Vector store | `rag/store.py` |
| Retrieve top‑k | `rag/retrieve.py` |
| Grounded answer | `rag/answer.py` |
| HTTP API + UI | `main.py`, `static/` |

Turn **Dev mode** on in the UI to see retrieved sources and chunk previews while debugging.

---

## Recommended models (free tier)

In `.env` (see `.env.example`):

```env
GEMINI_CHAT_MODEL=gemini-3.5-flash-lite
GEMINI_EMBED_MODEL=gemini-embedding-001
```

These are suitable for learning and local experiments on [Google AI Studio’s free tier](https://aistudio.google.com/apikey). Quotas and model names can change — verify in AI Studio before you ship anything serious.

---

## Quick start

```bash
cd app
chmod +x run.sh
./run.sh
```

First run creates `.venv` and `.env` if needed. Add `GEMINI_API_KEY`, then run `./run.sh` again.

Open **http://127.0.0.1:8000**

**Manual setup** (same result):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set GEMINI_API_KEY
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

---

## Try it

1. Upload **`sample_Zentrix_Software_Company_Handbook.pdf`** (included) in **Document library**.
2. Open **Chat** and ask e.g. *What are the office hours?*
3. Use **`sample-questions.md`** for fact checks, hallucination tests, and follow-ups.

API reference: **http://127.0.0.1:8000/docs**

---

## Data on disk (gitignored)

| Path | Purpose |
| --- | --- |
| `data/uploads/` | Original PDFs |
| `data/documents/` | Chunk metadata (JSON) |
| `data/chroma/` | Embeddings |

Never commit `.env` or `data/`.

---

## License

use freely for learning and experimentation.
