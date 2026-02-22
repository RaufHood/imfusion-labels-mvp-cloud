export interface VolumeInfo {
  shape: [number, number, number]; // [Z, Y, X]
  spacing: [number, number, number]; // [sz, sy, sx] in mm
  ww: number;
  wl: number;
}

export async function fetchInfo(): Promise<VolumeInfo> {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error(`GET /api/info failed: ${res.status}`);
  return res.json();
}

export function sliceUrl(
  plane: "axial" | "sagittal" | "coronal",
  index: number,
  ww: number,
  wl: number
): string {
  return `/api/slice/${plane}/${index}?ww=${ww.toFixed(1)}&wl=${wl.toFixed(1)}`;
}

export function mipUrl(ww: number, wl: number): string {
  return `/api/mip?ww=${ww.toFixed(1)}&wl=${wl.toFixed(1)}`;
}
