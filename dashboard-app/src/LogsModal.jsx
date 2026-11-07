import React, { useEffect, useRef } from "react";

export default function LogsModal({ app, logs, onClose }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  if (!app) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Logs — {app.name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <pre className="log-view">
          {logs.length === 0 ? "Sin salida todavía…" : logs.join("")}
          <div ref={endRef} />
        </pre>
      </div>
    </div>
  );
}
