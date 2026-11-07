import React, { useEffect, useRef, useState } from "react";

function levelClass(level) {
  if (level === "error") return "activity-error";
  if (level === "warn") return "activity-warn";
  return "activity-info";
}

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    window.trazzo.getActivity().then(setEntries);
    const off = window.trazzo.onActivity((entry) => {
      setEntries((prev) => [...prev.slice(-300), entry]);
    });
    return off;
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, open]);

  const errorCount = entries.filter((e) => e.level === "error").length;

  return (
    <div className={`activity-dock ${open ? "activity-dock-open" : ""}`}>
      <button className="activity-toggle" onClick={() => setOpen((v) => !v)}>
        Actividad {errorCount > 0 && <span className="activity-count">{errorCount}</span>}
        <span className="activity-chevron">{open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <div className="activity-panel">
          {entries.length === 0 ? (
            <p className="muted">Sin actividad todavía.</p>
          ) : (
            entries.map((e, i) => (
              <div key={i} className={`activity-line ${levelClass(e.level)}`}>
                <span className="activity-ts">{new Date(e.ts).toLocaleTimeString()}</span>
                <span>{e.message}</span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
