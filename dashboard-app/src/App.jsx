import React, { useEffect, useState } from "react";
import Onboarding from "./Onboarding.jsx";
import AppCard from "./AppCard.jsx";
import LogsModal from "./LogsModal.jsx";
import ActivityLog from "./ActivityLog.jsx";

function PortsTab({ ports, onKill }) {
  if (ports.length === 0) {
    return <p className="muted">No hay puertos TCP escuchando.</p>;
  }
  return (
    <div className="port-grid">
      {ports.map((p) => (
        <div className="card port-card" key={`${p.port}-${p.pid}`}>
          <span className="badge badge-port">:{p.port}</span>
          <div className="port-card-info">
            <strong>{p.command ?? "?"}</strong>
            <span className="muted">pid {p.pid}</span>
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => onKill(p.port)}>
            Matar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [rootDir, setRootDir] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState("apps");
  const [apps, setApps] = useState([]);
  const [ports, setPorts] = useState([]);
  const [logsAppId, setLogsAppId] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    window.trazzo.getConfig().then((c) => setRootDir(c.rootDir ?? null));
  }, []);

  async function refreshStatus() {
    const status = await window.trazzo.getStatus();
    setApps(status);
  }

  async function refreshPorts() {
    const list = await window.trazzo.listPorts();
    setPorts(list);
  }

  useEffect(() => {
    if (!rootDir) return;
    refreshStatus();
    refreshPorts();
    const interval = setInterval(() => {
      refreshStatus();
      refreshPorts();
    }, 3000);

    const offChanged = window.trazzo.onAppChanged(() => refreshStatus());
    const offLog = window.trazzo.onLogAppend(({ id, line }) => {
      setLogsAppId((current) => {
        if (id === current) setLogs((prev) => [...prev.slice(-500), line]);
        return current;
      });
    });

    return () => {
      clearInterval(interval);
      offChanged();
      offLog();
    };
  }, [rootDir]);

  async function handlePickFolder() {
    const c = await window.trazzo.pickFolder();
    setRootDir(c.rootDir ?? null);
  }

  async function handleChangeFolder() {
    const c = await window.trazzo.pickFolder();
    if (c.rootDir) setRootDir(c.rootDir);
  }

  async function handleViewLogs(id) {
    setLogsAppId(id);
    const existing = await window.trazzo.getLogs(id);
    setLogs(existing);
  }

  async function handleStart(id) {
    const result = await window.trazzo.startApp(id);
    if (!result.ok) window.alert(`No se pudo arrancar ${id}: ${result.error}`);
    refreshStatus();
  }

  async function handleStop(id) {
    const result = await window.trazzo.stopApp(id);
    if (!result.ok) window.alert(`No se pudo parar ${id}: ${result.error}`);
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

  if (rootDir === undefined) return null; // loading config
  if (!rootDir) return <Onboarding onPickFolder={handlePickFolder} />;

  const logsApp = apps.find((a) => a.id === logsAppId) ?? null;

  return (
    <div className="shell">
      <header className="toolbar">
        <div className="toolbar-title">
          <h1>Trazzo Control</h1>
          <button className="folder-pill" onClick={handleChangeFolder} title={rootDir}>
            📁 {rootDir.split("/").pop()}
          </button>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={handleStartAll}>
            Arrancar todo
          </button>
          <button className="btn btn-danger" onClick={handleStopAll}>
            Parar todo
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === "apps" ? "tab-active" : ""}`} onClick={() => setTab("apps")}>
          Apps ({apps.length})
        </button>
        <button className={`tab ${tab === "ports" ? "tab-active" : ""}`} onClick={() => setTab("ports")}>
          Puertos ({ports.length})
        </button>
      </nav>

      <main className="main">
        {tab === "apps" ? (
          apps.length === 0 ? (
            <p className="muted">No se encontraron repos con package.json en esta carpeta.</p>
          ) : (
            <div className="app-grid">
              {apps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onStart={handleStart}
                  onStop={handleStop}
                  onViewLogs={handleViewLogs}
                />
              ))}
            </div>
          )
        ) : (
          <PortsTab ports={ports} onKill={handleKillPort} />
        )}
      </main>

      <LogsModal app={logsApp} logs={logs} onClose={() => setLogsAppId(null)} />
      <ActivityLog />
    </div>
  );
}
