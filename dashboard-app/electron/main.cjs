const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, execFile } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const IGNORE_DIRS = new Set([
  "node_modules",
  "dashboard-app",
  "dashboard",
  "scripts",
  ".git",
  ".github",
  ".claude",
  "profile",
  "release",
]);

/** @type {Map<string, { proc: import('node:child_process').ChildProcess, logs: string[] }>} */
const running = new Map();
let mainWindow = null;

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function discoverApps() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const apps = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
    const dir = path.join(ROOT, entry.name);
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    const scripts = pkg.scripts || {};
    const scriptName = scripts.dev ? "dev" : scripts.start ? "start" : null;
    const scriptCmd = scriptName ? scripts[scriptName] : null;
    let port = null;
    if (scriptCmd) {
      const match = scriptCmd.match(/(?:-p|--port)\s+(\d+)/);
      if (match) port = Number(match[1]);
      else if (/expo start/.test(scriptCmd)) port = 8081;
      else if (/next dev/.test(scriptCmd)) port = 3000;
    }
    if (port === null) {
      for (const envFile of [".env", ".env.local", ".env.example"]) {
        const envPath = path.join(dir, envFile);
        if (!fs.existsSync(envPath)) continue;
        const match = fs.readFileSync(envPath, "utf8").match(/^PORT=(\d+)/m);
        if (match) {
          port = Number(match[1]);
          break;
        }
      }
    }
    apps.push({
      id: entry.name,
      name: pkg.name || entry.name,
      dir: entry.name,
      scriptName,
      scriptCmd,
      port,
      hasWorker: Boolean(scripts["dev:worker"]),
    });
  }
  apps.sort((a, b) => a.id.localeCompare(b.id));
  return apps;
}

function gitStatus(dirName) {
  return new Promise((resolve) => {
    const dir = path.join(ROOT, dirName);
    execFile(
      "git",
      ["-C", dir, "status", "--porcelain=v2", "--branch"],
      { timeout: 4000 },
      (error, stdout) => {
        if (error) {
          resolve({ ok: false, branch: null, ahead: 0, behind: 0, dirty: 0 });
          return;
        }
        const lines = stdout.split("\n").filter(Boolean);
        let branch = null;
        let ahead = 0;
        let behind = 0;
        let dirty = 0;
        for (const line of lines) {
          if (line.startsWith("# branch.head")) {
            branch = line.split(" ")[2];
          } else if (line.startsWith("# branch.ab")) {
            const parts = line.split(" ");
            ahead = Number(parts[2].replace("+", ""));
            behind = Number(parts[3].replace("-", ""));
          } else if (!line.startsWith("#")) {
            dirty += 1;
          }
        }
        resolve({ ok: true, branch, ahead, behind, dirty });
      },
    );
  });
}

function isRunning(id) {
  return running.has(id);
}

function pushLog(id, line) {
  const entry = running.get(id);
  if (entry) {
    entry.logs.push(line);
    if (entry.logs.length > 500) entry.logs.shift();
  }
  send("logs:append", { id, line });
}

function startApp(id) {
  if (running.has(id)) return { ok: false, error: "already running" };
  const apps = discoverApps();
  const appDef = apps.find((a) => a.id === id);
  if (!appDef || !appDef.scriptName) return { ok: false, error: "no dev/start script" };

  const proc = spawn("pnpm", ["-C", appDef.dir, "run", appDef.scriptName], {
    cwd: ROOT,
    shell: process.platform === "win32",
    env: process.env,
    detached: process.platform !== "win32",
  });
  running.set(id, { proc, logs: [] });

  proc.stdout?.on("data", (chunk) => pushLog(id, chunk.toString()));
  proc.stderr?.on("data", (chunk) => pushLog(id, chunk.toString()));
  proc.on("exit", (code) => {
    running.delete(id);
    pushLog(id, `\n[process exited with code ${code}]\n`);
    send("apps:changed", { id, running: false });
  });
  proc.on("error", (err) => {
    running.delete(id);
    pushLog(id, `\n[failed to start: ${err.message}]\n`);
    send("apps:changed", { id, running: false });
  });

  send("apps:changed", { id, running: true });
  return { ok: true };
}

function stopApp(id) {
  const entry = running.get(id);
  if (!entry) return { ok: false, error: "not running" };
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(entry.proc.pid), "/f", "/t"]);
  } else {
    try {
      process.kill(-entry.proc.pid, "SIGTERM");
    } catch {
      entry.proc.kill("SIGTERM");
    }
  }
  return { ok: true };
}

function listPorts() {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("netstat", ["-ano"], { timeout: 4000 }, (error, stdout) => {
        if (error) return resolve([]);
        const ports = [];
        for (const line of stdout.split("\n")) {
          const match = line.match(/TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
          if (match) ports.push({ port: Number(match[1]), pid: Number(match[2]), command: null });
        }
        resolve(ports);
      });
      return;
    }
    execFile(
      "lsof",
      ["-nP", "-iTCP", "-sTCP:LISTEN"],
      { timeout: 4000 },
      (error, stdout) => {
        if (error && !stdout) return resolve([]);
        const lines = stdout.split("\n").slice(1).filter(Boolean);
        const ports = lines.map((line) => {
          const cols = line.trim().split(/\s+/);
          const command = cols[0];
          const pid = Number(cols[1]);
          const nameCol = cols[cols.length - 2] || "";
          const portMatch = nameCol.match(/:(\d+)$/);
          return { port: portMatch ? Number(portMatch[1]) : null, pid, command };
        });
        resolve(ports.filter((p) => p.port));
      },
    );
  });
}

function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("netstat", ["-ano"], { timeout: 4000 }, (error, stdout) => {
        if (error) return resolve({ ok: false });
        const match = stdout
          .split("\n")
          .find((l) => new RegExp(`:${port}\\s+\\S+\\s+LISTENING`).test(l));
        if (!match) return resolve({ ok: false, error: "not found" });
        const pid = match.trim().split(/\s+/).pop();
        execFile("taskkill", ["/pid", pid, "/f"], () => resolve({ ok: true }));
      });
      return;
    }
    execFile("lsof", ["-nP", "-iTCP:" + port, "-sTCP:LISTEN", "-t"], (error, stdout) => {
      const pids = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!pids.length) return resolve({ ok: false, error: "not found" });
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          // already gone
        }
      }
      resolve({ ok: true });
    });
  });
}

ipcMain.handle("apps:list", () => discoverApps());
ipcMain.handle("apps:status", async () => {
  const apps = discoverApps();
  const result = await Promise.all(
    apps.map(async (a) => ({
      ...a,
      running: isRunning(a.id),
      git: await gitStatus(a.dir),
    })),
  );
  return result;
});
ipcMain.handle("apps:start", (_e, id) => startApp(id));
ipcMain.handle("apps:stop", (_e, id) => stopApp(id));
ipcMain.handle("apps:start-all", () => {
  const apps = discoverApps();
  return apps.map((a) => ({ id: a.id, ...startApp(a.id) }));
});
ipcMain.handle("apps:stop-all", () => {
  const ids = [...running.keys()];
  return ids.map((id) => ({ id, ...stopApp(id) }));
});
ipcMain.handle("logs:get", (_e, id) => running.get(id)?.logs ?? []);
ipcMain.handle("ports:list", () => listPorts());
ipcMain.handle("ports:kill", (_e, port) => killPort(port));
ipcMain.handle("shell:open", (_e, url) => shell.openExternal(url));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Trazzo Control",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, "..", "dist", "index.html")}`;
  mainWindow.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  for (const id of [...running.keys()]) stopApp(id);
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  for (const id of [...running.keys()]) stopApp(id);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
