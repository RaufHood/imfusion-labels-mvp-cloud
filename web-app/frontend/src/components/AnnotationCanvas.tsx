import { useEffect, useRef, useState, RefObject } from "react";
import { useViewerStore } from "../store";
import { annotationOverlayUrl, postAnnotationStroke } from "../api";

interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function computeImageRect(
  cW: number,
  cH: number,
  imgW: number,
  imgH: number
): ImageRect {
  const imgAspect = imgW / imgH;
  const cAspect = cW / cH;
  let rW: number, rH: number;
  if (imgAspect > cAspect) {
    rW = cW;
    rH = cW / imgAspect;
  } else {
    rH = cH;
    rW = cH * imgAspect;
  }
  return {
    left: (cW - rW) / 2,
    top: (cH - rH) / 2,
    width: rW,
    height: rH,
  };
}

interface AnnotationCanvasProps {
  plane: "axial" | "sagittal" | "coronal";
  sliceIndex: number;
  containerRef: RefObject<HTMLDivElement>;
  sliceDims: [number, number]; // [imageWidth, imageHeight] in voxels
}

export function AnnotationCanvas({
  plane,
  sliceIndex,
  containerRef,
  sliceDims,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState<ImageRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [localVersion, setLocalVersion] = useState(0);

  const annotationMode = useViewerStore((s) => s.annotationMode);
  const brushSize = useViewerStore((s) => s.brushSize);
  const isErasing = useViewerStore((s) => s.isErasing);
  const annotationVersion = useViewerStore((s) => s.annotationVersion);

  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Update canvas position and size when container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function update() {
      const cW = container!.clientWidth;
      const cH = container!.clientHeight;
      const [imgW, imgH] = sliceDims;
      const r = computeImageRect(cW, cH, imgW, imgH);
      setRect(r);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
      }
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, [containerRef, sliceDims]);

  // Load overlay from server when slice/plane/version changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const url = annotationOverlayUrl(plane, sliceIndex, annotationVersion * 100000 + localVersion);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    img.src = url;
  }, [sliceIndex, plane, annotationVersion, localVersion]);

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    };
  }

  function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintAt(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (isErasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255,80,80,0.63)";
    }
    drawCircle(ctx, x, y);
    ctx.globalCompositeOperation = "source-over";
  }

  function interpolateAndPaint(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = brushSize / 4;
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintAt(from.x + dx * t, from.y + dy * t);
    }
  }

  async function flushStroke() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await postAnnotationStroke(plane, sliceIndex, blob);
        setLocalVersion((v) => v + 1);
      } catch (err) {
        console.error("Failed to post annotation stroke:", err);
      }
    }, "image/png");
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!annotationMode) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getCanvasPos(e);
    if (!pos) return;
    paintAt(pos.x, pos.y);
    lastPosRef.current = pos;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!annotationMode || !isDrawingRef.current) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (!pos) return;
    if (lastPosRef.current) {
      interpolateAndPaint(lastPosRef.current, pos);
    }
    lastPosRef.current = pos;
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!annotationMode || !isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    lastPosRef.current = null;
    flushStroke();
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!annotationMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    flushStroke();
  }

  const cursor = !annotationMode ? "default" : isErasing ? "cell" : "crosshair";

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: 1,
        cursor,
        pointerEvents: annotationMode ? "all" : "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
