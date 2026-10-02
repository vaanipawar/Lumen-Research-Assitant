# Lumen — Research Paper Assistant

Upload a research paper, chat with it, highlight and annotate it, and keep notes — all backed by a local-embeddings RAG pipeline with hosted open-weight models for generation and figure captioning.

Built as a learning project: every line of both the backend and frontend was written and explained from scratch, with no prior React/JavaScript experience going in.

## Features

- **Upload & parse** — drag in a PDF, get it parsed into section-aware text chunks plus extracted figures
- **Multimodal understanding** — figures are captioned by a vision model at upload time, so questions about charts/tables retrieve correctly alongside text
- **Unified chat** — one chat mode handles paper-specific questions, general knowledge questions, and simplified "explain it to me" requests, judged per-question by the model itself rather than a manual toggle
- **Full annotation canvas** — highlighter, eraser, pins (with text notes and a small sketch canvas), and shape/freehand drawing tools, all layered directly on the PDF
- **Unified notes feed** — highlights, pins, and free-text notes all show up together in one list, editable in place, with auto-linkified URLs
- **Auth & per-user history** — real accounts (hashed passwords, JWT tokens), each user sees only their own papers, with a "Recent papers" sidebar to resume past work
- **Persistence across restarts** — papers, highlights, notes, annotations, and chat history all survive a server restart
- **RAG evaluation** — a RAGAS-based harness scoring faithfulness, answer relevancy, context precision, and context recall against the real `/chat` endpoint (see [Evaluation](#evaluation) below)

## Architecture

- **Backend**: FastAPI, `marker`-free PDF parsing via `pymupdf4llm`, local embeddings (`bge-small-en-v1.5` via `sentence-transformers`), ChromaDB as the vector store, Groq-hosted open-weight models (`openai/gpt-oss-20b` for text, a vision-capable model for figure captions) for generation
- **Frontend**: React + Vite, `react-pdf-highlighter` for the PDF viewer and highlight layer, a hand-built canvas-style overlay for pins/shapes, plain CSS (no framework) for styling
- **Storage**: no database — everything persists as per-paper JSON files on disk (`highlights.json`, `notes.json`, `annotations.json`, `chat_history.json`, `meta.json`) plus the original PDF and extracted figures
- **Auth**: JWT tokens, bcrypt-hashed passwords, a FastAPI dependency (`get_current_user`) checked on every paper-scoped route alongside an ownership check

## Project structure

```
Research Assitant/
├── app/                      # FastAPI backend
│   ├── main.py                # routes
│   ├── config.py               # settings (env vars)
│   ├── ingestion.py            # PDF parsing + chunking
│   ├── embeddings.py           # local embedding wrapper
│   ├── vectorstore.py          # Chroma wrapper
│   ├── llm.py                  # Groq calls (chat, summary, captioning)
│   ├── auth.py                  # password hashing, JWT
│   ├── users_storage.py        # users.json load/save
│   ├── notes_storage.py        # highlights/notes/annotations/chat_history JSON
│   └── schemas.py              # Pydantic request/response models
├── eval/                     # RAG evaluation harness
│   ├── test_questions.json
│   ├── run_eval.py             # calls the live API, saves results.json
│   └── score_eval.py           # scores results.json with RAGAS
├── data/                     # generated at runtime — not in version control
│   ├── papers/<paper_id>/     # original.pdf, figures/, meta.json, highlights.json, ...
│   └── chroma/                  # vector store
├── requirements.txt
├── eval-requirements.txt
├── .env.example
└── paper-assistant-frontend/  # React + Vite frontend
    └── src/
        ├── App.jsx
        ├── LoginScreen.jsx
        ├── UploadScreen.jsx
        ├── PdfViewer.jsx
        ├── AnnotationLayer.jsx
        ├── ChatPanel.jsx
        ├── NotesPanel.jsx
        └── index.css
```

## Setup

### Backend

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env and paste a free key from https://console.groq.com
```

On Windows, a known `torch`/OpenMP conflict can crash the server silently the first time an embedding model loads. If that happens, set this before starting the server (every time, in that terminal session):

```powershell
$env:KMP_DUPLICATE_LIB_OK="TRUE"
```

Run it:

```bash
uvicorn app.main:app --reload --reload-dir app
```

`--reload-dir app` matters — without it, `--reload` watches the whole project including `venv/`, and a `pip install` running alongside the server can trigger cascading false restarts.

### Frontend

```bash
cd paper-assistant-frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://127.0.0.1:8000` (configured in `vite.config.js`), so the frontend never makes direct cross-origin requests to the backend — no CORS configuration needed for normal use.

## Environment variables

See `.env.example` for the full list. At minimum you need:

```
GROQ_API_KEY=your_key_here
```

Everything else (model names, embedding model, storage paths) has a working default in `app/config.py`.

## Evaluation

The chat pipeline is evaluated end-to-end using [RAGAS](https://github.com/explodinggradients/ragas) against four hand-written question/ground-truth pairs — three paper-specific, one deliberately off-topic, to verify the unified chat correctly handles general questions without forcing an awkward connection to the paper.

**Methodology**: `eval/run_eval.py` logs in and asks each test question through the real `/chat` endpoint, saving the question, generated answer, and full retrieved context to `eval/results.json`. `eval/score_eval.py` scores each question across four RAGAS metrics using Groq as the judge LLM and the same local embedding model used by the retrieval pipeline itself.

```bash
pip install -r eval-requirements.txt
python eval/run_eval.py <username> <password>
python -m eval.score_eval
```

**Metrics**:
- **Faithfulness** — does the generated answer stick to what the retrieved context actually says?
- **Answer relevancy** — does the answer address the question asked?
- **Context precision** — of what was retrieved, how much was actually useful?
- **Context recall** — did retrieval find everything needed to answer correctly?

**Results** (best clean run):

| Question | Faithfulness | Answer Relevancy | Context Precision | Context Recall |
|---|---|---|---|---|
| DistilBERT's accuracy | 1.00 | 0.90 | 1.00 | 1.00 |
| Best performance/efficiency balance | 0.60 | — | 0.42 | 1.00 |
| Dataset used | 1.00 | 1.00 | — | — |
| Capital of Japan (off-topic) | — | — | — | — |

Some cells are blank — Groq's free-tier daily token quota was exhausted partway through this run, so a handful of judge calls failed outright rather than scoring low. The completed cells are genuine scores, not artifacts.

**Notable findings**:
- A real bug was caught and fixed during evaluation: `/chat` originally returned only a 200-character preview of each retrieved chunk (meant for UI display), and the eval script was unknowingly scoring against that truncated text. After adding a separate `full_text` field for evaluation purposes, `context_recall` jumped from `0.0` to `1.0` on the fully-scored question — retrieval was finding the right information all along; the eval harness just wasn't seeing it.
- The off-topic question scores near zero on faithfulness/context precision when it does complete, which is *correct*, not a flaw — the unified chat prompt answers general questions directly instead of forcing retrieved paper context onto them, and RAGAS correctly reflects that the (irrelevant) retrieved context wasn't used.
- Running RAGAS against Groq required real compatibility fixes, pinned in `eval-requirements.txt`: `ragas==0.3.9` and `langchain-community<0.4.2` to avoid an unrelated import break, plus forcing `reproducibility=1` / `strictness=1` on metrics that default to requesting multiple completions per call, since Groq's API only supports `n=1`.

**Limitations**: a four-question test set is small — enough to validate the harness and catch a real bug, but not statistically meaningful. A production evaluation would use dozens of questions and likely a larger/more reliable judge model than a 20B open-weight model, which showed some inconsistency on strictly structured extraction tasks.

## Known issues

- **Highlights sometimes require one click before they render visually after a page reload.** The highlight data is fetched and saved correctly, but `react-pdf-highlighter` 8.0.0-rc.0 (a pre-release version) appears to need a mouse interaction to trigger its internal redraw after highlights load asynchronously. A `scrollRef`-based fix mostly resolves this but causes a brief, visible scroll as a side effect.
- **Pin/shape coordinates are page-relative percentages**, which works well for whichever page is in view but can drift slightly across a long scroll through a multi-page paper.
- **Figure captioning falls back to a generic placeholder** if the configured Groq vision model is unavailable, rather than failing the whole upload — check `GROQ_VISION_MODEL` against Groq's current model list if captions look generic.

## Tech stack

Backend: FastAPI · pymupdf4llm · sentence-transformers · ChromaDB · Groq · passlib/bcrypt · PyJWT
Frontend: React · Vite · react-pdf-highlighter
Evaluation: RAGAS · LangChain (Groq + HuggingFace adapters)