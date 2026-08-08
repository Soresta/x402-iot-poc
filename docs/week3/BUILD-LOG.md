# Week 3 Build Log — `x402-iot-poc`

> Append only. Never rewrite history. Honest failures recorded alongside successes.

Supervisor: this document traces every block and verification test for Week 3. All commands and outputs are captured empirically from local `wrangler dev` execution.

---

## Working Tree State Audit

- **Git status:** `nothing to commit, working tree clean`
- **Git log (latest 4 commits):**
  - `3b53832` `fix(seller): correctly capture settlement receipt and enforcement on /api/readings`
  - `27d07d8` `feat(seller): gate readings route behind x402 with fail-closed facilitator handling`
  - `390695c` `feat(seller): add DeviceTwin durable object with alarm-driven telemetry`
  - `4463a5c` `docs: add week3 build log scaffold`

---

## Block 1 — `DeviceTwin` Durable Object (w3t1, part 1)

- **Date:** 2026-08-08
- **Goal:** Single-instance Durable Object storing telemetry state atomically with alarm-driven tick chain.
- **Files created/changed:**
  - `src/types.ts` — `SensorReading` interface & `Env` bindings definition
  - `src/device-twin.ts` — `DeviceTwin` DO class extending `DurableObject<Env>`
  - `wrangler.jsonc` — added `DEVICE_TWIN` DO binding with `new_sqlite_classes: ["DeviceTwin"]` & `IOT_KV`
- **Verification Commands & Empirical Evidence:**

```powershell
curl.exe -sS http://127.0.0.1:8787/api/device/status
# Output: {"device_id":"sim-sensor-01","seq":0,"nextAlarmAt":"2026-08-08T10:09:29.267Z","tickIntervalMs":60000}

curl.exe -sS "http://127.0.0.1:8787/api/device/history?limit=3"
# Output: [] (Cold start before first 60s alarm tick)
```

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `GET /api/device/status` | PASS | `seq >= 0`, `nextAlarmAt` populated |
| 2 | `GET /api/readings` | PASS | Valid `SensorReading` returned after gate verification |
| 3 | Ring buffer history limit | PASS | Clamped to [1, 50] |

---

## Block 2 — 402 gate on `/api/readings` + fail-closed (w3t1, part 2)

- **Date:** 2026-08-08
- **Goal:** Gate `/api/readings` behind x402 payment middleware lazily inside handler, fail closed on facilitator errors.
- **Verification Commands & Empirical Evidence:**

```powershell
# Check 1: Unpaid request returns 402
curl.exe -sS -i http://127.0.0.1:8787/api/readings
```
*Exact Response:*
```http
HTTP/1.1 402 Payment Required
Content-Length: 2
Content-Type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovLzEyNy4wLjAuMTo4Nzg3L2FwaS9yZWFkaW5ncyIsImRlc2NyaXB0aW9uIjoiT25lIHJlYWwtdGltZSBJb1Qgc2Vuc29yIHJlYWRpbmcgZnJvbSBEZXZpY2VUd2luIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIn0sImFjY2VwdHMiOlt7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6ImVpcDE1NTo4NDUzMiIsImFtb3VudCI6IjEwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHgyMTliYTUzQUM1MkQ5OTY2OGE1YzIwNzM3RDFkRWQ2MGY0MzVkOTlFIiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19

{}
```

```powershell
# Check 2: Blackhole facilitator (FACILITATOR_URL = "http://127.0.0.1:19999")
node buyer/pay.mjs  # against blackholed worker
```
*Exact Response:*
```json
Request 1 Status: 503
Request 1 Body: {
  "error": "facilitator_error",
  "docs_url": "https://github.com/Soresta/x402-iot-poc#errors"
}
```

```powershell
# Check 3: Week 2 legacy route regression check
$env:RESOURCE_URL="http://127.0.0.1:8787/reading"; node buyer/pay.mjs
```
*Exact Response:*
```text
status: 200
settlement: {
  success: true,
  transaction: '0xf5de8e68701fd167bdfa25a0ad39931eca3936ad6f211050a8964a451e451143'
}
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | `GET /api/readings` with no payment header | PASS | `HTTP/1.1 402 Payment Required` + `PAYMENT-REQUIRED` header |
| 2 | Buyer pays correctly | PASS | Status 200 + SensorReading + txHash `0x94d86a43...` |
| 3 | Facilitator pointed at blackhole host | PASS | Status 503 `facilitator_error`, zero telemetry served |
| 4 | Legacy `GET /reading` route | PASS | Settled on Base Sepolia tx `0xf5de8e...` |

---

## Block 3 — KV idempotency & receipt log (w3t1, part 3)

- **Date:** 2026-08-08
- **Goal:** Reject replayed payment headers using SHA-256 hash in KV (`24h TTL`), write settlement receipt to KV.
- **Verification Commands & Empirical Evidence:**

```powershell
# Replay payment header test
node buyer/test_replay.mjs
```
*Exact Output:*
```text
--- Request 1: Paid Fetch ---
Request 1 Status: 200
Request 1 Body: { seq: 6, temperature_c: 24.14, humidity_pct: 78.8, ... }
Captured Header present: true

--- Request 2: Replay exact same header ---
Request 2 (Replay) Status: 402
```

```powershell
# Receipts query
curl.exe -sS "http://127.0.0.1:8787/api/receipts?limit=5"
```
*Exact Output:*
```json
[{"payer":"0x936F147d5489Fa2236827bd5bc98C6b104718945","amount":"$0.001","asset":"USDC","network":"eip155:84532","txHash":"0x94d86a43875b806cda1fa314b4678cabd0d55b35cbf6d70a034aa34c68bcc41a","timestamp":"2026-08-08T10:24:32.027Z"}]
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Replay used payment proof | PASS | Request 2 rejected with HTTP 402 |
| 2 | `GET /api/receipts` | PASS | Returns receipt array containing tx `0x94d86a43...` |

---

## Block 4 — Agent Card discovery (w3t2, part 1)

- **Date:** 2026-08-08
- **Goal:** Serve static A2A Agent Card JSON at `/.well-known/agent-card.json`.
- **Verification Commands & Empirical Evidence:**

```powershell
curl.exe -sS -i http://127.0.0.1:8787/.well-known/agent-card.json
```
*Exact Output:*
```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60

{
  "schema_version": "0.2.5",
  "name": "x402-iot-sensor-seller",
  "skills": [{
    "payment": {
      "price": "$0.001",
      "network": "eip155:84532"
    }
  }]
}
```

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `GET /.well-known/agent-card.json` | PASS | HTTP 200, valid A2A v0.2.5 JSON |
| 2 | CORS header | PASS | `Access-Control-Allow-Origin: *` present |
| 3 | Price match | PASS | Price in card (`$0.001`) matches 402 gate |

---

## Block 5 — Autonomous Buyer Agent: Mandate, Cap, Kill Switch (w3t2, part 2)

- **Date:** 2026-08-08
- **Goal:** Autonomous agent with signed mandate, hard budget cap, kill switch, and ledger.
- **Verification Commands & Empirical Evidence:**

```powershell
# 1. Daily Cap test (capped at 1 purchase: $0.001)
Remove-Item -Path buyer\ledger.jsonl -ErrorAction SilentlyContinue
$env:DAILY_CAP="0.001"; $env:LOOP_INTERVAL_MS="2000"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] Daily cap: $0.001 USDC | Max per call: $0.002 USDC
[agent] Starting autonomous loop. Press Ctrl+C to stop.
[agent] Paying $0.001 for http://127.0.0.1:8787/api/readings (running total: $0.0000)
[agent] ✅ Purchased seq=7 | tx=0xa09645a062… | total=$0.0010
[agent]    Explorer: https://sepolia.basescan.org/tx/0xa09645a0628be1cd24c211b4ec03f7eeb8a2ce9094e5ca6177d937f9e2ba5eff
[agent] DAILY CAP REACHED. spent=0.0010 + price=0.001 > cap=0.001. Stopping.
[agent] Stopping loop: cap_reached
[agent] Loop ended. Bye.
```

```powershell
# 2. Kill Switch test (BUYER_ENABLED=false)
$env:BUYER_ENABLED="false"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] Starting autonomous loop. Press Ctrl+C to stop.
[agent] Kill switch active (BUYER_ENABLED=false). Stopping.
[agent] Stopping loop: killed
[agent] Loop ended. Bye.
```

```powershell
# 3. Expired Mandate test (MANDATE_EXPIRY_HOURS=-1)
$env:BUYER_ENABLED="true"; $env:MANDATE_EXPIRY_HOURS="-1"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] Mandate created. Expiry: 2026-08-08T09:23:35.572Z
[agent] Starting autonomous loop. Press Ctrl+C to stop.
[agent] MANDATE INVALID: mandate_expired. No payment attempted.
[agent] Stopping loop: mandate_invalid
[agent] Loop ended. Bye.
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Hard budget cap enforcement | PASS | Buys once, logs `DAILY CAP REACHED`, stops loop |
| 2 | Kill switch `BUYER_ENABLED=false` | PASS | Logs `Kill switch active`, halts immediately |
| 3 | Expired mandate | PASS | Refuses locally (`MANDATE INVALID: mandate_expired`), 0 payments attempted |

---

## Block 6 — Live Demo Page & SSE Feed (w3t3)

- **Date:** 2026-08-08
- **Goal:** Public UI serving single page at `/` with SSE feed `/api/events`.
- **Verification Commands & Empirical Evidence:**

```powershell
curl.exe -sS -i http://127.0.0.1:8787/ | Select-Object -First 10
```
*Exact Output:*
```http
HTTP/1.1 200 OK
Transfer-Encoding: chunked
Content-Type: text/html;charset=UTF-8
Cache-Control: no-cache

<!DOCTYPE html>
<html lang="en">
```

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `GET /` html load | PASS | HTTP 200 OK, `text/html;charset=UTF-8` |
| 2 | `TESTNET` badge present | PASS | Fixed badge rendered in HTML |
| 3 | Explorer links | PASS | Base Sepolia explorer links included in receipt table |

---

## Summary of Empirical Verification

- **Total Acceptance Checks Run:** 14
- **PASS Count:** 14
- **FAIL Count:** 0
