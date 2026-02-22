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

export async function uploadDicom(file: File, signal?: AbortSignal): Promise<VolumeInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form, signal });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // keep statusText
    }
    throw new Error(detail);
  }
  return res.json();
}
