import { useEffect, useState } from "react";
import { fetchInfo } from "./api";
import { useViewerStore } from "./store";
import { MPRViewer } from "./components/MPRViewer";
import { UploadZone } from "./components/UploadZone";

// "upload-first" = backend is up but has no data loaded
type LoadState = "loading" | "upload-first" | "ready" | "error";

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const setShape = useViewerStore((s) => s.setShape);
  const setWL = useViewerStore((s) => s.setWL);

  useEffect(() => {
    fetchInfo()
      .then((info) => {
        setShape(info.shape);
        setWL(info.ww, info.wl);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        // 503 means backend is up but no volume loaded yet → show upload screen
        if (String(err).includes("503") || String(err).includes("No volume")) {
          setLoadState("upload-first");
        } else {
          setErrorMsg(String(err));
          setLoadState("error");
        }
      });
  }, [setShape, setWL]);

  if (loadState === "loading") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          color: "#aaa",
          fontSize: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #333",
            borderTop: "3px solid #4af",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>Loading volume…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadState === "upload-first") {
    return (
      <div style={{ height: "100vh", background: "#111" }}>
        <UploadZone
          open={true}
          onClose={() => {}} // can't close without uploading in this state
          onSuccess={(info) => {
            setShape(info.shape);
            setWL(info.ww, info.wl);
            setLoadState("ready");
          }}
        />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          color: "#f55",
          fontSize: 14,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24 }}>⚠</div>
        <div>Failed to connect to backend</div>
        <div style={{ color: "#888", fontSize: 12 }}>{errorMsg}</div>
        <div style={{ color: "#666", fontSize: 11 }}>
          Make sure the backend is running: uvicorn main:app --reload --port 8000
        </div>
      </div>
    );
  }

  return <MPRViewer />;
}
