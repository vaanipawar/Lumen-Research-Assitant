from typing import Literal
from pydantic import BaseModel

class UploadResponse(BaseModel):
    paper_id: str
    title: str | None
    num_text_chunks: int
    num_figures: int

class ChatRequest(BaseModel):
    question : str
    
class Source(BaseModel):
    kind: Literal["text", "figure"]
    section: str | None = None
    snippet: str
    full_text: str
    figure_path: str | None = None


class ChatResponse(BaseModel):
    answer : str
    sources : list [Source] 


class SummaryResponse(BaseModel):
    tldr: str
    sections: dict[str, str]

    