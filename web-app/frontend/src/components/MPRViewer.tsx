import { SlicePanel } from "./SlicePanel";
import { VolumePanel } from "./VolumePanel";
import { useViewerStore } from "../store";

export function MPRViewer() {
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const setWL = useViewerStore((s) => s.setWL);

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

        <span style={{ marginLeft: "auto", color: "#555" }}>
          Scroll to navigate slices · Click to move crosshairs
        </span>
      </div>

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
