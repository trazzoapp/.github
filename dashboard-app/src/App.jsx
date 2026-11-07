import React, { useEffect, useRef, useState } from "react";

function GitBadge({ git }) {
  if (!git || !git.ok) return <span className="badge badge-muted">no git</span>;
  return (
    <span className="git-info">
      <span className="badge badge-branch">{git.branch ?? "detached"}</span>
      {git.ahead > 0 && <span className="badge badge-ahead">↑{git.ahead}</span>}
      {git.behind > 0 && <span className="badge badge-behind">↓{git.behind}</span>}
      {git.dirty > 0 ? (
        <span className="badge badge-dirty">{git.dirty} dirty</span>
      ) : (
        <span className="badge badge-clean">clean</span>
      )}
    </span>
  );
}

function AppRow({ app, onStart, onStop, onViewLogs, active }) {
  return (
    <div className={`app-row ${active ? "app-row-active" : ""}`}>
      <div className="app-row-main">
        <span className={`dot ${app.running ? "dot-on" : "dot-off"}`} />
        <div className="app-row-name">
          <strong>{app.name}</strong>
          <span className="dir">{app.dir}</span>
        </div>
        <GitBadge git={app.git} />
        {app.port && <span className="badge badge-port">:{app.port}</span>}
      </div>
      <div className="app-row-actions">
        <button className="btn btn-sm" onClick={() => onViewLogs(app.id)}>
          Logs
        </button>
        {app.running ? (
          <button className="btn btn-sm btn-danger" onClick={() => onStop(app.id)}>
            Stop
          </button>
        ) : (
          <button
            className="btn btn-sm btn-primary"
            disabled={!app.scriptName}
            title={!app.scriptName ? "no dev/start script" : undefined}
            onClick={() => onStart(app.id)}
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState([]);
  const [ports, setPorts] = useState([]);
  const [activeLogApp, setActiveLogApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  async function refreshStatus() {
    const status = await window.trazzo.getStatus();
    setApps(status);
  }

  async function refreshPorts() {
    const list = await window.trazzo.listPorts();
    setPorts(list);
  }

  useEffect(() => {
    refreshStatus();
    refreshPorts();
    const interval = setInterval(() => {
      refreshStatus();
      refreshPorts();
    }, 3000);

    const offChanged = window.trazzo.onAppChanged(() => refreshStatus());
    const offLog = window.trazzo.onLogAppend(({ id, line }) => {
      if (id === activeLogApp) {
        setLogs((prev) => [...prev.slice(-500), line]);
      }
    });

    return () => {
      clearInterval(interval);
      offChanged();
      offLog();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLogApp]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  async function handleViewLogs(id) {
    setActiveLogApp(id);
    const existing = await window.trazzo.getLogs(id);
    setLogs(existing);
  }

  async function handleStart(id) {
    await window.trazzo.startApp(id);
    refreshStatus();
  }

  async function handleStop(id) {
    await window.trazzo.stopApp(id);
    refreshStatus();
  }

  async function handleStartAll() {
    await window.trazzo.startAll();
    refreshStatus();
  }

  async function handleStopAll() {
    await window.trazzo.stopAll();
    refreshStatus();
  }

  async function handleKillPort(port) {
    await window.trazzo.killPort(port);
    refreshPorts();
    refreshStatus();
  }

  const activeApp = apps.find((a) => a.id === activeLogApp);

  return (
    <div className="shell">
      <header className="toolbar">
        <h1>Trazzo Control</h1>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={handleStartAll}>
            Start all
          </button>
          <button className="btn btn-danger" onClick={handleStopAll}>
            Stop all
          </button>
        </div>
      </header>

      <main className="main">
        <section className="panel panel-apps">
          <h2>Repos</h2>
          <div className="app-list">
            {apps.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                active={app.id === activeLogApp}
                onStart={handleStart}
                onStop={handleStop}
                onViewLogs={handleViewLogs}
              />
            ))}
            {apps.length === 0 && <p className="muted">No apps discovered yet…</p>}
          </div>

          <h2>Ports in use</h2>
          <div className="port-list">
            {ports.map((p) => (
              <div className="port-row" key={`${p.port}-${p.pid}`}>
                <span className="badge badge-port">:{p.port}</span>
                <span className="muted">{p.command ?? "?"}</span>
                <span className="muted">pid {p.pid}</span>
                <button className="btn btn-sm btn-danger" onClick={() => handleKillPort(p.port)}>
                  Kill
                </button>
              </div>
            ))}
            {ports.length === 0 && <p className="muted">No listening TCP ports found.</p>}
          </div>
        </section>

        <section className="panel panel-logs">
          <h2>{activeApp ? `Logs — ${activeApp.name}` : "Logs"}</h2>
          <pre className="log-view">
            {logs.length === 0 ? "Select an app to view its logs." : logs.join("")}
            <div ref={logsEndRef} />
          </pre>
        </section>
      </main>
    </div>
  );
}
