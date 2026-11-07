const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, execFile } = require("node:child_process");

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

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true });
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(config, null, 2));
}

/** @type {string|null} */
let rootDir = null;
/** @type {Map<string, { proc: import('node:child_process').ChildProcess, logs: string[] }>} */
const running = new Map();
let mainWindow = null;

const activityLog = [];

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function logActivity(level, message) {
  const entry = { ts: new Date().toISOString(), level, message };
  activityLog.push(entry);
  if (activityLog.length > 300) activityLog.shift();
  console.log(`[trazzo:${level}]`, message);
  send("activity:append", entry);
}

function requireRoot() {
  if (!rootDir) throw new Error("no project folder selected");
  return rootDir;
}

function discoverApps() {
  if (!rootDir) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const apps = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
    const dir = path.join(rootDir, entry.name);
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
    const dir = path.join(rootDir, dirName);
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

// GUI apps on macOS/Linux don't inherit the PATH set up by .zshrc/.bashrc
// (nvm, pnpm, etc.), because they're launched by launchd/the Dock, not a
// shell. Running the command through a login+interactive shell makes it
// see the same PATH the user's terminal does.
function spawnDevProcess(appDef, root) {
  const command = `pnpm -C ${JSON.stringify(appDef.dir)} run ${JSON.stringify(appDef.scriptName)}`;
  if (process.platform === "win32") {
    return { proc: spawn(command, { cwd: root, shell: true, env: process.env }), command };
  }
  const userShell = process.env.SHELL || "/bin/zsh";
  return {
    proc: spawn(userShell, ["-ilc", command], {
      cwd: root,
      env: process.env,
      detached: true,
    }),
    command: `${userShell} -ilc ${JSON.stringify(command)}`,
  };
}

function startApp(id) {
  if (running.has(id)) {
    logActivity("warn", `start ${id}: ya está corriendo`);
    return { ok: false, error: "already running" };
  }
  let root;
  try {
    root = requireRoot();
  } catch (err) {
    logActivity("error", `start ${id}: ${err.message}`);
    return { ok: false, error: err.message };
  }
  const apps = discoverApps();
  const appDef = apps.find((a) => a.id === id);
  if (!appDef || !appDef.scriptName) {
    logActivity("error", `start ${id}: no tiene script "dev" ni "start" en package.json`);
    return { ok: false, error: "no dev/start script" };
  }

  const { proc, command } = spawnDevProcess(appDef, root);
  logActivity("info", `start ${id}: ejecutando "${command}" (cwd=${root}, pid=${proc.pid ?? "?"})`);
  running.set(id, { proc, logs: [] });

  proc.stdout?.on("data", (chunk) => pushLog(id, chunk.toString()));
  proc.stderr?.on("data", (chunk) => pushLog(id, chunk.toString()));
  proc.on("exit", (code, signal) => {
    running.delete(id);
    const reason = signal ? `señal ${signal}` : `código ${code}`;
    pushLog(id, `\n[proceso terminado: ${reason}]\n`);
    logActivity(code === 0 || signal ? "info" : "error", `${id}: proceso terminó (${reason})`);
    send("apps:changed", { id, running: false });
  });
  proc.on("error", (err) => {
    running.delete(id);
    pushLog(id, `\n[no se pudo arrancar: ${err.message}]\n`);
    logActivity("error", `${id}: fallo al arrancar — ${err.message}`);
    send("apps:changed", { id, running: false });
  });

  send("apps:changed", { id, running: true });
  return { ok: true };
}

function stopApp(id) {
  const entry = running.get(id);
  if (!entry) {
    logActivity("warn", `stop ${id}: no está corriendo`);
    return { ok: false, error: "not running" };
  }
  logActivity("info", `stop ${id}: enviando señal a pid ${entry.proc.pid}`);
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(entry.proc.pid), "/f", "/t"]);
  } else {
    try {
      process.kill(-entry.proc.pid, "SIGTERM");
    } catch (err) {
      logActivity("warn", `stop ${id}: kill de grupo falló (${err.message}), probando kill directo`);
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

ipcMain.handle("config:get", () => ({ rootDir }));
ipcMain.handle("config:pick-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select the folder that contains your project repos",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return { rootDir };
  rootDir = result.filePaths[0];
  saveConfig({ ...loadConfig(), rootDir });
  const found = discoverApps();
  logActivity("info", `carpeta elegida: ${rootDir} (${found.length} repos detectados)`);
  return { rootDir };
});
ipcMain.handle("config:clear-folder", () => {
  logActivity("info", "carpeta de proyectos olvidada");
  rootDir = null;
  saveConfig({ ...loadConfig(), rootDir: null });
  return { rootDir };
});

ipcMain.handle("apps:list", () => discoverApps());
ipcMain.handle("apps:status", async () => {
  if (!rootDir) return [];
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
  logActivity("info", `arrancar todo: ${apps.length} repos`);
  return apps.map((a) => ({ id: a.id, ...startApp(a.id) }));
});
ipcMain.handle("apps:stop-all", () => {
  const ids = [...running.keys()];
  logActivity("info", `parar todo: ${ids.length} procesos corriendo`);
  return ids.map((id) => ({ id, ...stopApp(id) }));
});
ipcMain.handle("logs:get", (_e, id) => running.get(id)?.logs ?? []);
ipcMain.handle("ports:list", () => listPorts());
ipcMain.handle("ports:kill", (_e, port) => {
  logActivity("info", `matando puerto ${port}`);
  return killPort(port);
});
ipcMain.handle("shell:open", (_e, url) => shell.openExternal(url));
ipcMain.handle("activity:get", () => activityLog);

function createWindow() {
  const config = loadConfig();
  if (config.rootDir && fs.existsSync(config.rootDir)) {
    rootDir = config.rootDir;
    logActivity("info", `carpeta recordada: ${rootDir}`);
  } else {
    logActivity("info", "sin carpeta de proyectos guardada todavía");
  }

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
