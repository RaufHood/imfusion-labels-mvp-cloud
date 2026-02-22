import { useState } from "react";
import { SlicePanel } from "./SlicePanel";
import { VolumePanel } from "./VolumePanel";
import { UploadZone } from "./UploadZone";
import { useViewerStore } from "../store";
import { VolumeInfo } from "../api";
import { clearAnnotations, exportDicomSeg } from "../api";

export function MPRViewer() {
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const setWL = useViewerStore((s) => s.setWL);
  const setShape = useViewerStore((s) => s.setShape);
  const [uploadOpen, setUploadOpen] = useState(false);

  const annotationMode = useViewerStore((s) => s.annotationMode);
  const brushSize = useViewerStore((s) => s.brushSize);
  const isErasing = useViewerStore((s) => s.isErasing);
  const setAnnotationMode = useViewerStore((s) => s.setAnnotationMode);
  const setBrushSize = useViewerStore((s) => s.setBrushSize);
  const setIsErasing = useViewerStore((s) => s.setIsErasing);
  const bumpAnnotationVersion = useViewerStore((s) => s.bumpAnnotationVersion);

  function handleUploadSuccess(info: VolumeInfo) {
    setShape(info.shape);
    setWL(info.ww, info.wl);
  }

  async function handleClearAll() {
    await clearAnnotations();
    bumpAnnotationVersion();
  }

  async function handleExport() {
    try {
      const blob = await exportDicomSeg();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "annotation.dcm";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + String(err));
    }
  }

  const btnBase: React.CSSProperties = {
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    padding: "4px 10px",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top toolbar */}
      <div
        style={{
          background: "#1a1a1a",
          borderBottom: "1px solid #333",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          fontSize: 12,
          color: "#aaa",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#fff", fontWeight: "bold", marginRight: 4 }}>
          ImFusion Web Visualizer
        </span>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          WW
          <input
            type="range"
            min={1}
            max={4000}
            step={1}
            value={ww}
            onChange={(e) => setWL(Number(e.target.value), wl)}
            style={{ width: 100, accentColor: "#4af" }}
          />
          <span style={{ color: "#fff", minWidth: 40 }}>{Math.round(ww)}</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          WL
          <input
            type="range"
            min={-1000}
            max={3000}
            step={1}
            value={wl}
            onChange={(e) => setWL(ww, Number(e.target.value))}
            style={{ width: 100, accentColor: "#f84" }}
          />
          <span style={{ color: "#fff", minWidth: 40 }}>{Math.round(wl)}</span>
        </label>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "#444" }} />

        {/* Annotate toggle — always visible */}
        <button
          onClick={() => setAnnotationMode(!annotationMode)}
          style={{
            ...btnBase,
            background: annotationMode ? "#1a3a6a" : "#2a2a2a",
            borderColor: annotationMode ? "#4af" : "#444",
            color: annotationMode ? "#4af" : "#ccc",
          }}
        >
          Annotate
        </button>

        {/* Annotation-mode controls */}
        {annotationMode && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Brush
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: 80, accentColor: "#fa5" }}
              />
              <span style={{ color: "#fff", minWidth: 24 }}>{brushSize}</span>
            </label>

            <button
              onClick={() => setIsErasing(!isErasing)}
              style={{
                ...btnBase,
                background: isErasing ? "#3a1a1a" : "#2a2a2a",
                borderColor: isErasing ? "#f55" : "#444",
                color: isErasing ? "#f55" : "#ccc",
              }}
            >
              Erase
            </button>

            <button
              onClick={handleClearAll}
              style={{ ...btnBase }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f84")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#444")}
            >
              Clear All
            </button>
          </>
        )}

        {/* Export SEG — always visible */}
        <button
          onClick={handleExport}
          style={{ ...btnBase }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4f4")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#444")}
        >
          Export SEG
        </button>

        <button
          onClick={() => setUploadOpen(true)}
          style={{
            marginLeft: "auto",
            ...btnBase,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4af")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#444")}
        >
          Upload DICOM
        </button>

        <span style={{ color: "#555", fontSize: 11 }}>
          {annotationMode
            ? "Draw to annotate · Scroll navigates when not annotating"
            : "Scroll to navigate · Click to move crosshairs"}
        </span>
      </div>

      <UploadZone
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* 2×2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          flex: 1,
          minHeight: 0,
          gap: 2,
          background: "#222",
          overflow: "hidden",
        }}
      >
        <SlicePanel plane="axial" />
        <SlicePanel plane="sagittal" />
        <SlicePanel plane="coronal" />
        <VolumePanel />
      </div>
    </div>
  );
}
