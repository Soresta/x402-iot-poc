/**
 * mutation-check.mjs — does the test suite actually catch the bugs it claims to?
 *
 * A green suite proves nothing on its own. This script puts each defect that
 * reached production (or was found and fixed) back into the source, one at a
 * time, runs the suite, and expects it to go RED. A mutation the suite does not
 * catch is a test that is not doing its job.
 *
 * Why this is a committed script and not a throwaway (open item C4): the first
 * mutation run was an ad-hoc Python script in a scratch directory. It crashed on
 * a Windows encoding error AFTER writing a mutation and BEFORE restoring the
 * file, and left the week 3 header bug sitting in the working tree. The suite
 * caught that too — but "the suite is mutation-verified" should not rest on a
 * script nobody can re-run. Restoration here happens in `finally`, and the end
 * of the run re-reads every touched file and refuses to report success if any
 * of them differs from what it was before.
 *
 * Run: node scripts/mutation-check.mjs
 * Takes a few minutes: the suite runs once per mutation.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MUTATIONS = [
  {
    name: "W3 header name: seller reads only X-PAYMENT",
    file: "src/paid-route.ts",
    from: `    c.req.header("payment-signature") ||\n    c.req.header("PAYMENT-SIGNATURE") ||\n    c.req.header("X-PAYMENT") ||`,
    to: `    c.req.header("X-PAYMENT") ||`,
  },
  {
    name: "W4 mandate as bearer token: holder-is-payer check removed",
    file: "src/mandate.ts",
    from: `  if (payerAddress && payerAddress.toLowerCase() !== body.buyer.toLowerCase()) {\n    return reject(401, "identity_mismatch");\n  }`,
    to: `  // mutation: holder-is-payer check removed`,
  },
  {
    name: "W5 classifier: reports the first class, not the most confident",
    file: "src/inference.ts",
    from: `  const top = classes.reduce(\n    (best: any, cur: any) => ((cur?.score ?? -1) > (best?.score ?? -1) ? cur : best),\n    null\n  );`,
    to: `  const top = classes[0] ?? null;`,
  },
  {
    name: "W3 documented codes: underpayment check removed from the screen",
    file: "src/paid-route.ts",
    from: `  if (auth.value !== undefined && Number(auth.value) < priceToAtomic(price)) {\n    return { error: "payment_amount_invalid" };\n  }`,
    to: `  // mutation: underpayment check removed`,
  },
  {
    name: "A3 spending cap: back to the UTC calendar day",
    file: "buyer/budget.mjs",
    from: `    if (t > windowStart && t <= nowMs) total += entry.price;`,
    to: `    if (new Date(t).toISOString().slice(0, 10) === new Date(nowMs).toISOString().slice(0, 10)) total += entry.price;`,
  },
  {
    name: "A5 inference input: validation removed",
    file: "src/inference.ts",
    from: `  const raw = (c.req.query("text") ?? "").toString().trim();\n  if (!raw) return { status: 400, error: "inference_input_required" };`,
    to: `  const raw = (c.req.query("text") ?? "").toString().trim() || "sample";\n  if (!raw) return { status: 400, error: "inference_input_required" };`,
  },
  {
    name: "Receipts: failed settlements recorded as sales",
    file: "src/paid-route.ts",
    from: `  if (!decoded || decoded.success !== true || !decoded.transaction) return false;`,
    to: `  if (!decoded) return false;`,
  },
  {
    name: "A4 signed card: buyer accepts any signature",
    file: "buyer/card-verify.mjs",
    from: `    if (valid) return { ok: true, kid: expectedKid };`,
    to: `    return { ok: true, kid: expectedKid };`,
  },
  {
    name: "A6 rate limit: limiter switched off",
    file: "src/paid-route.ts",
    from: `  if (!env.RATE_LIMITER) return null; // binding absent: payment is still verified downstream`,
    to: `  return null; // mutation: limiter switched off`,
  },
];

function runSuite() {
  try {
    execSync("npx vitest run", { cwd: ROOT, stdio: "pipe", shell: true, timeout: 600_000 });
    return "green";
  } catch {
    return "red";
  }
}

// Line-ending tolerant: match on LF, write back in the file's own style.
function read(file) {
  const raw = readFileSync(join(ROOT, file), "utf8");
  return { raw, crlf: raw.includes("\r\n"), text: raw.replace(/\r\n/g, "\n") };
}

const originals = new Map();
for (const m of MUTATIONS) {
  if (!originals.has(m.file)) originals.set(m.file, readFileSync(join(ROOT, m.file), "utf8"));
}

console.log("Baseline: the suite must be green before any mutation…");
if (runSuite() !== "green") {
  console.error("Suite is red on unmutated code. Fix that first; mutation results would mean nothing.");
  process.exit(2);
}
console.log("Baseline green.\n");

const results = [];
for (const m of MUTATIONS) {
  const { raw, crlf, text } = read(m.file);
  if (!text.includes(m.from)) {
    results.push({ name: m.name, outcome: "ANCHOR NOT FOUND — mutation not applied, result unknown" });
    continue;
  }
  const mutated = text.replace(m.from, m.to);
  try {
    writeFileSync(join(ROOT, m.file), crlf ? mutated.replace(/\n/g, "\r\n") : mutated, "utf8");
    const verdict = runSuite();
    results.push({
      name: m.name,
      outcome: verdict === "red" ? "CAUGHT — suite went red" : "MISSED — suite stayed green",
    });
  } finally {
    writeFileSync(join(ROOT, m.file), raw, "utf8");
  }
}

// Refuse to report anything if restoration did not leave the tree as it was.
let dirty = false;
for (const [file, content] of originals) {
  if (readFileSync(join(ROOT, file), "utf8") !== content) {
    console.error(`RESTORE FAILED: ${file} differs from its pre-run content. Inspect before trusting anything.`);
    dirty = true;
  }
}

console.log("Mutation results:\n");
for (const r of results) console.log(`  ${r.outcome.padEnd(52)} ${r.name}`);

const missed = results.filter((r) => !r.outcome.startsWith("CAUGHT"));
console.log(`\n${results.length - missed.length} of ${results.length} caught.`);
process.exit(dirty ? 3 : missed.length ? 1 : 0);
