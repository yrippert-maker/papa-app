#!/usr/bin/env node
/**
 * Playwright Electron smoke: проверяет, что Electron запустился, окно загрузило
 * http://127.0.0.1:3001, UI не белый экран. Требует ELECTRON_SKIP_SERVER=1
 * (сервер уже поднят start-server-and-test).
 *
 * ELECTRON_ARGS — опционально, например "path/to/main" для нестандартного entrypoint.
 * SMOKE_ARTIFACTS_DIR — директория артефактов (по умолчанию /tmp/electron-smoke).
 */
import { _electron as electron } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const EXPECT_PREFIXES = ["http://127.0.0.1:3001", "http://localhost:3001"];
const TIMEOUT_MS = 60_000;
const ART_DIR = process.env.SMOKE_ARTIFACTS_DIR || "/tmp/electron-smoke";

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}
function save(p, data) {
  ensureDir(ART_DIR);
  writeFileSync(path.join(ART_DIR, p), data);
}
function nowIso() {
  return new Date().toISOString();
}

function getElectronArgs() {
  const envArgs = process.env.ELECTRON_ARGS;
  if (envArgs && envArgs.trim()) {
    return envArgs.trim().split(/\s+/).map((a) => a.replace(/^["']|["']$/g, ""));
  }
  return ["."];
}

async function main() {
  ensureDir(ART_DIR);

  const errors = [];
  let app;
  let page;

  try {
    app = await electron.launch({
      args: getElectronArgs(),
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ELECTRON_SKIP_SERVER: process.env.ELECTRON_SKIP_SERVER || "1",
        ELECTRON_SMOKE: "1",
        ELECTRON_ENABLE_LOGGING: "1",
        ELECTRON_ENABLE_STACK_DUMPING: "1",
        ELECTRON_DISABLE_GPU: "1",
      },
      timeout: TIMEOUT_MS,
    });

    page = await app.firstWindow({ timeout: TIMEOUT_MS });
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });
    page.on("close", () => errors.push("page: close event"));

    await page.waitForLoadState("domcontentloaded", { timeout: TIMEOUT_MS });

    const url = page.url();
    save("meta.txt", `time=${nowIso()}\nurl=${url}\n`);

    const allowed = EXPECT_PREFIXES.some((p) => url.startsWith(p));
    if (!allowed) throw new Error(`Unexpected URL: ${url}`);

    // Строгая проверка UI: app-root, иначе fallback на non-empty body
    try {
      await page.waitForSelector('[data-testid="app-root"]', { timeout: 10_000 });
    } catch {
      const textLen = await page.evaluate(() => (document.body?.innerText || "").trim().length);
      if (textLen === 0) throw new Error("Blank screen: body.innerText is empty");
    }

    // Дать 2s на ранние runtime ошибки
    await new Promise((r) => setTimeout(r, 2000));

    if (errors.length) {
      save("console-errors.txt", errors.join("\n") + "\n");
      throw new Error(`Console/page errors detected (${errors.length})`);
    }

    // Успех — всё равно можно сохранить минимальный meta
    save("result.txt", `OK ${nowIso()}\n`);
    console.log("OK: electron smoke passed");
    process.exit(0);
  } catch (e) {
    // Dump для диагностики
    try {
      save("error.txt", `${nowIso()}\n${e?.stack || String(e)}\n`);
      if (errors.length) save("console-errors.txt", errors.join("\n") + "\n");

      if (page) {
        const url = page.url();
        save("url.txt", url + "\n");
        try {
          const html = await page.content();
          save("page.html", html);
        } catch (err2) {
          save("page-html-error.txt", String(err2) + "\n");
        }

        try {
          await page.screenshot({ path: path.join(ART_DIR, "screenshot.png"), fullPage: true });
        } catch (err3) {
          save("screenshot-error.txt", String(err3) + "\n");
        }
      }
    } catch (dumpErr) {
      console.error("Failed to dump artifacts:", dumpErr);
    }

    console.error("FAIL:", e?.message || String(e));
    process.exit(1);
  } finally {
    try {
      if (app) await app.close();
    } catch {
      // ignore
    }
  }
}

main();
