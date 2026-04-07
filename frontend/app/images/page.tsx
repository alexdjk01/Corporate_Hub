"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

type ImageItem = {
  id: number;
  prompt: string;
  image_type: string;
  width: number;
  height: number;
  seed: string | null;
  model_name: string | null;
  status: string;
  created_at: string;
  previewUrl?: string;
};

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem("token") || "";
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const clearObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  const fetchPreviewUrl = async (imageId: number): Promise<string> => {
    const res = await fetch(`http://localhost:8000/images/${imageId}/file`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error("Could not load image file");
    }

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
      if (!Array.isArray(data)) {
        setImages([]);
        return;
      }

      const withPreviews: ImageItem[] = await Promise.all(
        data.map(async (item: ImageItem) => {
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

    return () => {
      clearObjectUrls();
    };
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

  const deleteImage = async (imageId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/images/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        alert("Could not delete image");
        return;
      }

      await loadImages();
    } catch {
      alert("Could not delete image");
    }
  };

  return (
    <div className="max-w-7xl space-y-6">
      <h1 className="text-2xl font-semibold">Images</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Generate image</h2>

        <div className="space-y-4">
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
            placeholder="Example: clean corporate illustration about teamwork for a presentation"
          />

          <textarea
            rows={2}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
            placeholder="Optional negative prompt"
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
              placeholder="Width"
            />
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
              placeholder="Height"
            />
            <button
              onClick={() => {
                setWidth(1024);
                setHeight(1024);
              }}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white hover:bg-neutral-800"
            >
              Square
            </button>
            <button
              onClick={() => {
                setWidth(1152);
                setHeight(768);
              }}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white hover:bg-neutral-800"
            >
              Slide
            </button>
          </div>

          <button
            onClick={generateImage}
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50 hover:bg-blue-500"
          >
            <ImagePlus size={18} />
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">My images</h2>

        {images.length === 0 && (
          <p className="text-sm text-neutral-400">No images generated yet.</p>
        )}

        {images.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"
              >
                <div className="aspect-video bg-black">
                  {image.previewUrl ? (
                    <img
                      src={image.previewUrl}
                      alt={image.prompt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                      Preview unavailable
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <p className="text-sm text-white">{image.prompt}</p>

                  <div className="text-xs text-neutral-400">
                    {image.width} × {image.height}
                    {image.seed ? ` • seed ${image.seed}` : ""}
                  </div>

                  <button
                    onClick={() => deleteImage(image.id)}
                    className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}