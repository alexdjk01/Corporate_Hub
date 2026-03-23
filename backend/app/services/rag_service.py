import os
import uuid
import chromadb
import requests
import pymupdf

from docling.document_converter import DocumentConverter
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.embedding_service import get_embedding, get_embeddings

CHROMA_PATH = "chroma_db"
COLLECTION_NAME = "corporate_docs"

client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,
    chunk_overlap=250,
)

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
CHAT_MODEL = "gemma3:4b"


def read_text_file(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def extract_pdf_text_docling(file_path: str) -> str:
    converter = DocumentConverter()
    result = converter.convert(file_path)
    doc = result.document
    return doc.export_to_markdown()


def extract_pdf_text_pymupdf(file_path: str) -> str:
    doc = pymupdf.open(file_path)
    pages = []

    for page in doc:
        pages.append(page.get_text("text"))

    doc.close()
    return "\n".join(pages).strip()


def extract_text_from_file(file_path: str) -> str:
    lower = file_path.lower()

    if lower.endswith(".txt"):
        return read_text_file(file_path)

    if lower.endswith(".pdf"):
        try:
            text = extract_pdf_text_docling(file_path)
            if text and text.strip():
                return text
        except Exception:
            pass

        text = extract_pdf_text_pymupdf(file_path)
        if text and text.strip():
            return text

        raise ValueError("Could not extract text from PDF")

    raise ValueError("Unsupported file type")


def index_document(file_path: str, original_name: str) -> dict:
    text = extract_text_from_file(file_path)
    chunks = splitter.split_text(text)

    if not chunks:
        raise ValueError("No text chunks could be created")

    embeddings = get_embeddings(chunks)
    document_id = str(uuid.uuid4())

    ids = []
    metadatas = []
    documents = []

    for i, chunk in enumerate(chunks):
        ids.append(f"{document_id}_{i}")
        documents.append(chunk)
        metadatas.append({
            "document_id": document_id,
            "file_name": original_name,
            "chunk_index": i,
        })

    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )

    return {
        "document_id": document_id,
        "file_name": original_name,
        "chunks_indexed": len(chunks),
    }


def query_documents(question: str, top_k: int = 8) -> dict:
    query_embedding = get_embedding(question)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    print("RAG QUESTION:", question)
    print("RETRIEVED CHUNKS:", len(documents))
    for i, doc in enumerate(documents):
        print(f"\n--- CHUNK {i+1} ---\n{doc[:500]}\n")

    context_parts = []
    sources = []

    for doc, meta in zip(documents, metadatas):
        context_parts.append(doc)
        sources.append({
            "file_name": meta.get("file_name"),
            "chunk_index": meta.get("chunk_index"),
            "document_id": meta.get("document_id"),
        })

    context = "\n\n---\n\n".join(context_parts)

    messages = [
        {
            "role": "system",
            "content": (
                "You answer questions using the provided context. "
                "Be concise and structured. "
                "If the question is broad, summarize the overall topic of the retrieved content. "
                "If the exact answer is not explicit but the retrieved context is clearly relevant, answer based on it. "
                "Only say you could not find it if the retrieved context is clearly unrelated."
            ),
        },
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion:\n{question}",
        },
    ]

    response = requests.post(
        OLLAMA_CHAT_URL,
        json={
            "model": CHAT_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2},
        },
        timeout=120,
    )
    response.raise_for_status()

    data = response.json()
    answer = data.get("message", {}).get("content", "").strip()

    return {
        "answer": answer,
        "sources": sources,
    }


def list_documents() -> list[dict]:
    data = collection.get(include=["metadatas"])
    seen = {}

    for meta in data.get("metadatas", []):
        doc_id = meta["document_id"]
        if doc_id not in seen:
            seen[doc_id] = {
                "document_id": doc_id,
                "file_name": meta["file_name"],
            }

    return list(seen.values())


def delete_document(document_id: str) -> None:
    data = collection.get(include=["metadatas"])
    ids_to_delete = []

    for item_id, meta in zip(data.get("ids", []), data.get("metadatas", [])):
        if meta["document_id"] == document_id:
            ids_to_delete.append(item_id)

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)