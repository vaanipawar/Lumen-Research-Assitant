import json
import shutil
import tempfile
import logging
from pathlib import Path
from app.config import settings
from fastapi import FastAPI, HTTPException, UploadFile, Header, Depends
from app import embeddings, ingestion, llm, vectorstore
from app.schemas import ChatRequest, ChatResponse, Source, SummaryResponse, UploadResponse
from fastapi.responses import FileResponse
from app import notes_storage
from app import auth, users_storage
from app.auth import get_current_user

app = FastAPI(title="Research Paper Assitant")
logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_papers: dict[str, ingestion.ParsedPaper] = {}


def get_owned_paper(paper_id: str, username: str) -> ingestion.ParsedPaper:
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    parsed = _papers[paper_id]
    if parsed.owner != username:
        raise HTTPException(403, "You don't have access to this paper")
    return parsed


@app.on_event("startup")
async def load_existing_papers():
    storage_dir = Path(settings.storage_path)
    if not storage_dir.exists():
        return
    for paper_dir in storage_dir.iterdir():
        meta_path = paper_dir / "meta.json"
        if meta_path.exists():
            data = json.loads(meta_path.read_text())
            parsed = ingestion.paper_from_dict(data)
            _papers[parsed.paper_id] = parsed


@app.post("/papers/upload", response_model=UploadResponse)
async def upload_paper(file: UploadFile, username: str = Depends(get_current_user)) -> UploadResponse:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported") 
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)       
    try:
        parsed = ingestion.parse_pdf(tmp_path, owner=username, title_hint=file.filename)
        paper_dir = Path(settings.storage_path) / parsed.paper_id
        shutil.copy(tmp_path, paper_dir / "original.pdf")
        (paper_dir / "meta.json").write_text(json.dumps(ingestion.paper_to_dict(parsed)))
    finally:
        tmp_path.unlink(missing_ok=True)
    _papers[parsed.paper_id] = parsed  

    if parsed.text_chunks:
        vectors = embeddings.embed_texts([c.text for c in parsed.text_chunks])
        vectorstore.add_items(
            paper_id=parsed.paper_id,
            ids=[c.chunk_id for c in parsed.text_chunks],
            embeddings=vectors,
            documents=[c.text for c in parsed.text_chunks],
            metadatas=[{"kind": "text", "section": c.section} for c in parsed.text_chunks],
        )
    for figure in parsed.figures:
        try:
            figure.caption = llm.caption_figure(figure.path)
        except Exception as exc:
            logger.warning("Could not caption figure %s: %s", figure.figure_id, exc)
            figure.caption = "Extracted figure from the research paper."
    if parsed.figures:
        vectors = embeddings.embed_texts([f.caption for f in parsed.figures])
        vectorstore.add_items(
            paper_id=parsed.paper_id,
            ids=[f.figure_id for f in parsed.figures],
            embeddings=vectors,
            documents=[f.caption for f in parsed.figures],
            metadatas=[{"kind": "figure", "path": f.path} for f in parsed.figures],
        )      
    return UploadResponse(
        paper_id=parsed.paper_id,
        title=parsed.title,
        num_text_chunks=len(parsed.text_chunks),
        num_figures=len(parsed.figures),
    )   


@app.post("/papers/{paper_id}/chat", response_model=ChatResponse)
async def chat(paper_id: str, request: ChatRequest, username: str = Depends(get_current_user)) -> ChatResponse:  
    get_owned_paper(paper_id, username)
    query_vector = embeddings.embed_query(request.question)
    results = vectorstore.query(paper_id, query_vector, top_k=6)    
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]    
    context = "\n\n---\n\n".join(documents)
    answer = llm.answer_question(request.question, context)  
    sources = [
        Source(
            kind=meta["kind"],
            section=meta.get("section"),
            snippet=doc[:200],
            full_text=doc,
            figure_path=meta.get("path"),
        )
        for doc, meta in zip(documents, metadatas)
    ]   
    return ChatResponse(answer=answer, sources=sources)


@app.get("/papers/{paper_id}/summary", response_model=SummaryResponse)
async def summary(paper_id: str, username: str = Depends(get_current_user)) -> SummaryResponse:
    parsed = get_owned_paper(paper_id, username)
    full_text = "\n\n".join(c.text for c in parsed.text_chunks)
    tldr = llm.generate_summary(full_text) 

    sections: dict[str, list[str]] = {}
    for chunk in parsed.text_chunks:
        sections.setdefault(chunk.section, []).append(chunk.text)     

    section_summaries = {
        section: llm.generate_summary("\n\n".join(texts), section_name=section)
        for section, texts in sections.items()
    }

    return SummaryResponse(tldr=tldr, sections=section_summaries)    

@app.get("/papers/{paper_id}/file")
async def get_paper_file(paper_id: str, token: str):
    username = auth.decode_token(token)
    if username is None:
        raise HTTPException(401, "Invalid or expired token")
    get_owned_paper(paper_id, username)
    file_path = Path(settings.storage_path) / paper_id / "original.pdf"
    return FileResponse(file_path, media_type="application/pdf")

@app.get("/papers/{paper_id}/highlights")
async def get_highlights(paper_id: str, username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    return notes_storage.load_highlights(paper_id)


@app.post("/papers/{paper_id}/highlights")
async def save_highlights_route(paper_id: str, highlights: list[dict], username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    notes_storage.save_highlights(paper_id, highlights)
    return {"status": "saved"}


@app.get("/papers")
async def list_papers(username: str = Depends(get_current_user)):
    return [
        {"paper_id": p.paper_id, "title": p.title}
        for p in _papers.values()
        if p.owner == username
    ]


@app.get("/papers/{paper_id}/chat_history")
async def get_chat_history(paper_id: str, username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    return notes_storage.load_chat_history(paper_id)


@app.post("/papers/{paper_id}/chat_history")
async def save_chat_history_route(paper_id: str, messages: list[dict], username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    notes_storage.save_chat_history(paper_id, messages)
    return {"status": "saved"}


@app.post("/auth/signup")
async def signup(username: str, password: str):
    username = username.strip()
    users = users_storage.load_users()
    if username in users:
        raise HTTPException(400, "Username already taken")

    users[username] = {"password_hash": auth.hash_password(password)}
    users_storage.save_users(users)

    token = auth.create_token(username)
    return {"token": token, "username": username}


@app.post("/auth/login")
async def login(username: str, password: str):
    username = username.strip()
    users = users_storage.load_users()
    if username not in users:
        raise HTTPException(401, "Invalid username or password")

    if not auth.verify_password(password, users[username]["password_hash"]):
        raise HTTPException(401, "Invalid username or password")

    token = auth.create_token(username)
    return {"token": token, "username": username}


@app.get("/auth/me")
async def get_me(username: str = Depends(get_current_user)):
    return {"username": username}


@app.get("/papers/{paper_id}/notes")
async def get_notes(paper_id: str, username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    return notes_storage.load_notes(paper_id)


@app.post("/papers/{paper_id}/notes")
async def save_notes_route(paper_id: str, notes: list[dict], username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    notes_storage.save_notes(paper_id, notes)
    return {"status": "saved"}

@app.get("/papers/{paper_id}/annotations")
async def get_annotations(paper_id: str, username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    return notes_storage.load_annotations(paper_id)


@app.post("/papers/{paper_id}/annotations")
async def save_annotations_route(paper_id: str, annotations: list[dict], username: str = Depends(get_current_user)):
    get_owned_paper(paper_id, username)
    notes_storage.save_annotations(paper_id, annotations)
    return {"status": "saved"}