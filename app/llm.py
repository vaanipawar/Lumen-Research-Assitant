import base64
from functools import lru_cache
from pathlib import Path

from app.config import settings

UNIFIED_SYSTEM_PROMPT = (
    "You are a helpful research assistant chatting with someone about a "
    "specific paper. You'll be given context retrieved from that paper, "
    "followed by the user's question. Some ground rules:\n\n"
    "1. If the question is genuinely about the paper and the provided "
    "context is relevant, answer using that context, and cite the section "
    "when it's not obvious.\n"
    "2. If the question is a general knowledge question unrelated to the "
    "paper (even if asked mid-conversation), just answer it directly and "
    "naturally — don't force a connection to the paper that isn't there, "
    "and don't mention that it's unrelated.\n"
    "3. If the user's question or phrasing suggests they want a simple, "
    "beginner-friendly explanation (e.g. 'explain like I'm new to this', "
    "'in simple terms', or they just seem confused by jargon), explain "
    "accordingly — avoid unnecessary jargon, define terms when you use "
    "them, and use plain language. Otherwise, answer at a normal, "
    "informed level of detail.\n"
    "4. If the paper context doesn't contain the answer and the question "
    "really is about the paper, say so honestly rather than guessing."
)

CAPTION_PROMPT = (
    "Describe this figure or table from a research paper in 2-4 sentences. "
    "State what kind of visual it is (chart, diagram, table, plot), what it "
    "shows, and any key numbers or trends visible. Be factual, not decorative."
)


@lru_cache(maxsize=1)
def _get_client():
    from groq import Groq

    return Groq(api_key=settings.groq_api_key)


def answer_question(question: str, context: str) -> str:
    client = _get_client()
    completion = client.chat.completions.create(
        model=settings.groq_text_model,
        messages=[
            {"role": "system", "content": UNIFIED_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context from the paper:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.3,
    )
    return completion.choices[0].message.content


def generate_summary(full_text: str, section_name: str | None = None) -> str:
    client = _get_client()
    scope = f"the '{section_name}' section" if section_name else "the full paper"
    completion = client.chat.completions.create(
        model=settings.groq_text_model,
        messages=[
            {
                "role": "system",
                "content": "Summarize research paper content clearly and concisely, "
                "preserving key claims, methods, and results.",
            },
            {"role": "user", "content": f"Summarize {scope}:\n\n{full_text}"},
        ],
        temperature=0.2,
    )
    return completion.choices[0].message.content


def caption_figure(image_path: str) -> str:
    client = _get_client()
    image_bytes = Path(image_path).read_bytes()
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:image/png;base64,{b64}"

    completion = client.chat.completions.create(
        model=settings.groq_vision_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": CAPTION_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        temperature=0.2,
    )
    return completion.choices[0].message.content