import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from dataclasses import asdict
from app.config import settings


@dataclass
class Figure:
    figure_id: str
    path: str
    section: str | None = None
    caption: str | None = None


@dataclass
class TextChunk:
    chunk_id: str
    section: str
    text: str


@dataclass
class ParsedPaper:
    paper_id: str
    title: str | None
    owner: str
    text_chunks: list[TextChunk] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)


def _run_marker(pdf_path: Path) -> tuple[str, dict]:
    import pymupdf4llm
    import pymupdf as fitz
    from io import BytesIO
    from PIL import Image

    markdown_text = pymupdf4llm.to_markdown(str(pdf_path))

    images = {}
    doc = fitz.open(str(pdf_path))
    for page_index in range(len(doc)):
        page = doc[page_index]
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base_image = doc.extract_image(xref)
            pil_image = Image.open(BytesIO(base_image["image"]))
            images[f"page{page_index}_img{img_index}.png"] = pil_image
    doc.close()

    return markdown_text, images

def _split_into_sections(markdown_text: str) -> list[tuple[str, str]]:
    header_pattern = re.compile(
        r"^#{1,3}\s+(.*)$",
        re.MULTILINE
    )

    matches = list(header_pattern.finditer(markdown_text))

    if not matches:
        return [("Full text", markdown_text.strip())]

    sections: list[tuple[str, str]] = []

    for i, match in enumerate(matches):
        section_title = match.group(1).strip()

        start = match.end()

        end = (
            matches[i + 1].start()
            if i + 1 < len(matches)
            else len(markdown_text)
        )

        body = markdown_text[start:end].strip()

        if body:
            sections.append((section_title, body))

    return sections


def _chunk_section(
    section_title: str,
    body: str,
    max_chars: int = 1500
) -> list[str]:

    if len(body) <= max_chars:
        return [body]

    paragraphs = []

    for p in body.split("\n\n"):
        if p.strip():
            paragraphs.append(p)

    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = (
                f"{current}\n\n{para}"
                if current
                else para
            )

    if current:
        chunks.append(current.strip())

    return chunks


def parse_pdf(
    pdf_path: Path,
    owner:str,
    title_hint: str | None = None

) -> ParsedPaper:

    paper_id = uuid.uuid4().hex[:12]

    paper_dir = Path(settings.storage_path) / paper_id
    paper_dir.mkdir(parents=True, exist_ok=True)

    markdown_text, images = _run_marker(pdf_path)

    title_match = re.search(
        r"^#\s+(.*)$",
        markdown_text,
        re.MULTILINE
    )

    title = (
        title_match.group(1).strip()
        if title_match
        else (title_hint or pdf_path.stem)
    )

    parsed = ParsedPaper(
        paper_id=paper_id,
        title=title,
        owner=owner
    )

    for section_title, body in _split_into_sections(markdown_text):

        for chunk_text in _chunk_section(
            section_title,
            body
        ):
            parsed.text_chunks.append(
                TextChunk(
                    chunk_id=uuid.uuid4().hex[:12],
                    section=section_title,
                    text=chunk_text,
                )
            )

    figures_dir = paper_dir / "figures"
    figures_dir.mkdir(exist_ok=True)

    for filename, image in images.items():

        figure_id = uuid.uuid4().hex[:12]

        out_path = figures_dir / f"{figure_id}.png"

        image.save(out_path)

        parsed.figures.append(
            Figure(
                figure_id=figure_id,
                path=str(out_path)
            )
        )

    return parsed

from dataclasses import asdict
def paper_to_dict(parsed: ParsedPaper) -> dict:
    return asdict(parsed)


def paper_from_dict(data: dict) -> ParsedPaper:
    return ParsedPaper(
        paper_id=data["paper_id"],
        title=data["title"],
        owner=data["owner"],
        text_chunks=[TextChunk(**c) for c in data["text_chunks"]],
        figures=[Figure(**f) for f in data["figures"]],
    )