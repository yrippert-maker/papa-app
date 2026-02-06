const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const waitOn = require("wait-on");
const dotenv = require("dotenv");

let mainWindow;
let serverProcess;

const PORT = 3001;
const URL = `http://127.0.0.1:${PORT}`;

/** Загрузить env из userData/config.env; при первом запуске создать из шаблона. */
function loadUserEnv() {
  const userDataDir = app.getPath("userData");
  const envPath = path.join(userDataDir, "config.env");
  const examplePath = path.join(__dirname, "..", "env.production.example");

  if (!fs.existsSync(envPath)) {
    fs.mkdirSync(userDataDir, { recursive: true });
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log("[env] config.env created from template:", envPath);
    } else {
      fs.writeFileSync(envPath, "");
      console.log("[env] empty config.env created:", envPath);
    }
  }

  dotenv.config({ path: envPath });
  console.log("[env] loaded from", envPath);
  return envPath;
}

function spawnProcess(cmd, args, opts) {
  return spawn(cmd, args, { stdio: "inherit", ...opts });
}

function startDevServer() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  serverProcess = spawnProcess(npmCmd, ["run", "dev"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
  });
}

function startProdServerStandalone(resourcesRoot) {
  const serverJs = path.join(resourcesRoot, "standalone", "server.js");
  const cwd = path.join(resourcesRoot, "standalone");

  serverProcess = spawnProcess(process.execPath, [serverJs], {
    cwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
    },
  });
  // process.env уже содержит NEXTAUTH_* из loadUserEnv()
  serverProcess.on("error", (err) => {
    console.error("[server] spawn error:", err);
  });
  serverProcess.on("exit", (code, signal) => {
    console.error("[server] exit code=%s signal=%s", code, signal);
  });
  // при stdio: "inherit" stderr сервера уже идёт в консоль; при смене на pipe — раскомментировать:
  // if (serverProcess.stderr) serverProcess.stderr.on("data", (c) => process.stderr.write(c));
}

async function createWindowWhenReady() {
  console.log("[electron] waiting for URL…", URL);
  await waitOn({ resources: [URL], timeout: 180_000 });
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(false);
  });

  mainWindow.webContents.on("will-attach-webview", (e) => {
    e.preventDefault();
  });

  const isAllowedUrl = (url) =>
    (url.startsWith("http://127.0.0.1:3001") || url.startsWith("http://localhost:3001")) &&
    !url.startsWith("file://");

  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://") || !isAllowedUrl(url)) e.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (e, url) => {
    if (url.startsWith("file://") || !isAllowedUrl(url)) e.preventDefault();
  });

  await mainWindow.loadURL(URL);
  console.log("[electron] window created.");

  mainWindow.webContents.on("did-finish-load", () => {
    if (!app.isPackaged) {
      console.log("ELECTRON_UI_READY=1");
    }
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  loadUserEnv();

  const isSmoke = process.env.ELECTRON_SMOKE === "1";

  if (!isSmoke && process.env.SENTRY_DSN && app.isPackaged) {
    try {
      require("@sentry/electron/main").init({ dsn: process.env.SENTRY_DSN });
    } catch (e) {
      console.warn("[electron] Sentry init skipped:", e?.message);
    }
  }

  const isPackaged = app.isPackaged;
  const wantProd = isPackaged || process.env.ELECTRON_START === "prod";
  const skipServer = process.env.ELECTRON_SKIP_SERVER === "1";

  if (skipServer) {
    console.log("[electron] ELECTRON_SKIP_SERVER=1, using external server");
  } else if (wantProd) {
    console.log("[electron] starting server… (PORT=%s)", PORT);
    const resourcesRoot = isPackaged
      ? path.join(process.resourcesPath, "papa-bundle")
      : path.join(__dirname, "bundle");
    startProdServerStandalone(resourcesRoot);
  } else {
    console.log("[electron] starting server… (dev, PORT=%s)", PORT);
    startDevServer();
  }

  try {
    await createWindowWhenReady();
  } catch (err) {
    console.error("wait-on failed:", err);
    app.quit();
  }

  if (app.isPackaged && !isSmoke) {
    try {
      const { autoUpdater } = require("electron-updater");
      const v = app.getVersion();
      if (/\-nightly/.test(v)) {
        autoUpdater.channel = "nightly";
        autoUpdater.allowPrerelease = true;
      } else if (/\-beta/.test(v)) {
        autoUpdater.channel = "beta";
        autoUpdater.allowPrerelease = true;
      } else if (/\-alpha/.test(v)) {
        autoUpdater.channel = "alpha";
        autoUpdater.allowPrerelease = true;
      }
      autoUpdater.on("update-downloaded", () => {
        console.log("[electron] update-downloaded (update success)");
      });
      autoUpdater.on("error", (err) => {
        console.warn("[electron] autoUpdater error:", err?.message);
      });
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.warn("[electron] autoUpdater not available:", e?.message);
    }
  }
});

function configPath() {
  return path.join(app.getPath("userData"), "config.env");
}

ipcMain.handle("config:read", async () => {
  const p = configPath();
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
});

ipcMain.handle("config:write", async (_e, text) => {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, "utf8");
  return true;
});

ipcMain.handle("app:restart", async () => {
  app.relaunch();
  app.exit(0);
});

app.on("before-quit", stopServer);
app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
