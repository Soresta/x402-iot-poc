/**
 * soak.mjs — timed unattended run of the autonomous buyer (w3t2 DoD evidence).
 *
 * Spawns buyer/agent.mjs, lets it run for SOAK_DURATION_MIN minutes, then stops
 * it and reports the ACTUAL elapsed time and purchase count. The numbers it
 * prints are the numbers that go in the report — no rounding up, no inference.
 *
 * The agent's own budget cap still applies and may end the run early; if it
 * does, that is reported as the reason instead of the timer.
 *
 * Run: node buyer/soak.mjs
 * Env: SOAK_DURATION_MIN (default 60), plus every agent.mjs variable
 *      (SELLER_URL, LOOP_INTERVAL_MS, DAILY_CAP, MAX_PER_CALL, …)
 */

import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const DURATION_MIN = Number(process.env.SOAK_DURATION_MIN) || 60;
const LOG_DIR = join(REPO_ROOT, "docs", "week3");
mkdirSync(LOG_DIR, { recursive: true });
const LOG_PATH = join(LOG_DIR, "soak-run.log");

const startedAt = new Date();
const log = createWriteStream(LOG_PATH, { flags: "a" });

function emit(line) {
  process.stdout.write(line + "\n");
  log.write(line + "\n");
}

emit(`\n=== SOAK RUN START ${startedAt.toISOString()} ===`);
emit(`planned duration: ${DURATION_MIN} min`);
emit(`seller: ${process.env.SELLER_URL || "http://127.0.0.1:8787"}`);
emit(`interval: ${process.env.LOOP_INTERVAL_MS || "30000"} ms | daily cap: $${process.env.DAILY_CAP || "0.05"}`);

const child = spawn(process.execPath, [join(__dirname, "agent.mjs")], {
  env: process.env,
  cwd: REPO_ROOT,
});

let purchases = 0;
let stoppedEarlyReason = null;

function handleChunk(buf) {
  for (const line of buf.toString().split("\n")) {
    if (!line.trim()) continue;
    emit(line);
    if (line.includes("✅ Purchased")) purchases++;
    if (line.includes("DAILY CAP REACHED")) stoppedEarlyReason = "daily_cap";
    if (line.includes("Kill switch active")) stoppedEarlyReason = "kill_switch";
    if (line.includes("MANDATE INVALID")) stoppedEarlyReason = "mandate_invalid";
  }
}

child.stdout.on("data", handleChunk);
child.stderr.on("data", handleChunk);

const timer = setTimeout(() => {
  emit(`\n[soak] ${DURATION_MIN} min elapsed — stopping the agent.`);
  child.kill();
}, DURATION_MIN * 60_000);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  const endedAt = new Date();
  const elapsedMs = endedAt - startedAt;
  const h = Math.floor(elapsedMs / 3_600_000);
  const m = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const s = Math.round((elapsedMs % 60_000) / 1000);

  emit(`\n=== SOAK RUN END ${endedAt.toISOString()} ===`);
  emit(`actual elapsed : ${h}h ${m}m ${s}s (${Math.round(elapsedMs / 1000)} s)`);
  emit(`purchases      : ${purchases}`);
  emit(`volume         : $${(purchases * 0.001).toFixed(3)} USDC (at $0.001/call)`);
  emit(`ended by       : ${stoppedEarlyReason ?? "soak timer"}`);
  emit(`child exit     : code=${code} signal=${signal}`);
  emit(`log written to : ${LOG_PATH}`);
  log.end();
});
