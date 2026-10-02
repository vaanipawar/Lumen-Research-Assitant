import json
import sys
from pathlib import Path

import requests

BASE_URL = "http://localhost:8000"


def login(username: str, password: str) -> str:
    response = requests.post(
        f"{BASE_URL}/auth/login",
        params={"username": username, "password": password},
    )
    response.raise_for_status()
    return response.json()["token"]


def get_or_create_test_paper(token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/papers", headers=headers)
    response.raise_for_status()
    papers = response.json()
    if not papers:
        raise RuntimeError("No papers found for this user. Upload one first.")
    return papers[0]["paper_id"]


def ask_question(token: str, paper_id: str, question: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/papers/{paper_id}/chat",
        headers=headers,
        json={"question": question},
    )
    response.raise_for_status()
    return response.json()


def main():
    if len(sys.argv) != 3:
        print("Usage: python run_eval.py <username> <password>")
        sys.exit(1)

    username, password = sys.argv[1], sys.argv[2]

    token = login(username, password)
    paper_id = get_or_create_test_paper(token)

    questions = json.loads(Path("eval/test_questions.json").read_text())

    results = []
    for item in questions:
        print(f"Asking: {item['question']}")
        response = ask_question(token, paper_id, item["question"])
        results.append(
            {
                "question": item["question"],
                "ground_truth": item["ground_truth"],
                "answer": response["answer"],
                "contexts": [s["full_text"] for s in response["sources"]],
            }
        )

    Path("eval/results.json").write_text(json.dumps(results, indent=2))
    print(f"\nSaved {len(results)} results to eval/results.json")


if __name__ == "__main__":
    main()