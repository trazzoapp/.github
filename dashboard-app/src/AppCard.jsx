import React from "react";

function GitBadge({ git }) {
  if (!git || !git.ok) return <span className="badge badge-muted">sin git</span>;
  return (
    <div className="git-info">
      <span className="badge badge-branch">{git.branch ?? "detached"}</span>
      {git.ahead > 0 && <span className="badge badge-ahead">↑{git.ahead}</span>}
      {git.behind > 0 && <span className="badge badge-behind">↓{git.behind}</span>}
      {git.dirty > 0 ? (
        <span className="badge badge-dirty">{git.dirty} cambios</span>
      ) : (
        <span className="badge badge-clean">limpio</span>
      )}
    </div>
  );
}

export default function AppCard({ app, onStart, onStop, onViewLogs }) {
  return (
    <div className="card app-card">
      <div className="app-card-top">
        <span className={`dot ${app.running ? "dot-on" : "dot-off"}`} />
        <div className="app-card-title">
          <strong>{app.name}</strong>
          <span className="dir">{app.dir}</span>
        </div>
        {app.port && <span className="badge badge-port">:{app.port}</span>}
      </div>

      <GitBadge git={app.git} />

      <div className="app-card-actions">
        <button className="btn btn-sm" onClick={() => onViewLogs(app.id)}>
          Ver logs
        </button>
        {app.running ? (
          <button className="btn btn-sm btn-danger" onClick={() => onStop(app.id)}>
            Parar
          </button>
        ) : (
          <button
            className="btn btn-sm btn-primary"
            disabled={!app.scriptName}
            title={!app.scriptName ? "sin script dev/start" : undefined}
            onClick={() => onStart(app.id)}
          >
            Arrancar
          </button>
        )}
      </div>
    </div>
  );
}
