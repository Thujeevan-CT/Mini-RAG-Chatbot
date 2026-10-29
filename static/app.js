async function checkHealth() {
  const el = document.getElementById("health-status");
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok) {
      el.textContent = "API connected";
      el.classList.add("ok");
      return;
    }
    throw new Error("Unexpected response");
  } catch (err) {
    el.textContent = `API unreachable · ${err.message}`;
    el.classList.add("error");
  }
}

function apiErrorMessage(data, fallback) {
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return fallback;
}

const DEV_MODE_STORAGE_KEY = "small-rag-chat-dev-mode";

function isDevMode() {
  return localStorage.getItem(DEV_MODE_STORAGE_KEY) === "true";
}

function setDevMode(enabled) {
  localStorage.setItem(DEV_MODE_STORAGE_KEY, enabled ? "true" : "false");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripInlineCitations(text) {
  let out = String(text);
  out = out.replace(/\s*\([^)]*\bpage\s+\d+[^)]*\)/gi, "");
  out = out.replace(/\s*\([^)]*\.pdf[^)]*\)/gi, "");
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

function assistantDisplayText(rawContent, devMode) {
  return devMode ? rawContent : stripInlineCitations(rawContent);
}

function renderSources(sources) {
  if (!sources?.length) return "";
  return `<ul class="chat-sources">${sources
    .map(
      (r) => `
      <li class="source-card">
        <div class="source-card__head">
          <span class="source-card__file">${escapeHtml(r.filename)}</span>
          <span class="source-card__meta">Page ${r.page}</span>
          <span class="source-card__score">${Number(r.score).toFixed(2)}</span>
        </div>
        <p class="source-card__snippet">${escapeHtml(r.snippet || "")}</p>
      </li>`
    )
    .join("")}</ul>`;
}

let cachedDocuments = [];
let chatUi = null;

async function fetchDocumentList() {
  const res = await fetch("/api/documents");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, `HTTP ${res.status}`));
  }
  cachedDocuments = data.documents || [];
  return cachedDocuments;
}

function indexedDocumentCount(docs = cachedDocuments) {
  return docs.filter((d) => d.indexed).length;
}

function applyGlobalDevMode() {
  const on = isDevMode();
  const devSwitch = document.getElementById("dev-mode-switch");
  if (devSwitch) devSwitch.checked = on;

  document.getElementById("panel-library")?.classList.toggle("dev-mode", on);
  document.querySelector(".panel--chat")?.classList.toggle("dev-mode", on);

  const libraryDesc = document.getElementById("library-panel-desc");
  if (libraryDesc) {
    libraryDesc.textContent = on
      ? "Dev mode: upload shows chunk previews. PDFs are chunked, embedded, and stored in Chroma."
      : "Upload PDFs to add them to your knowledge base.";
  }

  const chatDesc = document.getElementById("chat-panel-desc");
  if (chatDesc) {
    chatDesc.textContent = on
      ? "Dev mode: answers show source excerpts, scores, and inline citations."
      : "Ask questions about your uploaded company documents.";
  }

  chatUi?.renderTranscript?.();
}

function setupGlobalDevMode() {
  const devSwitch = document.getElementById("dev-mode-switch");
  devSwitch.addEventListener("change", () => {
    setDevMode(devSwitch.checked);
    applyGlobalDevMode();
  });
  applyGlobalDevMode();
}

function showView(viewId) {
  document.querySelectorAll(".view-nav__btn").forEach((btn) => {
    const active = btn.dataset.view === viewId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll(".view").forEach((el) => {
    const id = el.id.replace("view-", "");
    const active = id === viewId;
    el.classList.toggle("is-active", active);
    el.hidden = !active;
  });

  history.replaceState(null, "", viewId === "chat" ? "#chat" : "#library");
}

function setupUpload() {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("pdf-file");
  const fileLabel = document.getElementById("file-label");
  const uploadBtn = document.getElementById("upload-btn");
  const statusEl = document.getElementById("upload-status");
  const resultEl = document.getElementById("upload-result");
  const statsEl = document.getElementById("upload-stats");
  const chunksEl = document.getElementById("chunk-preview");
  const successActions = document.getElementById("upload-success-actions");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      fileLabel.textContent = file.name;
      fileLabel.classList.add("has-file");
      uploadBtn.disabled = false;
    } else {
      fileLabel.textContent = "Choose a PDF…";
      fileLabel.classList.remove("has-file");
      uploadBtn.disabled = true;
    }
    statusEl.textContent = "";
    statusEl.className = "upload-status";
    resultEl.hidden = true;
    successActions.hidden = true;
  });

  document.getElementById("go-to-chat").addEventListener("click", () => {
    showView("chat");
    document.getElementById("chat-input")?.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) return;

    uploadBtn.disabled = true;
    statusEl.textContent = "Uploading and indexing…";
    statusEl.className = "upload-status";
    resultEl.hidden = true;
    successActions.hidden = true;

    const body = new FormData();
    body.append("file", file);
    const includeChunks = isDevMode() ? "true" : "false";

    try {
      const res = await fetch(`/api/documents?include_chunks=${includeChunks}`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, `HTTP ${res.status}`));
      }

      statusEl.textContent = `"${data.filename}" added — ${data.page_count} pages, ${data.chunk_count} chunks indexed.`;
      statusEl.className = "upload-status success";
      successActions.hidden = false;

      if (isDevMode()) {
        statsEl.innerHTML = `
          <li>${data.page_count} pages</li>
          <li>${data.chunk_count} chunks</li>
          <li>indexed</li>
          <li>${escapeHtml(data.filename)}</li>
        `;
        chunksEl.innerHTML = (data.chunks || [])
          .slice(0, 8)
          .map(
            (c) => `
            <li class="chunk-item">
              <span class="chunk-meta">Page ${c.page} · chunk ${c.chunk_index}</span>
              ${escapeHtml(c.text.slice(0, 280))}${c.text.length > 280 ? "…" : ""}
            </li>`
          )
          .join("");
        if ((data.chunks || []).length > 8) {
          chunksEl.insertAdjacentHTML(
            "beforeend",
            `<li class="chunk-item"><span class="chunk-meta">Preview</span>Showing 8 of ${data.chunk_count} chunks.</li>`
          );
        }
        resultEl.hidden = false;
      }

      await loadDocuments();
      await chatUi?.syncComposer?.();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = "upload-status error";
    } finally {
      uploadBtn.disabled = !fileInput.files?.[0];
    }
  });
}

async function loadDocuments() {
  const listEl = document.getElementById("doc-list");
  const statusEl = document.getElementById("doc-list-status");

  try {
    const docs = await fetchDocumentList();
    statusEl.textContent = docs.length ? `${docs.length} document(s)` : "";
    statusEl.className = "upload-status";

    if (!docs.length) {
      listEl.innerHTML = `<li class="doc-list__empty">No documents yet. Upload a PDF above.</li>`;
      await chatUi?.syncComposer?.();
      return docs;
    }

    listEl.innerHTML = docs
      .map(
        (doc) => `
        <li class="doc-row" data-doc-id="${escapeHtml(doc.doc_id)}">
          <div class="doc-row__main">
            <p class="doc-row__name">${escapeHtml(doc.filename)}</p>
            <ul class="doc-row__meta">
              <li>${doc.page_count} pages</li>
              <li>${doc.chunk_count} chunks</li>
              <li class="${doc.indexed ? "is-indexed" : ""}">${doc.indexed ? "indexed" : "not indexed"}</li>
            </ul>
          </div>
          <button type="button" class="btn btn--danger" data-delete="${escapeHtml(doc.doc_id)}">Delete</button>
        </li>`
      )
      .join("");

    listEl.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteDocument(btn.dataset.delete));
    });

    await chatUi?.syncComposer?.();
    return docs;
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "upload-status error";
    listEl.innerHTML = "";
    return [];
  }
}

async function deleteDocument(docId) {
  const statusEl = document.getElementById("doc-list-status");
  if (!docId) return;
  if (!confirm("Delete this document and its vectors?")) return;

  statusEl.textContent = "Deleting…";
  statusEl.className = "upload-status";

  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(data, `HTTP ${res.status}`));
    }
    await loadDocuments();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "upload-status error";
  }
}

function setupViews() {
  document.querySelectorAll(".view-nav__btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const viewId = btn.dataset.view;
      showView(viewId);
      if (viewId === "library") {
        await loadDocuments();
      } else {
        await chatUi?.syncComposer?.();
      }
    });
  });

  const hash = location.hash.replace("#", "");
  showView(hash === "chat" ? "chat" : "library");

  window.addEventListener("hashchange", async () => {
    const next = location.hash.replace("#", "") === "chat" ? "chat" : "library";
    showView(next);
    if (next === "library") await loadDocuments();
    else await chatUi?.syncComposer?.();
  });
}

function setupLibrary() {
  document.getElementById("refresh-docs").addEventListener("click", loadDocuments);
  loadDocuments();
}

function setupChat() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("chat-send-btn");
  const errorEl = document.getElementById("chat-error");
  const logEl = document.getElementById("chat-log");
  let history = [];
  /** @type {{ role: string, content: string, sources?: object[] }[]} */
  let transcript = [];
  let loadingEl = null;

  function setChatError(message) {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function showResponseLoading() {
    removeResponseLoading();
    loadingEl = document.createElement("div");
    loadingEl.className = "chat-msg chat-msg--assistant chat-msg--loading";
    loadingEl.setAttribute("aria-busy", "true");
    loadingEl.innerHTML = `
      <div class="chat-loading">
        <span class="chat-loading__dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="chat-loading__text">${isDevMode() ? "Retrieving and generating…" : "Thinking…"}</span>
      </div>`;
    logEl.appendChild(loadingEl);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function removeResponseLoading() {
    if (loadingEl?.parentNode) loadingEl.remove();
    loadingEl = null;
  }

  function appendChatError(message) {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg chat-msg--error";
    wrap.textContent = message;
    logEl.appendChild(wrap);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderTranscript() {
    removeResponseLoading();
    const indexed = indexedDocumentCount();

    if (!transcript.length) {
      if (indexed === 0) {
        logEl.innerHTML = `<p class="chat-log__empty">No indexed documents yet. Upload a PDF in <strong>Document library</strong>, then ask questions here.</p>`;
      } else {
        logEl.innerHTML = `<p class="chat-log__empty">Ask a question about your uploaded documents.</p>`;
      }
      return;
    }

    logEl.innerHTML = "";
    const devMode = isDevMode();
    for (const msg of transcript) {
      const wrap = document.createElement("div");
      wrap.className = `chat-msg chat-msg--${msg.role === "user" ? "user" : "assistant"}`;

      if (msg.role === "assistant") {
        const body = assistantDisplayText(msg.content, devMode);
        wrap.innerHTML = `
          <span class="chat-msg__label">Assistant</span>
          <div class="chat-msg__body">${escapeHtml(body)}</div>
          ${devMode ? renderSources(msg.sources) : ""}`;
      } else {
        wrap.innerHTML = `
          <span class="chat-msg__label">You</span>
          <div class="chat-msg__body">${escapeHtml(msg.content)}</div>`;
      }

      logEl.appendChild(wrap);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function syncComposer() {
    try {
      await fetchDocumentList();
    } catch {
      /* loadDocuments / chat error surfaces elsewhere */
    }
    const indexed = indexedDocumentCount();
    const canChat = indexed > 0;
    const busy = Boolean(loadingEl);

    input.disabled = !canChat || busy;
    btn.disabled = !canChat || busy;
    input.placeholder = canChat
      ? "Ask about your company docs…"
      : "Upload and index a PDF in Document library first…";

    if (!transcript.length) {
      renderTranscript();
    }
    return indexed;
  }

  chatUi = { renderTranscript, syncComposer };

  renderTranscript();
  syncComposer();

  function appendMessage(role, content, sources) {
    const entry = { role, content };
    if (role === "assistant") entry.sources = sources || [];
    transcript.push(entry);
    renderTranscript();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) {
      setChatError("Enter a message first.");
      return;
    }
    if (indexedDocumentCount() === 0) {
      setChatError("Upload an indexed PDF in Document library before chatting.");
      return;
    }

    setChatError("");
    appendMessage("user", message);
    input.value = "";
    btn.disabled = true;
    input.disabled = true;
    showResponseLoading();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, `HTTP ${res.status}`));
      }

      removeResponseLoading();
      appendMessage("assistant", data.answer, data.sources);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: data.answer });
      if (history.length > 16) history = history.slice(-16);
    } catch (err) {
      removeResponseLoading();
      appendChatError(err.message);
    } finally {
      await syncComposer();
      input.focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

checkHealth();
setupGlobalDevMode();
setupUpload();
setupChat();
applyGlobalDevMode();
setupViews();
setupLibrary();
