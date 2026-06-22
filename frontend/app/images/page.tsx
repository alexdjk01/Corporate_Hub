"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Download, RotateCcw } from "lucide-react";

type ImageItem = {
  id: number;
  prompt: string;
  image_type: string;
  width: number;
  height: number;
  seed: string | null;
  model_name: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
  previewUrl?: string;
};

const PRESETS = [
  "clean corporate teamwork illustration, modern office scene, professional presentation graphic, blue and white color palette, minimal, high quality",
  "professional business presentation illustration, growth concept, clean infographic style, modern corporate design, high quality",
  "minimal flat business icon, analytics concept, clean background, presentation ready, vector-like style",
  "clean futuristic technology illustration for presentation, artificial intelligence concept, professional corporate style, high quality",
];

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(
    "blurry, low quality, distorted, ugly, text, watermark, extra fingers, bad anatomy, cluttered background"
  );
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem("token") || "";
    return { Authorization: `Bearer ${token}` };
  };

  const clearObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  const fetchPreviewUrl = async (imageId: number): Promise<string> => {
    const res = await fetch(`http://localhost:8000/images/${imageId}/file`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) throw new Error("Could not load image file");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  };

  const loadImages = async () => {
    try {
      clearObjectUrls();

      const res = await fetch("http://localhost:8000/images", {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        setImages([]);
        return;
      }

      const data = await res.json();

      const withPreviews: ImageItem[] = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (item: ImageItem) => {
          if (item.status !== "completed") return { ...item, previewUrl: "" };

          try {
            const previewUrl = await fetchPreviewUrl(item.id);
            return { ...item, previewUrl };
          } catch {
            return { ...item, previewUrl: "" };
          }
        })
      );

      setImages(withPreviews);
    } catch {
      setImages([]);
    }
  };

  useEffect(() => {
    loadImages();

    return () => clearObjectUrls();
  }, []);

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;

    const formData = new FormData();
    formData.append("prompt", prompt.trim());
    formData.append("negative_prompt", negativePrompt.trim());
    formData.append("width", String(width));
    formData.append("height", String(height));

    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/images/generate", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Image generation failed");
        return;
      }

      setPrompt("");
      await loadImages();
    } catch {
      alert("Image generation failed");
    } finally {
      setLoading(false);
    }
  };

  const regenerateImage = async (imageId: number) => {
    setRegeneratingId(imageId);

    try {
      const res = await fetch(`http://localhost:8000/images/${imageId}/regenerate`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Could not regenerate image");
        return;
      }

      await loadImages();
    } catch {
      alert("Could not regenerate image");
    } finally {
      setRegeneratingId(null);
    }
  };

  const deleteImage = async (imageId: number) => {
    await fetch(`http://localhost:8000/images/${imageId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    await loadImages();
  };

  const downloadImage = async (imageId: number) => {
    const res = await fetch(`http://localhost:8000/images/${imageId}/file`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      alert("Could not download image");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `image_${imageId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-blue-950/50 px-8">
        <h1 className="text-lg font-semibold text-white">Images</h1>
        <p className="text-sm text-blue-200/60">Local SDXL image generation</p>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-8 hide-scrollbar">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <h2 className="text-xl font-semibold text-white">Generate image</h2>
            <p className="mt-2 text-sm text-blue-200/60">
              Describe the visual you want and generate a local image using ComfyUI.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(preset)}
                  className="rounded-full border border-blue-900/70 bg-[#0b1728] px-4 py-2 text-sm text-blue-100 hover:bg-blue-950/50"
                >
                  Preset {index + 1}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-5 w-full rounded-3xl border border-blue-900/60 bg-[#0b1728] px-5 py-4 text-white outline-none placeholder:text-blue-200/40"
              placeholder="Example: clean corporate illustration about teamwork for a presentation"
            />

            <textarea
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="mt-4 w-full rounded-3xl border border-blue-900/60 bg-[#0b1728] px-5 py-4 text-white outline-none placeholder:text-blue-200/40"
              placeholder="Negative prompt"
            />

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-white outline-none"
              />

              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-white outline-none"
              />

              <button
                onClick={() => {
                  setWidth(1024);
                  setHeight(1024);
                }}
                className="rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-blue-100 hover:bg-blue-950/50"
              >
                Square
              </button>

              <button
                onClick={() => {
                  setWidth(1152);
                  setHeight(768);
                }}
                className="rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-blue-100 hover:bg-blue-950/50"
              >
                Slide
              </button>
            </div>

            <button
              onClick={generateImage}
              disabled={loading || !prompt.trim()}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <ImagePlus size={18} />
              {loading ? "Generating..." : "Generate"}
            </button>
          </section>

          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <h2 className="text-xl font-semibold text-white">My images</h2>

            {images.length === 0 ? (
              <p className="mt-4 text-sm text-blue-200/50">
                No images generated yet.
              </p>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="overflow-hidden rounded-3xl border border-blue-900/50 bg-[#0b1728]"
                  >
                    <div className="aspect-video bg-black">
                      {image.status === "completed" && image.previewUrl ? (
                        <img
                          src={image.previewUrl}
                          alt={image.prompt}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-blue-200/50">
                          {image.status === "failed" ? "Failed" : "Generating..."}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <p className="line-clamp-3 text-sm text-white">{image.prompt}</p>
                      <p className="text-xs text-blue-200/50">
                        {image.width} × {image.height}
                        {image.seed ? ` • seed ${image.seed}` : ""}
                      </p>

                      <div className="flex flex-wrap gap-4">
                        {image.status === "completed" && (
                          <>
                            <button
                              onClick={() => downloadImage(image.id)}
                              className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
                            >
                              <Download size={14} />
                              Download
                            </button>

                            <button
                              onClick={() => regenerateImage(image.id)}
                              disabled={regeneratingId === image.id}
                              className="inline-flex items-center gap-2 text-sm text-yellow-300 hover:text-yellow-200 disabled:opacity-50"
                            >
                              <RotateCcw size={14} />
                              {regeneratingId === image.id
                                ? "Regenerating..."
                                : "Regenerate"}
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => deleteImage(image.id)}
                          className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}