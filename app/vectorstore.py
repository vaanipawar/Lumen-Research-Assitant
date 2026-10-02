from functools import lru_cache
from app.config import settings
@lru_cache(maxsize=1)
def _get_client():
    import chromadb
    return chromadb.PersistentClient(path=settings.chroma_path)

def _collection_name(paper_id: str) ->str:
    return f"paper_{paper_id}" 

def get_or_create_collection(paper_id: str):
    client = _get_client()
    return client.get_or_create_collection(name=_collection_name(paper_id))


def add_items(
    paper_id: str,
    ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    collection = get_or_create_collection(paper_id)
    collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query(paper_id: str, query_embedding: list[float], top_k: int = 6) -> dict:
    collection = get_or_create_collection(paper_id)
    return collection.query(query_embeddings=[query_embedding], n_results=top_k)    