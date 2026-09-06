# Week 4 Build Log — `x402-iot-poc`

> Append only. Honest failures recorded alongside successes.
> Everything in this document was executed on 2026-09-06 in one session, against
> local `wrangler dev` and the deployed Worker. Nothing is inherited from an
> earlier week's log.

**Deployed version this week:** `b15e7b09-d1be-4058-b364-fab697af3a60`
**Public Worker:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

---

## Audit summary

- **Checks run:** 20
- **PASS:** 20
- **FAIL:** 0
- **Not runnable this week:** 2 (stranger test, publish-wave metrics — both need
  a person who is not me; see the report)

The zero-FAIL count is not a boast. The abuse-case checklist passed only after
this week's work closed a gap the Week 3 report had already recorded as a known
limitation. That gap is item 1 below.

---

## Block 1 — Seller-side mandate verification (w4 hardening)

**The gap.** Week 3 verified the spending mandate on the buyer only. The Week 3
report recorded this honestly as limitation #11: *"A compromised buyer could
exceed its own mandate and the seller would not notice."* The W4 abuse-case
checklist requires "expired mandate → rejected", and the documented error
contract promises `401` (identity) and `403` (mandate) — neither of which had any
implementation.

**What was built.** `src/mandate.ts` — stateless verification of a signed mandate
presented in `X-Agent-Mandate`, checked on every request before payment:

```
429  rate limit    already existed
401  identity      NEW — signature does not recover, or holder is not the payer
403  mandate       NEW — expired, malformed, invalid caps, price out of scope
402  payment       already existed
503  upstream      already existed
```

`REQUIRE_MANDATE` (default `false`) controls whether a request carrying no
mandate at all is refused. Left off so the Week 2 single-purchase script and the
legacy `/reading` route keep working; a presented mandate is fully verified
regardless.

### Test execution — local

```powershell
npx wrangler dev
node buyer/test_mandate.mjs
```

*Exact output:*

```text
buyer: 0x936F147d5489Fa2236827bd5bc98C6b104718945
target: http://127.0.0.1:8787/api/readings

--- Expired mandate ---
status: 403
body: {"error":"mandate_expired","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — expired mandate refused with 403 (status 403)
--- Price above max_per_call ---
status: 403
body: {"error":"mandate_scope_exceeded","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — price outside mandate refused with 403 (status 403)
--- Tampered after signing ---
status: 401
body: {"error":"identity_unverified","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — tampered mandate refused with 401 (status 401)
--- Signed by a different key ---
status: 401
body: {"error":"identity_unverified","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — mandate signed by another key refused with 401 (status 401)
--- Malformed mandate header ---
status: 403
body: {"error":"mandate_malformed","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — malformed mandate refused with 403 (status 403)
--- Valid mandate + payment ---
status: 200
body: {"seq":1645,"device_id":"sim-sensor-01","temperature_c":26.01,"humidity_pct":60.5,"ts":"2026-09-06T09:10:55.345Z","note":"TESTNET — no real value"}
RESULT PASS — valid mandate still buys normally (status 200)
--- Stranger's mandate + our payment proof ---
status: 401
body: {"error":"identity_mismatch","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
RESULT PASS — mandate cannot be used as a bearer token (status 401)

7/7 checks passed.
```

### Test execution — deployed Worker

```powershell
$env:SELLER_URL="https://x402-iot-poc.akifk-x402-26.workers.dev"
node buyer/test_mandate.mjs
```

```text
RESULT PASS — expired mandate refused with 403 (status 403)
RESULT PASS — price outside mandate refused with 403 (status 403)
RESULT PASS — tampered mandate refused with 401 (status 401)
RESULT PASS — mandate signed by another key refused with 401 (status 401)
RESULT PASS — malformed mandate refused with 403 (status 403)
RESULT PASS — valid mandate still buys normally (status 200)
RESULT PASS — mandate cannot be used as a bearer token (status 401)
7/7 checks passed.
```

**PASS** — identical behaviour local and remote.

### The bearer-token case, specifically

Case 7 is the one worth reading twice. The mandate is genuinely signed by a
different key and genuinely names that key as its holder — the signature is
valid. What makes it a forgery is that the payment funding the request comes from
*our* wallet, not the mandate holder's.

Without the holder-vs-payer comparison, a signed mandate lifted from any request
log would authorize spending by whoever holds the copy. The check is four lines:

```ts
if (payerAddress && payerAddress.toLowerCase() !== body.buyer.toLowerCase()) {
  return reject(401, "identity_mismatch");
}
```

No specification we read requires it.

### `REQUIRE_MANDATE=true` probe

Flag flipped, request sent with no mandate, flag restored:

```http
HTTP/1.1 403 Forbidden
Content-Length: 88
Content-Type: application/json

{"error":"mandate_required","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
```

**PASS**

---

## Block 2 — Abuse-case checklist (the W4 DoD)

Every line of the checklist in the task brief, with the check that proves it.

| Abuse case | Required | Observed | Result |
|---|---|---|---|
| Replayed proof | rejected | `402 payment_already_used` | **PASS** |
| Wrong amount | rejected | `402 payment_amount_invalid` | **PASS** |
| Wrong asset / network | rejected | `402 payment_network_invalid` | **PASS** |
| Expired mandate | rejected | `403 mandate_expired` | **PASS** |
| Request flood | per-buyer KV sliding window | `429` + `Retry-After: 60` at request 11 | **PASS** |
| Facilitator down | fail closed, never serve unpaid | `503` + `Retry-After: 5`, no telemetry | **PASS** |
| Structured errors everywhere | `{error, docs_url}` with 401/402/403/429 | all four present and tested | **PASS** |

### Regression run after the middleware change

```powershell
node buyer/test_replay.mjs
node buyer/test_negative.mjs
node buyer/test_ratelimit.mjs
curl.exe -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/reading
curl.exe -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/readings
```

```text
=== replay ===
status: 200
RESULT PASS — fresh payment returns data (status 200)
status: 402
RESULT PASS — replayed proof rejected without serving telemetry (status 402)
=== negative ===
RESULT PASS — underpayment refused, no telemetry served (status 402)
RESULT PASS — wrong-asset payment refused, no telemetry served (status 402)
=== rate limit ===
#11 status=429 retry-after=60 body={"error":"rate_limit_exceeded",...,"retry_after_seconds":60}
#12 status=429 retry-after=60 body={"error":"rate_limit_exceeded",...,"retry_after_seconds":60}
RESULT PASS — requests past quota return 429 + Retry-After
=== legacy /reading ===
402
=== unpaid /api/readings (no mandate) ===
402
```

**PASS** — no regression. The Week 2 evidence route still answers `402`, and the
new identity/authorization layer does not intercept requests that carry no
mandate while `REQUIRE_MANDATE` is off.

### Typecheck

```powershell
npx tsc --noEmit
# exit 0
```

**PASS**

---

## Block 3 — Deployment

```powershell
npx wrangler deploy
```

```text
Uploaded x402-iot-poc (14.88 sec)
Deployed x402-iot-poc triggers (4.41 sec)
  https://x402-iot-poc.akifk-x402-26.workers.dev
Current Version ID: b15e7b09-d1be-4058-b364-fab697af3a60
env.REQUIRE_MANDATE ("false")
```

**PASS** — followed immediately by the remote 7/7 run recorded in Block 1.

---

## Block 4 — Documentation pass

Changes to `README.md`:

- Sequence diagram now shows the mandate being presented and verified, rather
  than implying the buyer checks it alone.
- Three-layer table states which failures produce `401` and which produce `403`.
- New line: *"The buyer checks its own mandate before spending; the seller checks
  it again before serving. Buyer-side checking alone is an honour system, so both
  sides do it."*
- Config table gains `USDC_ASSET` and `REQUIRE_MANDATE`.
- Verification table gains four mandate rows.

`ERRORS.md` gains seven codes with a "three layers, three status codes" section
explaining the ordering and the `X-Agent-Mandate` wire format.

**Not verified:** the DoD for this task is *"someone who isn't you reproduces the
whole thing from the README alone, in ≤15 minutes."* No such person has tried.
Recorded as NOT VERIFIED in the report; the README changes are an input to that
test, not a substitute for it.

---

## Block 5 — Research board package

`docs/research-board/AGENTIC-PAYMENTS-BOARD.md`: 11 technologies scored across
five facets, 21 dated signals with source URLs.

Method: every score carries a one-line justification citing either a published
source or something observed while building this repo. Four signals are flagged
in the document as secondary coverage needing primary confirmation before load.

The lowest-scoring row is *autonomous agent spending controls* (2 across every
facet) — the area we tested hardest and therefore know most about. The three
findings behind that score all come from this repo: buyer-side enforcement being
an honour system, mandates behaving as bearer tokens, and the daily cap resetting
at UTC midnight.

**Status:** drafted, not loaded. Loading is the manager's action.

---

## Block 6 — Publish wave #1 assets

Drafted, not published:

- `docs/content/post-1-build-in-public.md` — ~780 words, owed from W2
- `docs/content/post-2-architecture.md` — ~1100 words, owed from W3, carries the
  sequence diagram, the three-layer story and both real bugs
- `docs/content/publish-wave-1.md` — two X threads, ecosystem directory
  submission, UTM scheme, post-publication checklist

**No post has gone live.** There are no live links, no interest scores and no
referral traffic to report. The DoD for this task cannot be met without
publishing, and publishing is not this session's to do.

---

## Baseline captured

`docs/metrics/BASELINE.md` — the manager's KPI sheets for pragma.vision and
soft.house, transcribed from screenshots supplied 2026-09-06.

Seven of nine KPIs start at zero. Traffic is the exception, and most of it is not
human: **21,000 bot visits against 1,400 human ones** on pragma.vision.

One discrepancy recorded rather than resolved: the two sheets disagree on
soft.house weekly human visits (0 on one, 1400 on the other). Flagged for the
manager; any calculation depending on it will state its assumption.
