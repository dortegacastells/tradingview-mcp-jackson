/**
 * Core screenshot/capture logic.
 */
import { getClient, evaluate, getChartCollection } from "../connection.js";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(dirname(dirname(__dirname)), "screenshots");

function sanitiseFilename(name) {
  // Strip path separators, parent-dir refs, and any control chars.
  // Allow only [A-Za-z0-9._-]; collapse everything else to '_'.
  const cleaned = String(name).replace(/[^A-Za-z0-9._-]/g, "_");
  // Reject anything that's empty after sanitisation or starts with a dot.
  if (!cleaned || cleaned.startsWith(".")) {
    throw new Error(`Invalid filename: ${name}`);
  }
  return cleaned;
}

export async function captureScreenshot({ region, filename, method } = {}) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = filename ? sanitiseFilename(filename) : `tv_${region}_${ts}`;
  const filePath = join(SCREENSHOT_DIR, `${fname}.png`);

  if (method === "api") {
    try {
      const colPath = await getChartCollection();
      await evaluate(`${colPath}.takeScreenshot()`);
      return {
        success: true,
        method: "api",
        note: "takeScreenshot() triggered — TradingView will save/show the screenshot via its own UI",
      };
    } catch {
      // Fall through to CDP method
    }
  }

  const client = await getClient();
  let clip = undefined;

  if (region === "chart") {
    const bounds = await evaluate(`
      (function() {
        var el = document.querySelector('[data-name="pane-canvas"]')
          || document.querySelector('[class*="chart-container"]')
          || document.querySelector('canvas');
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()
    `);
    if (bounds)
      clip = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        scale: 1,
      };
  } else if (region === "strategy_tester") {
    const bounds = await evaluate(`
      (function() {
        var el = document.querySelector('[data-name="backtesting"]')
          || document.querySelector('[class*="strategyReport"]');
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()
    `);
    if (bounds)
      clip = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        scale: 1,
      };
  }

  const params = { format: "png" };
  if (clip) params.clip = clip;

  const { data } = await client.Page.captureScreenshot(params);
  const buf = Buffer.from(data, "base64");
  await writeFile(filePath, buf);

  // Neteja screenshots de més de 7 dies
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    for (const f of readdirSync(SCREENSHOT_DIR)) {
      if (!f.endsWith(".png")) continue;
      const fp = join(SCREENSHOT_DIR, f);
      if (statSync(fp).mtimeMs < cutoff) unlinkSync(fp);
    }
  } catch { /* directori buit o error no crític */ }

  return {
    success: true,
    method: "cdp",
    file_path: filePath,
    region,
    size_bytes: buf.length,
  };
}
