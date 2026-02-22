import { useEffect, useRef, useState } from "react";
import { uploadDicom, VolumeInfo } from "../api";

interface UploadZoneProps {
  /** Controlled open state — set true when the toolbar button is clicked */
  open: boolean;
  onClose: () => void;
  onSuccess: (info: VolumeInfo) => void;
}

type UploadState = "idle" | "uploading" | "error";

export function UploadZone({ open, onClose, onSuccess }: UploadZoneProps) {
  const [windowDragging, setWindowDragging] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Detect when user drags a file anywhere over the browser window
  useEffect(() => {
    let counter = 0;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        counter++;
        setWindowDragging(true);
      }
    };
    const onDragLeave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setWindowDragging(false);
    };
    const onDrop = () => {
      counter = 0;
      setWindowDragging(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const visible = open || windowDragging;

  // Reset error when modal re-opens
  useEffect(() => {
    if (visible) {
      setUploadState("idle");
      setErrorMsg("");
    }
  }, [visible]);

  if (!visible) return null;

  async function handleFile(file: File) {
    const controller = new AbortController();
    abortRef.current = controller;
    setUploadState("uploading");
    setErrorMsg("");
    try {
      const info = await uploadDicom(file, controller.signal);
      setUploadState("idle");
      onSuccess(info);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setUploadState("idle"); // cancelled — just go back to idle, no error shown
      } else {
        setUploadState("error");
        setErrorMsg(String(err instanceof Error ? err.message : err));
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault();
    setDropHover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be picked again
    e.target.value = "";
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      // clicking the backdrop closes (unless uploading)
      onClick={(e) => {
        if (e.target === e.currentTarget && uploadState !== "uploading") onClose();
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 32,
          width: 420,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          position: "relative",
        }}
      >
        {/* Close button */}
        {uploadState !== "uploading" && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              background: "none",
              border: "none",
              color: "#666",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}

        <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>
          Upload DICOM
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
          onDragLeave={() => setDropHover(false)}
          onDrop={onDropZone}
          onClick={() => uploadState !== "uploading" && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dropHover ? "#4af" : "#444"}`,
            borderRadius: 6,
            padding: "40px 24px",
            textAlign: "center",
            cursor: uploadState === "uploading" ? "default" : "pointer",
            background: dropHover ? "rgba(68,170,255,0.06)" : "transparent",
            transition: "border-color 0.15s, background 0.15s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          {uploadState === "uploading" ? (
            <>
              <Spinner />
              <span style={{ color: "#aaa", fontSize: 13 }}>Uploading and loading volume…</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                style={{
                  marginTop: 4,
                  background: "none",
                  border: "1px solid #555",
                  borderRadius: 4,
                  color: "#aaa",
                  fontSize: 12,
                  padding: "4px 14px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f77"; e.currentTarget.style.color = "#f77"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#555"; e.currentTarget.style.color = "#aaa"; }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, opacity: 0.5 }}>⬆</div>
              <div style={{ color: "#ccc", fontSize: 13 }}>
                Drop a file here, or click to browse
              </div>
              <div style={{ color: "#555", fontSize: 11, lineHeight: 1.5 }}>
                Accepted: <code style={{ color: "#888" }}>.zip</code> containing a DICOM
                folder, or a <code style={{ color: "#888" }}>DICOMDIR</code> file
              </div>
            </>
          )}
        </div>

        {uploadState === "error" && (
          <div
            style={{
              background: "rgba(255,60,60,0.1)",
              border: "1px solid rgba(255,60,60,0.3)",
              borderRadius: 4,
              padding: "10px 14px",
              fontSize: 12,
              color: "#f77",
            }}
          >
            <strong>Upload failed:</strong> {errorMsg}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,DICOMDIR"
          style={{ display: "none" }}
          onChange={onFileInput}
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #333",
          borderTop: "3px solid #4af",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
