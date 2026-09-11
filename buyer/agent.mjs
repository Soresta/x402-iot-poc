/**
 * agent.mjs — Autonomous buyer agent
 *
 * Loop: discover → verify mandate → check budget → pay → append ledger
 *
 * Hard constraints (from internship brief §1):
 *   C4: Every autonomous spender has a hard budget cap AND a kill switch.
 *   C6: No private key material in any log line.
 *
 * Kill switch: set BUYER_ENABLED=false in environment.
 * Budget cap: DAILY_CAP env var (USDC); enforced BEFORE payment attempt.
 * Ledger: append-only JSONL file at buyer/ledger.jsonl (gitignored).
 *
 * Run: node buyer/agent.mjs
 * Stop: Ctrl+C (clean exit) or set BUYER_ENABLED=false
 */

import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createMandate, verifyMandate, checkPriceInScope } from "./mandate.mjs";
import { spentInWindow } from "./budget.mjs";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY;
const SELLER_URL = process.env.SELLER_URL || "http://127.0.0.1:8787";
const LOOP_INTERVAL_MS = Number(process.env.LOOP_INTERVAL_MS) || 30_000;
const DAILY_CAP = parseFloat(process.env.DAILY_CAP || "0.05");    // USDC, over any rolling 24 h
const MAX_PER_CALL = parseFloat(process.env.MAX_PER_CALL || "0.002"); // USDC
const MANDATE_EXPIRY_HOURS = Number(process.env.MANDATE_EXPIRY_HOURS) || 24;

if (!BUYER_PRIVATE_KEY) {
  console.error("[agent] FATAL: BUYER_PRIVATE_KEY not set. Exiting.");
  process.exit(1);
}

if (isNaN(DAILY_CAP) || DAILY_CAP <= 0) {
  console.error("[agent] FATAL: DAILY_CAP must be a positive number. Exiting.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LEDGER_PATH = join(__dirname, "ledger.jsonl");

const account = privateKeyToAccount(BUYER_PRIVATE_KEY);
console.log(`[agent] Buyer address: ${account.address}`);
console.log(`[agent] Seller URL: ${SELLER_URL}`);
console.log(`[agent] Daily cap: $${DAILY_CAP} USDC | Max per call: $${MAX_PER_CALL} USDC`);
console.log(`[agent] Loop interval: ${LOOP_INTERVAL_MS}ms`);
console.log(`[agent] Kill switch: set BUYER_ENABLED=false to stop`);

// x402 client
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });
const paidFetch = wrapFetchWithPayment(fetch, client);

// ---------------------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------------------

function appendLedger(entry) {
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(LEDGER_PATH, line, "utf8");
}

/** Spend over the last 24 hours — a rolling window, not the UTC calendar day. */
function readRunningTotal() {
  if (!existsSync(LEDGER_PATH)) return 0;
  const entries = [];
  for (const line of readFileSync(LEDGER_PATH, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {}
  }
  return spentInWindow(entries, Date.now());
}

// ---------------------------------------------------------------------------
// Mandate (created once at startup, re-verified every iteration)
// ---------------------------------------------------------------------------

const mandateExpiry = new Date(Date.now() + MANDATE_EXPIRY_HOURS * 3600_000).toISOString();
const mandateBody = {
  buyer: account.address,
  seller: SELLER_URL,
  max_per_call: MAX_PER_CALL,
  daily_cap: DAILY_CAP,
  currency: "USDC",
  expiry: mandateExpiry,
  nonce: crypto.randomUUID(),
};
const mandate = await createMandate(account, mandateBody);
console.log(`[agent] Mandate created. Expiry: ${mandateExpiry}`);

// The seller verifies this too (identity 401 / authorization 403). Week 3
// checked the mandate on the buyer only, which is an honour system.
const mandateHeader = Buffer.from(JSON.stringify(mandate), "utf8").toString("base64");

// ---------------------------------------------------------------------------
// Backoff state
// ---------------------------------------------------------------------------

let consecutiveErrors = 0;
const MAX_RETRIES = 5;

function backoffMs(errors) {
  const base = 1000 * Math.pow(2, errors);
  const capped = Math.min(base, 30_000);
  const jitter = capped * (0.8 + Math.random() * 0.4); // ±20%
  return Math.floor(jitter);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

async function discoverSeller() {
  const res = await fetch(`${SELLER_URL}/.well-known/agent-card.json`);
  if (!res.ok) throw new Error(`agent-card fetch failed: ${res.status}`);
  const card = await res.json();
  const skills = card.skills ?? [];
  if (skills.length === 0) throw new Error("agent-card has no skills");

  // The seller may advertise several priced resources. Take them all; the loop
  // rotates through whichever ones this mandate can afford.
  return skills.map((skill) => {
    const priceStr = skill.payment?.price || "$0.001";
    return {
      id: skill.id,
      priceStr,
      price: parseFloat(priceStr.replace(/[^0-9.]/g, "")),
      resource: skill.payment?.resource || `${SELLER_URL}/api/readings`,
      // Inference needs an input; a reading does not.
      query: skill.inputModes?.includes("text/plain")
        ? `?text=${encodeURIComponent("machine payments, observed from the inside")}`
        : "",
    };
  });
}

// Rotates across resources so a long run exercises every one of them.
let resourceCursor = 0;

// ---------------------------------------------------------------------------
// Single purchase iteration
// ---------------------------------------------------------------------------

async function onePurchase() {
  // 0. Kill switch — checked at the very top of every iteration
  if (process.env.BUYER_ENABLED === "false") {
    console.log("[agent] Kill switch active (BUYER_ENABLED=false). Stopping.");
    return "killed";
  }

  // 1. Verify mandate (every iteration — catches expiry mid-run)
  const { valid, reason } = await verifyMandate(mandate);
  if (!valid) {
    console.error(`[agent] MANDATE INVALID: ${reason}. No payment attempted.`);
    appendLedger({ ts: new Date().toISOString(), result: "mandate_invalid", reason });
    return "mandate_invalid";
  }

  // 2. Discover seller (agent card) — may advertise several resources
  let offers;
  try {
    offers = await discoverSeller();
  } catch (err) {
    console.error(`[agent] Discovery failed: ${err.message}`);
    return "discovery_error";
  }

  // 3. Pick the next resource this mandate can afford. Rotating means a long
  // run buys every advertised product, not just the cheapest one.
  let affordable = offers.filter((o) => checkPriceInScope(mandateBody, o.price).allowed);

  // A2A price negotiation: for anything we cannot afford at list price, counter
  // at our per-call limit and let the seller decide. A decline is a normal
  // answer, not an error — we simply do not buy that resource this round.
  const tooExpensive = offers.filter((o) => !checkPriceInScope(mandateBody, o.price).allowed);
  for (const offer of tooExpensive) {
    const counter = mandateBody.max_per_call;
    try {
      const res = await fetch(
        `${SELLER_URL}/api/negotiate?resource=${encodeURIComponent(offer.id.replace(/^sell-/, "").replace("iot-reading", "readings"))}&offer=${counter}`
      );
      if (!res.ok) continue;
      const quote = await res.json();
      if (quote.accepted) {
        console.log(`[agent] Counter-offer accepted for ${offer.id} at $${counter}`);
        affordable.push({ ...offer, price: counter, priceStr: `$${counter}` });
      } else {
        console.log(
          `[agent] Counter-offer declined for ${offer.id}: offered $${counter}, they want $${quote.counter_usdc}`
        );
      }
    } catch {
      // Negotiation is optional. A seller without it is not a broken seller.
    }
  }

  if (affordable.length === 0) {
    const cheapest = offers.reduce((a, b) => (a.price <= b.price ? a : b));
    const { reason: scopeReason } = checkPriceInScope(mandateBody, cheapest.price);
    console.error(`[agent] Nothing on offer fits the mandate: ${scopeReason}. No payment attempted.`);
    appendLedger({ ts: new Date().toISOString(), result: "scope_rejected", reason: scopeReason });
    return "scope_rejected";
  }

  const offer = affordable[resourceCursor % affordable.length];
  resourceCursor++;
  const { price, priceStr, resource: resourceUrl, id: skillId, query } = offer;
  const resource = `${resourceUrl}${query}`;

  // 4. Check daily budget cap BEFORE payment attempt
  const runningTotal = readRunningTotal();
  if (runningTotal + price > DAILY_CAP) {
    console.log(
      `[agent] DAILY CAP REACHED. spent=${runningTotal.toFixed(4)} + price=${price} > cap=${DAILY_CAP}. Stopping.`
    );
    appendLedger({
      ts: new Date().toISOString(),
      result: "cap_reached",
      runningTotal,
      price,
      daily_cap: DAILY_CAP,
    });
    return "cap_reached";
  }

  // 5. Pay and consume
  console.log(
    `[agent] Paying ${priceStr} for ${skillId} (running total: $${runningTotal.toFixed(4)})`
  );

  let res;
  try {
    res = await paidFetch(resource, {
      method: "GET",
      headers: { "X-Agent-Mandate": mandateHeader },
    });
  } catch (err) {
    console.error(`[agent] Network error: ${err.message}`);
    return "network_error";
  }

  if (res.status === 503) {
    const body = await res.text();
    console.error(`[agent] Seller 503: ${body}`);
    return "seller_503";
  }

  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    console.error(`[agent] Seller refused our mandate (${res.status}): ${body}`);
    appendLedger({ ts: new Date().toISOString(), result: "mandate_refused", status: res.status, body });
    return "mandate_refused";
  }

  if (res.status === 429) {
    const body = await res.text();
    console.warn(`[agent] Rate limited (429): ${body}`);
    return "rate_limited";
  }

  if (res.status !== 200) {
    const body = await res.text();
    console.error(`[agent] Unexpected status ${res.status}: ${body}`);
    return "unexpected_status";
  }

  const data = await res.json();
  const paymentResponseHeader = res.headers.get("payment-response");

  let txHash = null;
  if (paymentResponseHeader) {
    try {
      const decoded = decodePaymentResponseHeader(paymentResponseHeader);
      txHash = decoded?.transaction || null;
    } catch {}
  }

  const newTotal = runningTotal + price;
  const ledgerEntry = {
    ts: new Date().toISOString(),
    skill: skillId,
    seq: data.seq ?? null,
    price,
    txHash,
    runningTotal: parseFloat(newTotal.toFixed(6)),
    result: "success",
  };
  appendLedger(ledgerEntry);

  console.log(
    `[agent] ✅ Purchased ${skillId}${data.seq !== undefined ? ` seq=${data.seq}` : ` (${data.label ?? "ok"})`} | tx=${txHash ? txHash.slice(0, 12) + "…" : "null"} | total=$${newTotal.toFixed(4)}`
  );
  if (txHash) {
    console.log(`[agent]    Explorer: https://sepolia.basescan.org/tx/${txHash}`);
  }

  consecutiveErrors = 0;
  return "success";
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let running = true;

function gracefulExit(signal) {
  console.log(`\n[agent] ${signal} received. Flushing and exiting cleanly.`);
  running = false;
  appendLedger({ ts: new Date().toISOString(), result: "agent_stopped", signal });
  process.exit(0);
}

process.on("SIGINT", () => gracefulExit("SIGINT"));
process.on("SIGTERM", () => gracefulExit("SIGTERM"));

console.log(`[agent] Starting autonomous loop. Press Ctrl+C to stop.`);

while (running) {
  const result = await onePurchase();

  if (
    result === "killed" ||
    result === "cap_reached" ||
    result === "mandate_invalid" ||
    result === "scope_rejected" ||
    result === "mandate_refused"
  ) {
    console.log(`[agent] Stopping loop: ${result}`);
    break;
  }

  // Exponential backoff on errors
  if (["network_error", "seller_503", "rate_limited", "discovery_error"].includes(result)) {
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_RETRIES) {
      console.error(`[agent] ${MAX_RETRIES} consecutive errors. Pausing loop for 5 minutes.`);
      appendLedger({ ts: new Date().toISOString(), result: "loop_paused", consecutiveErrors });
      await new Promise((r) => setTimeout(r, 5 * 60_000));
      consecutiveErrors = 0;
    } else {
      const delay = backoffMs(consecutiveErrors);
      console.log(`[agent] Backing off ${delay}ms (error #${consecutiveErrors})`);
      await new Promise((r) => setTimeout(r, delay));
    }
    continue;
  }

  // Normal interval
  if (running && process.env.BUYER_ENABLED !== "false") {
    await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MS));
  }
}

console.log("[agent] Loop ended. Bye.");
