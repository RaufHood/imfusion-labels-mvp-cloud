import { create } from "zustand";

export interface ViewerState {
  // Volume dimensions [Z, Y, X]
  shape: [number, number, number];
  // Current voxel cursor [z, y, x]
  pos: [number, number, number];
  // Window width / window level
  ww: number;
  wl: number;
  // Annotation tool state
  annotationMode: boolean;
  brushSize: number;
  isErasing: boolean;
  annotationVersion: number;
  // Actions
  setShape: (shape: [number, number, number]) => void;
  setPos: (pos: [number, number, number]) => void;
  setWL: (ww: number, wl: number) => void;
  // Per-axis slice setters
  setZ: (z: number) => void;
  setY: (y: number) => void;
  setX: (x: number) => void;
  // Annotation actions
  setAnnotationMode: (v: boolean) => void;
  setBrushSize: (v: number) => void;
  setIsErasing: (v: boolean) => void;
  bumpAnnotationVersion: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  shape: [1, 1, 1],
  pos: [0, 0, 0],
  ww: 400,
  wl: 40,
  annotationMode: false,
  brushSize: 16,
  isErasing: false,
  annotationVersion: 0,

  setShape: (shape) =>
    set((s) => ({
      shape,
      pos: [
        Math.floor(shape[0] / 2),
        Math.floor(shape[1] / 2),
        Math.floor(shape[2] / 2),
      ] as [number, number, number],
      // keep existing ww/wl unless we want to reset
      ww: s.ww,
      wl: s.wl,
    })),

  setPos: (pos) => set({ pos }),

  setWL: (ww, wl) => set({ ww, wl }),

  setZ: (z) =>
    set((s) => ({
      pos: [Math.max(0, Math.min(z, s.shape[0] - 1)), s.pos[1], s.pos[2]],
    })),

  setY: (y) =>
    set((s) => ({
      pos: [s.pos[0], Math.max(0, Math.min(y, s.shape[1] - 1)), s.pos[2]],
    })),

  setX: (x) =>
    set((s) => ({
      pos: [s.pos[0], s.pos[1], Math.max(0, Math.min(x, s.shape[2] - 1))],
    })),

  setAnnotationMode: (v) => set({ annotationMode: v }),
  setBrushSize: (v) => set({ brushSize: v }),
  setIsErasing: (v) => set({ isErasing: v }),
  bumpAnnotationVersion: () =>
    set((s) => ({ annotationVersion: s.annotationVersion + 1 })),
}));
