const { app, BrowserWindow, ipcMain, crashReporter, Menu, Tray } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const waitOn = require("wait-on");
const dotenv = require("dotenv");

let mainWindow;
let serverProcess;
let tray;

const PORT = 3001;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
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

function loadWindowState() {
  try {
    const statePath = path.join(app.getPath("userData"), "window-state.json");
    if (fs.existsSync(statePath)) {
      const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
      return {
        width: Math.min(data.width || 1200, 4096),
        height: Math.min(data.height || 800, 2160),
        x: data.x,
        y: data.y,
      };
    }
  } catch (e) {
    console.warn("[electron] window-state load failed:", e?.message);
  }
  return { width: 1200, height: 800 };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    const statePath = path.join(app.getPath("userData"), "window-state.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({ width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y }),
      "utf8"
    );
  } catch (e) {
    console.warn("[electron] window-state save failed:", e?.message);
  }
}

async function createWindowWhenReady() {
  console.log("[electron] waiting for URL…", URL);
  await waitOn({ resources: [URL], timeout: 180_000 });
  const state = loadWindowState();
  const winOpts = {
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  };
  mainWindow = new BrowserWindow(winOpts);
  mainWindow.on("close", saveWindowState);
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

function initCrashReporter() {
  if (process.env.ELECTRON_SMOKE === "1") return;
  try {
    crashReporter.start({
      productName: "papa-app",
      submitURL: process.env.CRASH_REPORT_URL || "",
      uploadToServer: Boolean(process.env.CRASH_REPORT_URL),
    });
  } catch (e) {
    console.warn("[electron] crashReporter.start failed:", e?.message);
  }
}

function handleDeepLink(url) {
  if (!url || typeof url !== "string") return;
  const m = url.match(/^papa:\/\/(\/*)(.*)$/);
  if (!m) return;
  const path = "/" + (m[2] || "").replace(/\/+/g, "/");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.loadURL(URL + path);
  }
}

function createTray() {
  if (process.env.ELECTRON_SMOKE === "1") return;
  try {
    const { nativeImage } = require("electron");
    const icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAhElEQVQ4T2NkYGD4z0ABYBzVwDiaYQygGxhHMzCOZhgDaAbG0QxjAM3AOJphDKAZGEczjAE0A+NohjGAZmAcwzAG0AyMYxjGAJqBcQzDGEAzMI5hGANoBsYxDGMYzQAAmhkGBgYGhv///zMwMDAwMjJCMYxhDGMYwwAAGhkJBiUjAcUAAAAASUVORK5CYII="
    );
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("ПАПА");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Открыть", click: () => mainWindow?.show() },
        { label: "Проверить обновления", click: () => {
          try {
            require("electron-updater").autoUpdater.checkForUpdates();
          } catch (e) {}
        }},
        { type: "separator" },
        { label: "Выход", role: "quit" },
      ])
    );
    tray.on("click", () => mainWindow?.show());
  } catch (e) {
    console.warn("[electron] Tray failed:", e?.message);
  }
}

app.whenReady().then(async () => {
  loadUserEnv();
  initCrashReporter();

  if (app.isPackaged) {
    app.setAsDefaultProtocolClient("papa");
  }

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
      autoUpdater.on("update-available", (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("update-available", info);
        }
      });
      autoUpdater.on("update-downloaded", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("update-downloaded");
        }
        console.log("[electron] update-downloaded (update success)");
      });
      autoUpdater.on("error", (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("update-error", err?.message || "Unknown error");
        }
        console.warn("[electron] autoUpdater error:", err?.message);
      });
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.warn("[electron] autoUpdater not available:", e?.message);
    }
  }

  if (!isSmoke) createTray();

  app.on("open-url", (e, url) => {
    e.preventDefault();
    handleDeepLink(url);
  });

  app.on("second-instance", (_e, argv) => {
    const url = argv.find((a) => a.startsWith("papa://"));
    if (url) handleDeepLink(url);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });

  if (!isSmoke) {
    try {
      const template = [
        {
          label: process.platform === "darwin" ? app.name : "Файл",
          submenu: [
            { label: "Настройки", role: "preferences" },
            { type: "separator" },
            { label: "Выход", role: "quit" },
          ],
        },
        {
          label: "Правка",
          submenu: [
            { label: "Отменить", role: "undo" },
            { label: "Повторить", role: "redo" },
            { type: "separator" },
            { label: "Вырезать", role: "cut" },
            { label: "Копировать", role: "copy" },
            { label: "Вставить", role: "paste" },
          ],
        },
        {
          label: "Вид",
          submenu: [
            { label: "Обновить", role: "reload" },
            { label: " DevTools", role: "toggleDevTools" },
          ],
        },
        {
          label: "Помощь",
          submenu: [
            { label: "О программе", role: "about" },
          ],
        },
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } catch (e) {
      console.warn("[electron] Menu failed:", e?.message);
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

ipcMain.on("install-update", () => {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.quitAndInstall();
  } catch (e) {
    console.warn("[electron] quitAndInstall failed:", e?.message);
  }
});

app.on("before-quit", stopServer);
app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
