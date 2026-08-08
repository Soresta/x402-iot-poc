/**
 * demo.ts — Live demo page and SSE settlement feed
 *
 * GET /          — Self-contained HTML page; a stranger must understand it in 30 s.
 * GET /api/events — SSE stream; emits settlement events polled from KV.
 *
 * SSE architecture note:
 *   Workers cannot share in-memory state across requests. The SSE stream
 *   polls KV at 2-second intervals for the latest event written by the
 *   payment handler. This is the correct pattern for Workers-based SSE
 *   without a Durable Object broadcast layer.
 *
 * Fallback: if SSE fails or JS is disabled, the page polls GET /api/receipts
 * every 10 seconds so the page is never empty on stage.
 */

import type { Context } from "hono";
import type { Env } from "./types";

// ---------------------------------------------------------------------------
// SSE endpoint — GET /api/events
// ---------------------------------------------------------------------------

export async function sseHandler(c: Context<{ Bindings: Env }>) {
  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: "https://github.com/Soresta/x402-iot-poc#errors" }, 503);
  }

  const kvRef = c.env.IOT_KV;
  let lastEventTs: string | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(eventType: string, data: unknown) {
        if (closed) return;
        const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      function heartbeat() {
        if (closed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }

      // Heartbeat every 15 s to keep proxies alive
      const hbInterval = setInterval(heartbeat, 15_000);

      // Poll KV every 2 s for new events
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval);
          clearInterval(hbInterval);
          return;
        }
        try {
          const raw = await kvRef.get("latest_event");
          if (raw) {
            const event = JSON.parse(raw);
            if (event.ts !== lastEventTs) {
              lastEventTs = event.ts;
              send("payment_settled", event);
            }
          }
        } catch {
          // KV unavailable — emit a connection_issue event
          send("connection_issue", { ts: new Date().toISOString() });
        }
      }, 2_000);

      // Send initial connection event
      send("connected", {
        ts: new Date().toISOString(),
        message: "SSE stream established",
      });

      // Workers have a max response duration; after 25 s close gracefully
      // The client's EventSource will reconnect automatically.
      setTimeout(() => {
        clearInterval(pollInterval);
        clearInterval(hbInterval);
        closed = true;
        try {
          controller.close();
        } catch {}
      }, 25_000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// Demo page — GET /
// ---------------------------------------------------------------------------

export async function demoPageHandler(c: Context<{ Bindings: Env }>) {
  const baseUrl = new URL(c.req.url).origin;
  const explorerBase = "https://sepolia.basescan.org/tx/";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>x402 IoT PoC — Live Demo</title>
  <meta name="description" content="Live demonstration of autonomous machine-to-machine payments using the x402 HTTP protocol on Base Sepolia testnet." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0e1a;
      --surface: #111827;
      --surface2: #1a2235;
      --border: #1e2d45;
      --primary: #3b82f6;
      --primary-glow: rgba(59,130,246,0.15);
      --accent: #10b981;
      --accent-glow: rgba(16,185,129,0.15);
      --warning: #f59e0b;
      --text: #e2e8f0;
      --text-muted: #64748b;
      --text-dim: #94a3b8;
      --mono: 'JetBrains Mono', monospace;
      --sans: 'Inter', sans-serif;
      --radius: 10px;
    }

    body {
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    /* TESTNET badge — fixed, unmissable */
    .testnet-badge {
      position: fixed;
      top: 12px;
      right: 12px;
      background: #f59e0b;
      color: #000;
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      padding: 5px 12px;
      border-radius: 4px;
      z-index: 100;
      box-shadow: 0 2px 12px rgba(245,158,11,0.4);
      text-transform: uppercase;
    }

    header {
      background: linear-gradient(135deg, #0f1729 0%, #0a1628 100%);
      border-bottom: 1px solid var(--border);
      padding: 32px 24px 24px;
      text-align: center;
    }

    header h1 {
      font-size: clamp(1.5rem, 4vw, 2.2rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #60a5fa 0%, #34d399 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    header p {
      color: var(--text-dim);
      font-size: 0.95rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .how-it-works {
      display: flex;
      justify-content: center;
      gap: 0;
      margin: 24px auto;
      max-width: 700px;
      flex-wrap: wrap;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      color: var(--text-dim);
      padding: 6px 12px;
    }

    .step .icon { font-size: 1.1rem; }

    .step-arrow {
      color: var(--border);
      font-size: 1rem;
    }

    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }

    /* Stats bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      text-align: center;
    }

    .stat-card .value {
      font-size: 1.8rem;
      font-weight: 700;
      font-family: var(--mono);
      color: var(--primary);
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-card .label {
      font-size: 0.78rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Layout: events left, receipts right */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    @media (max-width: 700px) {
      .content-grid { grid-template-columns: 1fr; }
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
    }

    .panel-title {
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: var(--text-dim);
      text-transform: uppercase;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 6px var(--accent);
      animation: pulse 2s infinite;
    }

    .status-dot.disconnected {
      background: #ef4444;
      box-shadow: 0 0 6px #ef4444;
      animation: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .events-list {
      padding: 12px;
      min-height: 320px;
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .event-item {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.84rem;
      animation: slideIn 0.3s ease;
    }

    .event-item.settled { border-left: 3px solid var(--accent); }
    .event-item.info    { border-left: 3px solid var(--primary); }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .event-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .event-label {
      font-weight: 600;
      color: var(--accent);
      font-size: 0.82rem;
    }

    .event-time {
      color: var(--text-muted);
      font-family: var(--mono);
      font-size: 0.75rem;
    }

    .event-detail {
      color: var(--text-dim);
      margin-top: 4px;
      font-size: 0.8rem;
    }

    .tx-link {
      color: var(--primary);
      text-decoration: none;
      font-family: var(--mono);
      font-size: 0.78rem;
      word-break: break-all;
    }

    .tx-link:hover { text-decoration: underline; color: #93c5fd; }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      padding: 40px;
      text-align: center;
      gap: 8px;
    }

    .empty-icon { font-size: 2rem; opacity: 0.4; }

    /* Receipts table */
    .receipts-scroll {
      min-height: 320px;
      max-height: 400px;
      overflow-y: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    th {
      padding: 10px 14px;
      text-align: left;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
      font-weight: 500;
      white-space: nowrap;
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(30,45,69,0.5);
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }

    tr:hover td { background: var(--surface2); }

    .receipt-hash {
      color: var(--primary);
      text-decoration: none;
      font-family: var(--mono);
      font-size: 0.75rem;
    }

    .receipt-hash:hover { text-decoration: underline; }

    .receipt-time {
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .amount-badge {
      display: inline-block;
      background: var(--accent-glow);
      color: var(--accent);
      border: 1px solid rgba(16,185,129,0.2);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: var(--mono);
      font-size: 0.75rem;
      font-weight: 500;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 20px;
      color: var(--text-muted);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
    }

    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }

    /* Scrollbar styling */
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: var(--surface); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  </style>
</head>
<body>

<div class="testnet-badge" role="status" aria-label="Testnet environment — no real value">
  ⚠ TESTNET — no real value
</div>

<header>
  <h1>x402 IoT Sensor — Live Demo</h1>
  <p>
    A buyer agent autonomously purchases IoT readings from this seller using the
    <strong>x402 payment protocol</strong> — no account, no API key, no prior relationship.
    Every settlement is recorded on <strong>Base Sepolia</strong>.
  </p>

  <div class="how-it-works" role="list" aria-label="How it works">
    <div class="step" role="listitem"><span class="icon">🤖</span> Buyer discovers seller</div>
    <div class="step-arrow">→</div>
    <div class="step" role="listitem"><span class="icon">💰</span> Pays via x402 ($0.001 USDC)</div>
    <div class="step-arrow">→</div>
    <div class="step" role="listitem"><span class="icon">⛓</span> Settles on Base Sepolia</div>
    <div class="step-arrow">→</div>
    <div class="step" role="listitem"><span class="icon">📡</span> Gets sensor data</div>
  </div>
</header>

<main>
  <!-- Stats bar -->
  <div class="stats-bar" role="region" aria-label="Settlement statistics">
    <div class="stat-card">
      <div class="value" id="stat-total" aria-live="polite">0</div>
      <div class="label">Settlements today</div>
    </div>
    <div class="stat-card">
      <div class="value" id="stat-volume" aria-live="polite">$0.000</div>
      <div class="label">Total volume (USDC)</div>
    </div>
    <div class="stat-card">
      <div class="value" id="stat-payers" aria-live="polite">0</div>
      <div class="label">Distinct payers</div>
    </div>
    <div class="stat-card">
      <div class="value" id="stat-sse" aria-live="polite">—</div>
      <div class="label">SSE status</div>
    </div>
  </div>

  <!-- Content grid -->
  <div class="content-grid">

    <!-- Live events panel -->
    <section class="panel" aria-labelledby="events-heading">
      <div class="panel-header">
        <span class="panel-title" id="events-heading">Live events</span>
        <span class="status-dot disconnected" id="sse-dot" aria-label="SSE connection status"></span>
      </div>
      <div class="events-list" id="events-list" role="log" aria-live="polite" aria-label="Live settlement events">
        <div class="empty-state" id="events-empty">
          <div class="empty-icon">📡</div>
          <div>Waiting for settlements…</div>
          <div style="font-size:0.75rem;margin-top:4px">Run the buyer agent to see events here</div>
        </div>
      </div>
    </section>

    <!-- Receipts panel -->
    <section class="panel" aria-labelledby="receipts-heading">
      <div class="panel-header">
        <span class="panel-title" id="receipts-heading">Settlement receipts</span>
        <span style="font-size:0.75rem;color:var(--text-muted)">Explorer-verified</span>
      </div>
      <div class="receipts-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Amount</th>
              <th scope="col">Tx Hash</th>
            </tr>
          </thead>
          <tbody id="receipts-body">
            <tr>
              <td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px">
                Loading receipts…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</main>

<footer>
  <p>
    <a href="https://github.com/Soresta/x402-iot-poc" target="_blank" rel="noopener">GitHub</a>
    ·
    <a href="/.well-known/agent-card.json" target="_blank">Agent Card</a>
    ·
    <a href="/api/receipts" target="_blank">Receipts API</a>
    ·
    Base Sepolia testnet · MIT license
  </p>
</footer>

<script>
  const EXPLORER = "https://sepolia.basescan.org/tx/";
  const eventsEl = document.getElementById("events-list");
  const emptyEl = document.getElementById("events-empty");
  const receiptsTbody = document.getElementById("receipts-body");
  const sseDot = document.getElementById("sse-dot");
  const statTotal = document.getElementById("stat-total");
  const statVolume = document.getElementById("stat-volume");
  const statPayers = document.getElementById("stat-payers");
  const statSse = document.getElementById("stat-sse");

  let settlementCount = 0;
  let volumeTotal = 0;
  const payers = new Set();

  // ---- Format helpers ----
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function fmtHash(hash) {
    if (!hash) return "—";
    return hash.slice(0, 10) + "…" + hash.slice(-6);
  }

  // ---- Render a settlement event ----
  function addEvent(data) {
    if (emptyEl) emptyEl.style.display = "none";

    const item = document.createElement("div");
    item.className = "event-item settled";
    item.innerHTML = \`
      <div class="event-row">
        <span class="event-label">✅ Payment settled</span>
        <span class="event-time">\${fmtTime(data.ts)}</span>
      </div>
      <div class="event-detail">
        Amount: <strong style="color:var(--accent)">\${data.amount || "$0.001"} USDC</strong>
        · Seq: \${data.seq ?? "?"}
        \${data.txHash
          ? \`<br/><a class="tx-link" href="\${EXPLORER}\${data.txHash}" target="_blank" rel="noopener" aria-label="View transaction on Base Sepolia explorer">
              🔗 \${fmtHash(data.txHash)}
            </a>\`
          : ""}
      </div>
    \`;

    eventsEl.insertBefore(item, eventsEl.firstChild);

    // Keep at most 30 items
    while (eventsEl.children.length > 31) {
      eventsEl.removeChild(eventsEl.lastChild);
    }

    // Update stats
    settlementCount++;
    volumeTotal += 0.001;
    if (data.payer) payers.add(data.payer.toLowerCase());
    statTotal.textContent = settlementCount;
    statVolume.textContent = "$" + volumeTotal.toFixed(3);
    statPayers.textContent = payers.size;
  }

  // ---- Render receipts table ----
  function renderReceipts(receipts) {
    if (!receipts || receipts.length === 0) {
      receiptsTbody.innerHTML = \`<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px">No settlements yet</td></tr>\`;
      return;
    }
    receiptsTbody.innerHTML = receipts.slice(0, 20).map(r => \`
      <tr>
        <td class="receipt-time">\${fmtTime(r.timestamp)}</td>
        <td><span class="amount-badge">\${r.amount || "$0.001"}</span></td>
        <td>
          \${r.txHash
            ? \`<a class="receipt-hash" href="\${EXPLORER}\${r.txHash}" target="_blank" rel="noopener" aria-label="Transaction \${r.txHash}">
                \${fmtHash(r.txHash)}
              </a>\`
            : '<span style="color:var(--text-muted)">—</span>'}
        </td>
      </tr>
    \`).join("");
  }

  // ---- Load receipts (polling fallback) ----
  async function loadReceipts() {
    try {
      const res = await fetch("/api/receipts?limit=20");
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      renderReceipts(data);

      // Update totals from receipts
      statTotal.textContent = data.length;
      const vol = data.length * 0.001;
      statVolume.textContent = "$" + vol.toFixed(3);
      const uniquePayers = new Set(data.map(r => r.payer).filter(Boolean));
      statPayers.textContent = uniquePayers.size;
    } catch (e) {
      // Silently degrade — table may be stale
    }
  }

  loadReceipts();
  // Poll every 10 s as fallback if SSE is unavailable
  const receiptPoll = setInterval(loadReceipts, 10_000);

  // ---- SSE connection ----
  let sse;
  let sseRetries = 0;

  function connectSSE() {
    sse = new EventSource("/api/events");

    sse.addEventListener("connected", () => {
      sseDot.classList.remove("disconnected");
      statSse.textContent = "Live";
      sseRetries = 0;
    });

    sse.addEventListener("payment_settled", (e) => {
      try {
        const data = JSON.parse(e.data);
        addEvent(data);
        loadReceipts(); // refresh table immediately
      } catch {}
    });

    sse.onerror = () => {
      sseDot.classList.add("disconnected");
      statSse.textContent = "Reconnecting…";
      sse.close();
      // Exponential backoff: 1s, 2s, 4s, 8s, cap 30s
      const delay = Math.min(1000 * Math.pow(2, sseRetries), 30_000);
      sseRetries++;
      setTimeout(connectSSE, delay);
    };
  }

  connectSSE();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
  });
}
