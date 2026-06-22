"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Upload, Trash2, Search } from "lucide-react";

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

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem("token") || "";
    return { Authorization: `Bearer ${token}` };
  };

  const loadDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/rag/documents?scope=global", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch {
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadFile = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "global");

    setLoadingUpload(true);

    try {
      const res = await fetch("http://localhost:8000/rag/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Upload failed.");
        return;
      }

      setFile(null);
      await loadDocuments();
    } catch {
      alert("Upload failed.");
    } finally {
      setLoadingUpload(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    const formData = new FormData();
    formData.append("question", question);
    formData.append("scope", "global");

    setLoadingQuery(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("http://localhost:8000/rag/query", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();
      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch {
      setAnswer("Error while querying documents.");
    } finally {
      setLoadingQuery(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    await fetch(`http://localhost:8000/rag/documents/${documentId}?scope=global`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    await loadDocuments();
  };

  return (
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-blue-950/50 px-8">
        <div>
          <h1 className="text-lg font-semibold text-white">Documents</h1>
        </div>
        <p className="text-sm text-blue-200/60">RAG document workspace</p>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-8 hide-scrollbar">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <h2 className="text-xl font-semibold text-white">Upload document</h2>
            <p className="mt-2 text-sm text-blue-200/60">
              Upload a PDF or text file to make it available for document-based questions.
            </p>

            <label className="mt-6 flex cursor-pointer items-center justify-between rounded-3xl border border-dashed border-blue-800/70 bg-[#0b1728] px-5 py-5 hover:bg-blue-950/40">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-blue-600 p-3 text-white">
                  <FileText size={22} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Choose a .txt or .pdf file
                  </p>
                  <p className="text-xs text-blue-200/50">
                    The file will be processed and indexed locally.
                  </p>
                </div>
              </div>

              <span className="rounded-2xl border border-blue-800 px-4 py-2 text-sm text-blue-100">
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
              <div className="mt-4 rounded-2xl bg-blue-950/40 px-4 py-3 text-sm text-blue-100">
                Selected: <span className="font-medium">{file.name}</span>
              </div>
            )}

            <button
              onClick={uploadFile}
              disabled={!file || loadingUpload}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Upload size={16} />
              {loadingUpload ? "Uploading..." : "Upload document"}
            </button>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
              <h2 className="text-xl font-semibold text-white">Indexed documents</h2>

              <div className="mt-5 space-y-2">
                {documents.length === 0 && (
                  <p className="text-sm text-blue-200/50">
                    No documents indexed yet.
                  </p>
                )}

                {documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[#0b1728] px-4 py-3"
                  >
                    <span className="truncate text-sm text-blue-50">
                      {doc.file_name}
                    </span>

                    <button
                      onClick={() => deleteDocument(doc.document_id)}
                      className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
              <h2 className="text-xl font-semibold text-white">Ask documents</h2>

              <div className="mt-5 flex gap-3">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-sm text-white outline-none placeholder:text-blue-200/40"
                  placeholder="Ask something about uploaded documents..."
                />

                <button
                  onClick={askQuestion}
                  disabled={loadingQuery || !question.trim()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Search size={16} />
                  {loadingQuery ? "Searching..." : "Ask"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-[#0b1728] p-4">
                <p className="mb-2 text-sm text-blue-200/50">Answer</p>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{answer || "No answer yet."}</ReactMarkdown>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#0b1728] p-4">
                <p className="mb-2 text-sm text-blue-200/50">Sources</p>
                {sources.length === 0 ? (
                  <p className="text-sm text-blue-200/40">No sources yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((source, index) => (
                      <div key={index} className="text-sm text-blue-100/80">
                        {source.file_name} — chunk {source.chunk_index}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}