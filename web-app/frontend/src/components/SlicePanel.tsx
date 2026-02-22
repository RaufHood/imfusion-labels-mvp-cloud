import { useRef, useCallback, useEffect, useState } from "react";
import { useViewerStore } from "../store";
import { sliceUrl } from "../api";

type Plane = "axial" | "sagittal" | "coronal";

interface PanelConfig {
  plane: Plane;
  label: string;
  badgeColor: string;
  crosshairHColor: string;
  crosshairVColor: string;
  // Which pos index this panel scrolls (wheel changes)
  scrollAxis: 0 | 1 | 2;
  // Which pos indices map to (horizontal %, vertical %) crosshair within this panel
  // crosshairAxes: [hAxis (maps to panel X), vAxis (maps to panel Y)]
  crosshairAxes: [0 | 1 | 2, 0 | 1 | 2];
}

const PANEL_CONFIGS: Record<Plane, PanelConfig> = {
  axial: {
    plane: "axial",
    label: "F",
    badgeColor: "#0ea5a5",
    crosshairHColor: "#4af",
    crosshairVColor: "#4f4",
    scrollAxis: 0,
    crosshairAxes: [2, 1], // X horizontal, Y vertical
  },
  sagittal: {
    plane: "sagittal",
    label: "L",
    badgeColor: "#22c55e",
    crosshairHColor: "#4f4",
    crosshairVColor: "#f84",
    scrollAxis: 2,
    crosshairAxes: [1, 0], // Y horizontal, Z vertical
  },
  coronal: {
    plane: "coronal",
    label: "A",
    badgeColor: "#f97316",
    crosshairHColor: "#4af",
    crosshairVColor: "#f84",
    scrollAxis: 1,
    crosshairAxes: [2, 0], // X horizontal, Z vertical
  },
};

interface SlicePanelProps {
  plane: Plane;
}

export function SlicePanel({ plane }: SlicePanelProps) {
  const config = PANEL_CONFIGS[plane];
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgKey, setImgKey] = useState(0);

  const pos = useViewerStore((s) => s.pos);
  const shape = useViewerStore((s) => s.shape);
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const setZ = useViewerStore((s) => s.setZ);
  const setY = useViewerStore((s) => s.setY);
  const setX = useViewerStore((s) => s.setX);

  const sliceIndex = pos[config.scrollAxis];

  // Force image reload when key params change
  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [sliceIndex, ww, wl]);

  // Crosshair positions as percentages
  const [hPct, vPct] = config.crosshairAxes;
  const crosshairLeft = `${(pos[hPct] / Math.max(shape[hPct] - 1, 1)) * 100}%`;
  const crosshairTop = `${(1 - pos[vPct] / Math.max(shape[vPct] - 1, 1)) * 100}%`;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const axis = config.scrollAxis;
      const current = pos[axis];
      const max = shape[axis] - 1;
      const next = Math.max(0, Math.min(current + delta, max));
      if (axis === 0) setZ(next);
      else if (axis === 1) setY(next);
      else setX(next);
    },
    [pos, shape, config.scrollAxis, setZ, setY, setX]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      const [hAxis, vAxis] = config.crosshairAxes;
      const hVal = Math.round(relX * (shape[hAxis] - 1));
      // vAxis is flipped (image top = high slice index for Z-based axes)
      const vVal = Math.round((1 - relY) * (shape[vAxis] - 1));

      if (hAxis === 0) setZ(hVal);
      else if (hAxis === 1) setY(hVal);
      else setX(hVal);

      if (vAxis === 0) setZ(vVal);
      else if (vAxis === 1) setY(vVal);
      else setX(vVal);
    },
    [shape, config.crosshairAxes, setZ, setY, setX]
  );

  const imgSrc = sliceUrl(plane, sliceIndex, ww, wl);

  return (
    <div
      ref={containerRef}
      className="panel"
      style={{ position: "relative", background: "#000", overflow: "hidden", cursor: "crosshair" }}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <img
        key={imgKey}
        src={imgSrc}
        alt={`${plane} slice ${sliceIndex}`}
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

      {/* Horizontal crosshair */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: crosshairTop,
          height: 1,
          background: config.crosshairHColor,
          pointerEvents: "none",
          opacity: 0.8,
          transform: "translateY(-0.5px)",
        }}
      />

      {/* Vertical crosshair */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: crosshairLeft,
          width: 1,
          background: config.crosshairVColor,
          pointerEvents: "none",
          opacity: 0.8,
          transform: "translateX(-0.5px)",
        }}
      />

      {/* Panel label badge */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          padding: "2px 8px",
          fontSize: 12,
          fontWeight: "bold",
          background: config.badgeColor,
          color: "#fff",
          borderRadius: 3,
          letterSpacing: 1,
          userSelect: "none",
        }}
      >
        {config.label}
      </div>

      {/* Slice index indicator */}
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
        {plane.charAt(0).toUpperCase() + plane.slice(1)} {sliceIndex + 1} / {shape[config.scrollAxis]}
      </div>
    </div>
  );
}
