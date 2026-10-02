from functools import lru_cache
from app.config import settings

@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embed_model)

def embed_texts(texts: list[str]) -> list[list[float]]:
    model  = _get_model()
    vectors = model.encode(texts, normalize_embeddings = True)
    return vectors.tolist()

def embed_query(text:str) -> list[float]:
    return embed_texts([text])[0]