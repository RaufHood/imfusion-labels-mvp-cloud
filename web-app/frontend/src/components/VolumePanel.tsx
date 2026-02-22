import { useState, useEffect } from "react";
import { useViewerStore } from "../store";
import { mipUrl } from "../api";

export function VolumePanel() {
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const [imgKey, setImgKey] = useState(0);

  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [ww, wl]);

  const src = mipUrl(ww * 2, wl);

  return (
    <div
      style={{
        position: "relative",
        background: "#000",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        key={imgKey}
        src={src}
        alt="Coronal MIP"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
        }}
        draggable={false}
      />

      {/* Label badge */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          padding: "2px 8px",
          fontSize: 12,
          fontWeight: "bold",
          background: "#22c55e",
          color: "#fff",
          borderRadius: 3,
          letterSpacing: 1,
          userSelect: "none",
        }}
      >
        R
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          fontSize: 11,
          color: "#aaa",
          userSelect: "none",
        }}
      >
        3D / MIP
      </div>
    </div>
  );
}
