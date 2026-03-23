"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Upload, Trash2 } from "lucide-react";

type DocItem = {
  document_id: string;
  file_name: string;
};

type Source = {
  file_name: string;
  chunk_index: number;
  document_id: string;
};

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState(false);

  const loadDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/rag/documents");
      const data = await res.json();

      if (Array.isArray(data)) {
        setDocuments(data);
      } else {
        console.error("Invalid documents response:", data);
        setDocuments([]);
      }
    } catch (err) {
      console.error(err);
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadFile = async () => {
    if (!file) {
      alert("Please choose a .txt or .pdf file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoadingUpload(true);

    try {
      const res = await fetch("http://localhost:8000/rag/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error(data);
        alert(data.error || "Upload failed.");
        return;
      }

      setFile(null);
      await loadDocuments();
      alert("Document uploaded successfully.");
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setLoadingUpload(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    const formData = new FormData();
    formData.append("question", question);

    setLoadingQuery(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("http://localhost:8000/rag/query", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } finally {
      setLoadingQuery(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    await fetch(`http://localhost:8000/rag/documents/${documentId}`, {
      method: "DELETE",
    });
    loadDocuments();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Documents / RAG</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Upload document</h2>

        <div className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 p-5">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-4 hover:bg-neutral-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-neutral-800 p-2">
                <FileText size={18} className="text-neutral-200" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Choose a .txt or .pdf file
                </p>
                <p className="text-xs text-neutral-400">
                  Only .txt and .pdf files are supported for now
                </p>
              </div>
            </div>

            <span className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
              Browse
            </span>

            <input
              type="file"
              accept=".txt,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {file && (
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-200">
              Selected file: <span className="font-medium">{file.name}</span>
            </div>
          )}

          <button
            onClick={uploadFile}
            disabled={!file || loadingUpload}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50 hover:bg-blue-500"
          >
            <Upload size={16} />
            {loadingUpload ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Indexed documents</h2>
        <div className="space-y-2">
          {documents.length === 0 && (
            <p className="text-sm text-neutral-400">No documents indexed yet.</p>
          )}
          {documents.map((doc) => (
            <div
              key={doc.document_id}
              className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3"
            >
              <span className="text-sm text-white">{doc.file_name}</span>
              <button
                onClick={() => deleteDocument(doc.document_id)}
                className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Ask your documents</h2>

        <div className="flex gap-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
            placeholder="Ask a question about uploaded documents..."
          />
          <button
            onClick={askQuestion}
            disabled={loadingQuery || !question.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loadingQuery ? "Searching..." : "Ask"}
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm text-neutral-400">Answer</p>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{answer || "No answer yet."}</ReactMarkdown>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm text-neutral-400">Sources</p>
          <div className="space-y-2">
            {sources.length === 0 && (
              <p className="text-sm text-neutral-500">No sources yet.</p>
            )}
            {sources.map((source, index) => (
              <div key={index} className="text-sm text-neutral-300">
                {source.file_name} — chunk {source.chunk_index}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}