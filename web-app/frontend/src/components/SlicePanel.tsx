import { useRef, useCallback, useEffect, useState } from "react";
import { useViewerStore } from "../store";
import { sliceUrl, getVoxelHU } from "../api";
import { AnnotationCanvas } from "./AnnotationCanvas";

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

// sliceDims[plane](shape) → [imageWidth, imageHeight] in voxels
const SLICE_DIMS: Record<Plane, (s: [number, number, number]) => [number, number]> = {
  axial:    (s) => [s[2], s[1]], // [X, Y]
  sagittal: (s) => [s[1], s[0]], // [Y, Z]
  coronal:  (s) => [s[2], s[0]], // [X, Z]
};

function computeImageRect(cW: number, cH: number, imgW: number, imgH: number) {
  const ia = imgW / imgH, ca = cW / cH;
  let rW: number, rH: number;
  if (ia > ca) { rW = cW; rH = cW / ia; }
  else          { rH = cH; rW = cH * ia; }
  return { left: (cW - rW) / 2, top: (cH - rH) / 2, width: rW, height: rH };
}

function toVoxel(
  plane: Plane,
  relX: number,
  relY: number,
  pos: [number, number, number],
  shape: [number, number, number]
) {
  let vz = pos[0], vy = pos[1], vx = pos[2];
  if (plane === "axial") {
    vx = Math.round(relX * (shape[2] - 1));
    vy = Math.round((1 - relY) * (shape[1] - 1));
  } else if (plane === "sagittal") {
    vy = Math.round(relX * (shape[1] - 1));
    vz = Math.round((1 - relY) * (shape[0] - 1));
  } else {
    vx = Math.round(relX * (shape[2] - 1));
    vz = Math.round((1 - relY) * (shape[0] - 1));
  }
  return { vz, vy, vx };
}

interface SlicePanelProps {
  plane: Plane;
}

export function SlicePanel({ plane }: SlicePanelProps) {
  const config = PANEL_CONFIGS[plane];
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgKey, setImgKey] = useState(0);
  const [hover, setHover] = useState<{ vz: number; vy: number; vx: number; hu: number | null } | null>(null);
  const hoverFetchRef = useRef<AbortController | null>(null);

  const pos = useViewerStore((s) => s.pos);
  const shape = useViewerStore((s) => s.shape);
  const ww = useViewerStore((s) => s.ww);
  const wl = useViewerStore((s) => s.wl);
  const setZ = useViewerStore((s) => s.setZ);
  const setY = useViewerStore((s) => s.setY);
  const setX = useViewerStore((s) => s.setX);
  const annotationMode = useViewerStore((s) => s.annotationMode);

  const sliceIndex = pos[config.scrollAxis];
  const sliceDims = SLICE_DIMS[plane](shape);

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
      if (annotationMode) return;
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
    [pos, shape, config.scrollAxis, setZ, setY, setX, annotationMode]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (annotationMode) return;
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
    [shape, config.crosshairAxes, setZ, setY, setX, annotationMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const cr = container.getBoundingClientRect();
      const [imgW, imgH] = sliceDims;
      const ir = computeImageRect(cr.width, cr.height, imgW, imgH);
      const relX = (e.clientX - cr.left - ir.left) / ir.width;
      const relY = (e.clientY - cr.top  - ir.top)  / ir.height;

      if (relX < 0 || relX > 1 || relY < 0 || relY > 1) {
        setHover(null);
        return;
      }

      const { vz, vy, vx } = toVoxel(plane, relX, relY, pos, shape);
      setHover({ vz, vy, vx, hu: null });

      if (hoverFetchRef.current) hoverFetchRef.current.abort();
      const ctrl = new AbortController();
      hoverFetchRef.current = ctrl;
      getVoxelHU(vz, vy, vx, ctrl.signal)
        .then((hu) => setHover((prev) => (prev ? { ...prev, hu } : null)))
        .catch(() => {});
    },
    [plane, pos, shape, sliceDims]
  );

  const handleMouseLeave = useCallback(() => {
    setHover(null);
    hoverFetchRef.current?.abort();
  }, []);

  const imgSrc = sliceUrl(plane, sliceIndex, ww, wl);

  return (
    <div
      ref={containerRef}
      className="panel"
      style={{ position: "relative", background: "#000", overflow: "hidden", cursor: "crosshair", minHeight: 0, minWidth: 0 }}
      onWheel={handleWheel}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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

      <AnnotationCanvas
        plane={plane}
        sliceIndex={sliceIndex}
        containerRef={containerRef}
        sliceDims={sliceDims}
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
          zIndex: 2,
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
          zIndex: 2,
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
          zIndex: 3,
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
          zIndex: 3,
        }}
      >
        {plane.charAt(0).toUpperCase() + plane.slice(1)} {sliceIndex + 1} / {shape[config.scrollAxis]}
      </div>

      {/* Hover: pixel coords + HU value */}
      {hover && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            padding: "4px 8px",
            background: "rgba(0,0,0,0.65)",
            borderRadius: 4,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 3,
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 10, color: "#888" }}>
            z:{hover.vz}&nbsp; y:{hover.vy}&nbsp; x:{hover.vx}
          </div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: "bold" }}>
            {hover.hu !== null ? `${Math.round(hover.hu)} HU` : "…"}
          </div>
        </div>
      )}
    </div>
  );
}
