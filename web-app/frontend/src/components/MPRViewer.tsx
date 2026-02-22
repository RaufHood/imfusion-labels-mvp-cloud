import { useState } from "react";
import { SlicePanel } from "./SlicePanel";
import { VolumePanel } from "./VolumePanel";
import { UploadZone } from "./UploadZone";
import { useViewerStore } from "../store";
import { VolumeInfo } from "../api";

export function MPRViewer() {
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const setWL = useViewerStore((s) => s.setWL);
  const setShape = useViewerStore((s) => s.setShape);
  const [uploadOpen, setUploadOpen] = useState(false);

  function handleUploadSuccess(info: VolumeInfo) {
    setShape(info.shape);
    setWL(info.ww, info.wl);
  }

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
          gap: 16,
          flexShrink: 0,
          fontSize: 12,
          color: "#aaa",
        }}
      >
        <span style={{ color: "#fff", fontWeight: "bold", marginRight: 8 }}>
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

        <button
          onClick={() => setUploadOpen(true)}
          style={{
            marginLeft: "auto",
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 4,
            color: "#ccc",
            fontSize: 12,
            padding: "4px 12px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4af")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#444")}
        >
          Upload DICOM
        </button>

        <span style={{ color: "#555", fontSize: 11 }}>
          Scroll to navigate · Click to move crosshairs
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
          gap: 2,
          background: "#222",
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
