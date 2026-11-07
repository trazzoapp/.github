#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DASHBOARD_DIR = join(ROOT, "dashboard");
const HOST = "127.0.0.1";
const PORT = Number(process.env.DASHBOARD_PORT || 3999);

const APPS = [
  {
    id: "landing",
    name: "Landing",
    dir: "trazzo-landing",
    url: "http://localhost:3000",
    probe: "http://localhost:3000/",
    kind: "next",
  },
  {
    id: "api",
    name: "API",
    dir: "trazzo-api",
    url: "http://localhost:3001",
    probe: "http://localhost:3001/health",
    docs: "http://localhost:3001/docs",
    kind: "api",
  },
  {
    id: "webapp",
    name: "Webapp",
    dir: "trazzo-webapp",
    url: "http://localhost:3002",
    probe: "http://localhost:3002/",
    kind: "next",
  },
  {
    id: "clients",
    name: "Clients",
    dir: "trazzo-clients",
    url: "http://localhost:3003",
    probe: "http://localhost:3003/",
    kind: "next",
  },
  {
    id: "marketplace",
    name: "Marketplace",
    dir: "trazzo-marketplace",
    url: "http://localhost:3004",
    probe: "http://localhost:3004/",
    kind: "next",
  },
  {
    id: "admin",
    name: "Admin",
    dir: "trazzo-admin",
    url: "http://localhost:3005",
    probe: "http://localhost:3005/",
    kind: "next",
  },
  {
    id: "app",
    name: "Expo",
    dir: "trazzo-app",
    url: "http://localhost:8081",
    probe: "http://localhost:8081/",
    kind: "expo",
  },
  {
    id: "worker",
    name: "Worker",
    dir: "trazzo-api",
    url: null,
    probe: null,
    kind: "worker",
    note: "No HTTP port — watch its Terminal window.",
  },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function probe(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      ok: response.status < 500,
      status: response.status,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error.name === "AbortError" ? "timeout" : "offline",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readVersion(app) {
  try {
    if (app.kind === "expo") {
      const expo = JSON.parse(await readFile(join(ROOT, app.dir, "app.json"), "utf8"));
      if (expo?.expo?.version) return expo.expo.version;
    }
    const pkg = JSON.parse(await readFile(join(ROOT, app.dir, "package.json"), "utf8"));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

async function statusPayload() {
  const apps = await Promise.all(
    APPS.map(async (app) => {
      const version = await readVersion(app);
      if (!app.probe) {
        return { ...app, version, ok: null, status: null, ms: null };
      }
      const result = await probe(app.probe);
      return { ...app, version, ...result };
    }),
  );
  return { checkedAt: new Date().toISOString(), apps };
}

function runScript(name) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [join(ROOT, "scripts", name)], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    child.on("error", reject);
    resolve({ started: true });
  });
}

async function serveFile(res, relativePath) {
  const target = relativePath === "/" ? "/index.html" : relativePath;
  const filePath = join(DASHBOARD_DIR, target);
  if (!filePath.startsWith(DASHBOARD_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/status") {
    json(res, 200, await statusPayload());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/stop") {
    await runScript("stop-all.sh");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    await serveFile(res, url.pathname);
    return;
  }

  res.writeHead(404).end();
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`dashboard already on http://${HOST}:${PORT}`);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`Trazzo dashboard  http://${HOST}:${PORT}`);
});
