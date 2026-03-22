import { useState, useRef } from "react";
import { jobsApi } from "../../api";
import type { JobPhoto, PhotoType } from "../../types";

interface Props {
  jobId: string;
  clientId: string;
  photos: JobPhoto[];
  onPhotosChange: (photos: JobPhoto[]) => void;
  onAskAI: (message: string, imageUrl?: string) => void;
}

const photoTypeLabels: Record<PhotoType, string> = {
  BEFORE: "Before",
  AFTER: "After",
  MAPPING_IDEA: "Mapping / Idea",
};

const photoTypeColors: Record<PhotoType, string> = {
  BEFORE: "bg-yellow-100 text-yellow-700",
  AFTER: "bg-turf-100 text-turf-700",
  MAPPING_IDEA: "bg-purple-100 text-purple-700",
};

export default function SitePhotoSection({ jobId, clientId, photos, onPhotosChange, onAskAI }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<PhotoType>("BEFORE");
  const [caption, setCaption] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const photo = await jobsApi.uploadPhoto(jobId, file, caption, uploadType);
      onPhotosChange([...photos, photo]);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  function handleAskAboutPhoto(photo: JobPhoto) {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
    const fullUrl = `${apiBase}${photo.url}`;
    const prompt = aiPrompt.trim() || "Analyze this job site photo and tell me what work is needed. Suggest services and provide a cost estimate.";
    onAskAI(`Analyze this job site photo: ${fullUrl}\n\nRequest: ${prompt}`, fullUrl);
  }

  function handleDraftQuoteFromPhoto(photo: JobPhoto) {
    onAskAI(
      `Draft a quote based on this analysis for client ${clientId}. Use the previously analyzed photo results.`
    );
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Site Photos & AI Mapping</h2>
        <p className="text-xs text-gray-400 mt-0.5">Upload before/after photos or mapping ideas. Ask AI to analyze and draft quotes.</p>
      </div>

      {/* Upload section */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="label text-xs">Photo Type</label>
            <select
              className="input text-sm"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as PhotoType)}
            >
              {Object.entries(photoTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="label text-xs">Caption (optional)</label>
            <input
              className="input text-sm"
              placeholder="e.g., Front yard overgrowth"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-sm"
            >
              {uploading ? "Uploading..." : "📷 Upload Photo"}
            </button>
          </div>
        </div>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">
          No photos yet. Upload a before/after photo or site mapping image.
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Photo */}
              <div className="relative">
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL ?? ""}${photo.url}`}
                  alt={photo.caption ?? "Job site photo"}
                  className="w-full h-48 object-cover"
                />
                <span className={`absolute top-2 left-2 badge ${photoTypeColors[photo.photoType]}`}>
                  {photoTypeLabels[photo.photoType]}
                </span>
              </div>

              {/* Photo meta */}
              <div className="p-3 space-y-2">
                {photo.caption && <p className="text-sm font-medium text-gray-700">{photo.caption}</p>}

                {/* AI analysis result */}
                {photo.aiAnalysis && !photo.aiAnalysis.error && (
                  <div className="bg-turf-50 border border-turf-200 rounded-lg p-2.5 text-xs text-turf-800">
                    <p className="font-semibold mb-1">AI Analysis:</p>
                    <p className="line-clamp-3">{photo.aiAnalysis.analysis}</p>
                    {photo.aiAnalysis.suggested_services?.length > 0 && (
                      <p className="mt-1 text-turf-600 font-medium">
                        Services: {photo.aiAnalysis.suggested_services.join(", ")}
                      </p>
                    )}
                    {photo.aiAnalysis.estimated_price && (
                      <p className="font-semibold mt-1">Est. ~${photo.aiAnalysis.estimated_price.toFixed(0)}</p>
                    )}
                  </div>
                )}

                {/* AI prompt + actions */}
                <div className="space-y-1.5">
                  <input
                    className="input text-xs"
                    placeholder="Ask Glen to analyze this area..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAskAboutPhoto(photo)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAskAboutPhoto(photo)}
                      className="btn-secondary text-xs flex-1 justify-center py-1.5"
                    >
                      🏞️ Ask Glen
                    </button>
                    {photo.aiAnalysis && !photo.aiAnalysis.error && (
                      <button
                        onClick={() => handleDraftQuoteFromPhoto(photo)}
                        className="btn-primary text-xs flex-1 justify-center py-1.5"
                      >
                        📋 Draft Quote
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
