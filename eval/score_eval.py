import json
from pathlib import Path

from datasets import Dataset
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from ragas import evaluate
from ragas.metrics import faithfulness, AnswerRelevancy, context_precision, context_recall
from ragas.run_config import RunConfig

from app.config import settings


def main():
    results = json.loads(Path("eval/results.json").read_text())

    answer_relevancy_metric = AnswerRelevancy(strictness=1)

    for metric in [faithfulness, answer_relevancy_metric, context_precision, context_recall]:
        if hasattr(metric, "reproducibility"):
            metric.reproducibility = 1    

    data = {
        "question": [r["question"] for r in results],
        "answer": [r["answer"] for r in results],
        "contexts": [r["contexts"] for r in results],
        "ground_truth": [r["ground_truth"] for r in results],
    }
    dataset = Dataset.from_dict(data)

    judge_llm = ChatGroq(
        groq_api_key=settings.groq_api_key,
        model_name=settings.groq_text_model,
        temperature=0,
    )

    judge_embeddings = HuggingFaceEmbeddings(model_name=settings.embed_model)

    run_config = RunConfig(
        timeout=180,
        max_retries=5,
        max_wait=90,
        max_workers=1,
    )
    scores = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy_metric, context_precision, context_recall],
        llm=judge_llm,
        embeddings=judge_embeddings,
        run_config=run_config,
    )
    print(scores)

    df = scores.to_pandas()
    df.to_csv("eval/scores.csv", index=False)
    print("\nSaved per-question breakdown to eval/scores.csv")


if __name__ == "__main__":
    main()