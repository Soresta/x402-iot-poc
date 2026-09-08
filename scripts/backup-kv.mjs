/**
 * backup-kv.mjs — dump the production KV namespace to a timestamped JSON file.
 *
 * The receipt log is the only record of settlements we hold outside the chain,
 * and the subscriber list is the only copy of the email list. Both live in one
 * KV namespace with no backup unless someone takes one. This is that someone.
 *
 * Usage:
 *   node scripts/backup-kv.mjs                 → ./backups/kv-YYYY-MM-DD.json
 *   node scripts/backup-kv.mjs --out path.json
 *
 * WHAT THIS FILE CONTAINS, and why it must not be committed or shared casually:
 * subscriber email addresses. `backups/` is gitignored. Treat a backup like the
 * list itself — because it is the list.
 *
 * Keys with a short TTL (idempotency keys, the SSE event) will often be absent.
 * That is correct: they are cache, not records.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NAMESPACE_ID = "4ef9455bb906422f984e2eab491236c9"; // IOT_KV

/**
 * Run wrangler. On Windows `npx` is a .cmd, which Node will not execFile
 * directly (EINVAL), so this goes through a shell — which means every argument
 * that reaches it must be safe to interpolate. Key names come from our own KV,
 * but "our own data" is exactly the assumption that makes injection bugs, so
 * they are validated at the call site instead of trusted.
 */
function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
  });
}

/** KV key names we are willing to hand to a shell. */
const SAFE_KEY = /^[A-Za-z0-9:_\-.]{1,512}$/;

/** Wrangler prints human lines before the JSON payload; take from the first bracket. */
function parseJsonTail(output, opener) {
  const start = output.indexOf(opener);
  if (start === -1) throw new Error(`no JSON found in wrangler output:\n${output.slice(0, 400)}`);
  return JSON.parse(output.slice(start));
}

const outFlag = process.argv.indexOf("--out");
const outPath =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : join(REPO_ROOT, "backups", `kv-${new Date().toISOString().slice(0, 10)}.json`);

console.log(`Listing keys in ${NAMESPACE_ID}…`);
const keys = parseJsonTail(
  wrangler(["kv", "key", "list", "--namespace-id", NAMESPACE_ID, "--remote"]),
  "["
);
console.log(`${keys.length} keys.`);

const entries = {};
let failures = 0;

for (const { name } of keys) {
  if (!SAFE_KEY.test(name)) {
    failures += 1;
    entries[name] = null;
    console.warn(`  skipped ${JSON.stringify(name)} — key name outside the safe character set`);
    continue;
  }
  try {
    const value = wrangler(["kv", "key", "get", name, "--namespace-id", NAMESPACE_ID, "--remote"]);
    entries[name] = value;
  } catch (err) {
    // A key can expire between the list and the read. Record the gap rather
    // than aborting a backup that is otherwise fine.
    failures += 1;
    entries[name] = null;
    console.warn(`  could not read ${name} (expired between list and read?)`);
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      namespace_id: NAMESPACE_ID,
      taken_at: new Date().toISOString(),
      key_count: keys.length,
      unreadable: failures,
      note: "Contains subscriber email addresses. Handle as personal data.",
      entries,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`\nWrote ${outPath}`);
console.log(`  keys: ${keys.length}, unreadable: ${failures}`);
if (failures) {
  console.log("  (unreadable keys are usually short-TTL cache entries, not records)");
}
