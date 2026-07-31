import { useState } from "react";
import { exportElement } from "../exportImage";

export default function ExportBar({ targetRef, filenameBase }) {
  const [busy, setBusy] = useState(false);

  const handleExport = async (format) => {
    if (!targetRef.current || busy) return;
    setBusy(true);
    try {
      await exportElement(targetRef.current, format, `${filenameBase}.${format}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-bar">
      {["png", "jpg", "svg"].map((format) => (
        <button key={format} onClick={() => handleExport(format)} disabled={busy}>
          {format.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
