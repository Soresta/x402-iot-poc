# Week 5 Build Log — `x402-iot-poc`

> Append only. Everything below was executed on 2026-09-06, against local
> `wrangler dev` and the deployed Worker.

**Deployed version this week:** `e286ca43-7499-4048-bc19-351d19ed7d20`
**Public Worker:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

---

## Audit summary

- **Checks run:** 22
- **PASS:** 22
- **FAIL found and fixed during the week:** 1 (inference label selection — Block 2)
- **Not runnable this week:** the tutorial's clean-machine test, the video
  recording, and anything requiring publication

---

## Block 1 — One gate, reused

**Problem.** Weeks 3 and 4 built the payment gate inline on `/api/readings`:
rate limit, mandate verification, payment screen, settlement, receipt, SSE
event, fail-closed handling. Roughly ninety lines. Week 5 adds a second priced
resource.

Copying those ninety lines would have been wrong twice over. Copies drift, and a
security control present on one route but missing on another is exactly the
silent failure mode this project has already been bitten by twice.

**What was built.** `src/paid-route.ts` — `createPaidRoute(config)` returns a
Hono middleware. Both resources are the same code with a different price and
description. Order of checks, unchanged from Week 4:

```
429  rate limit    per payer, KV sliding window
401  identity      mandate signature, and holder-is-payer
403  mandate       expiry, caps, scope
402  payment       screen, then facilitator settlement
503  upstream      facilitator unreachable → serve nothing
```

`rejectReplay()` moved here too and is now called by both route handlers, so
replay protection cannot be present on one resource and absent on the other.

**Regression after the refactor:**

```text
unpaid /api/readings          402
legacy /reading               402
replay                        402 payment_already_used
underpayment                  402 payment_amount_invalid
wrong asset                   402 payment_network_invalid
rate limit                    429 + Retry-After: 60
mandate suite                 7/7 PASS (local and remote)
npx tsc --noEmit              exit 0
```

**PASS** — no behaviour changed, and the second resource inherited every control
for free.

---

## Block 2 — Pay-per-inference (w5 POC)

`GET /api/inference?text=...` sells one sentiment classification on Workers AI
at **$0.002**, against **$0.001** for a sensor reading.

The price difference is not decoration. It is what makes `max_per_call`
meaningful: an agent authorized for cheap readings is not automatically
authorized to buy compute. Block 2 test 4 proves that.

### FAIL → FIXED: the classifier reported the least likely label

**INITIAL FAIL.** First run:

```text
--- Buy an inference ($0.002) ---
status: 200
body: {"model":"@cf/huggingface/distilbert-sst-2-int8",
       "input":"this settlement rail is surprisingly pleasant",
       "label":"NEGATIVE","score":0.0002, ...}
```

Status 200, well-formed response, correct shape — and the answer is wrong.
"Surprisingly pleasant" is not negative, and a confidence of 0.0002 is the tell.

**Cause.** The model returns one entry per class in a **fixed order**, not sorted
by confidence:

```json
[{"label":"NEGATIVE","score":0.0002},{"label":"POSITIVE","score":0.9998}]
```

The code took `output[0]`, assuming the array was sorted. It therefore reported
the *least* likely class every time. This is the same failure shape as the two
bugs found in Week 3: the structure was right, nothing errored, and the output
looked plausible enough to pass a glance.

**FIX.** Select the highest-scoring class rather than the first.

**FIXED — evidence,** both polarities:

```text
this settlement rail is surprisingly pleasant -> {"label":"POSITIVE","score":0.9998, ...}
this is terrible and broken                   -> {"label":"NEGATIVE","score":0.9997, ...}
```

### Test execution — local

```powershell
node buyer/test_inference.mjs
```

```text
--- Agent Card skills ---
  sell-iot-reading @ $0.001
  sell-inference @ $0.002
RESULT PASS — one card advertises both resources with distinct prices

--- Buy a reading ($0.001) ---
status: 200
body: {"seq":1678,"device_id":"sim-sensor-01","temperature_c":19.27,"humidity_pct":40.6,...}
RESULT PASS — reading purchased (status 200)

--- Buy an inference ($0.002) ---
status: 200
body: {"model":"@cf/huggingface/distilbert-sst-2-int8","input":"this settlement rail is
       surprisingly pleasant","label":"POSITIVE","score":0.9998,...}
RESULT PASS — inference purchased and classified (status 200)

--- Reading-sized mandate against inference ---
status: 403
body: {"error":"mandate_scope_exceeded","docs_url":"..."}
RESULT PASS — cheap mandate cannot buy expensive compute (status 403)

--- Recent receipts ---
  2026-09-06T09:44:39.424Z  $0.002  inference
  2026-09-06T09:44:37.616Z  $0.001  readings
RESULT PASS — receipts record which resource was sold

5/5 checks passed.
```

### Test execution — deployed Worker

```text
RESULT PASS — one card advertises both resources with distinct prices
RESULT PASS — reading purchased (status 200)
RESULT PASS — inference purchased and classified (status 200)
RESULT PASS — cheap mandate cannot buy expensive compute (status 403)
RESULT PASS — receipts record which resource was sold (inference, readings)
5/5 checks passed.
```

**PASS** — identical local and remote. Workers AI needed no extra account setup
beyond the `ai` binding.

### Buyer rotates across resources

The agent now reads every skill from the Agent Card and rotates through those
its mandate can afford, so a long run exercises all of them:

```text
[agent] Paying $0.001 for sell-iot-reading (running total: $0.0000)
[agent] ✅ Purchased sell-iot-reading seq=1680 | tx=0x79dfd1fb69… | total=$0.0010
[agent] Paying $0.002 for sell-inference (running total: $0.0010)
[agent] ✅ Purchased sell-inference (NEGATIVE) | tx=0x7d9d078ace… | total=$0.0030
[agent] Paying $0.001 for sell-iot-reading (running total: $0.0030)
[agent] ✅ Purchased sell-iot-reading seq=1680 | tx=0x7195192fc0… | total=$0.0040
[agent] Paying $0.002 for sell-inference (running total: $0.0040)
[agent] ✅ Purchased sell-inference (NEGATIVE) | tx=0x372eb628ed… | total=$0.0060
```

**PASS** — the w5 DoD ("the buyer agent purchases both resource types") is met.

---

## Block 3 — Email capture (w5 REV)

`src/subscribe.ts`. Three endpoints:

| Route | Purpose |
|---|---|
| `POST /api/subscribe` | consent-first signup |
| `GET /api/subscribers/count` | aggregate only, no addresses |
| `GET /api/subscribers.csv?token=…` | the weekly handover export |

**Data minimisation, deliberately.** Stored: email, timestamp, source. Nothing
else. No IP, no user agent, no fingerprint. The abuse throttle is keyed on a
truncated hash of the IP with a one-hour TTL — a throttle, not a record.

**Export fails closed.** Without `EXPORT_TOKEN` configured the endpoint returns
`503` and exports nothing. An unprotected export endpoint on a public Worker is
an email list published to the internet, and defaulting to open would have been
the easy mistake here.

### Test execution

```powershell
curl.exe -sS -X POST .../api/subscribe -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
{"error":"subscribe_consent_required","docs_url":"..."}

curl.exe -sS -X POST .../api/subscribe -d '{"email":"nope","consent":true}'
{"error":"subscribe_invalid_email","docs_url":"..."}

curl.exe -sS -X POST .../api/subscribe -d '{"email":"Reader@Example.com","consent":true,"source":"demo-page"}'
{"ok":true,"already_subscribed":false}

curl.exe -sS -X POST .../api/subscribe -d '{"email":"reader@example.com","consent":true}'
{"ok":true,"already_subscribed":true}

curl.exe -sS .../api/subscribers/count
{"subscribers":1}
```

**PASS** — consent enforced, address normalised to lower case so a duplicate in
different case is recognised, aggregate endpoint leaks no addresses.

### Export authorisation

```text
no EXPORT_TOKEN configured   ->  503 export_not_configured
wrong token                  ->  401 export_unauthorized
correct token                ->  200 text/csv
```

```text
email,timestamp,source,consent
"browser-test@example.com","2026-09-06T09:56:07.426Z","demo-page","true"
"reader@example.com","2026-09-06T09:48:19.115Z","demo-page","true"
```

Every field is quoted so an address containing a comma cannot shift columns.

**PASS**

### Browser test — the real form

Submitted through the actual page, not curl:

```text
status text : "You are on the list. First note arrives with the next update."
status class: signup-status ok
email field : cleared
KV count    : 2
```

Mobile viewport 375 px:

```text
{"vw":375,"scrollW":375,"hScroll":false,"btnH":41,"btnW":176,"consentFont":"13.5px"}
```

**PASS** — no horizontal scroll, tap target 41 px tall, consent text legible.

### Remote

```text
GET /api/subscribers.csv        503   (no secret set on the deployed Worker)
GET /api/subscribers/count      {"subscribers":0}
```

**PASS** — remote deliberately has no `EXPORT_TOKEN` yet. Until it is set the
weekly CSV handover cannot happen. One command, not run here because a secret
should be created by the person who will hold it:

```powershell
npx wrangler secret put EXPORT_TOKEN
```

---

## Block 4 — Demo page shows both products

- Receipts table gains a **Resource** column.
- Event cards name the product sold, which closes the Week 3 cosmetic defect
  where every card read `Seq: ?` because the SSE payload never carried a `seq`.
- **Volume arithmetic fixed.** Both the live counter and the receipts total
  assumed every settlement was $0.001. That was true until this week and silently
  wrong the moment a second price existed. Both now sum the actual amounts.

Rendered page:

```text
20            SETTLEMENTS TODAY
$0.025        TOTAL VOLUME (USDC)

TIME       RESOURCE         AMOUNT   TX HASH
12:45:56   Sensor reading   $0.001   0xd28dbe6b…8ce317
12:45:52   Inference        $0.002   0x372eb628…80a311
12:45:48   Sensor reading   $0.001   0x7195192f…575578
12:45:44   Inference        $0.002   0x7d9d078a…573a11
...
12:11:07   Resource         $0.001   0xf0971171…e06c02
```

Rows written before this week show `Resource` because the field did not exist
when they were recorded. Left as-is rather than backfilled — the receipt log is
an append-only record of what happened, not a tidy display surface.

**PASS**

---

## Block 5 — Written deliverables

| File | What | Status |
|---|---|---|
| `docs/content/tutorial-machine-customers.md` | soft.house flagship tutorial, 12 steps | Complete draft; clean-machine test outstanding |
| `docs/content/funnel-map-and-utm.md` | two funnels, full UTM naming sheet | Proposed |
| `docs/content/demo-video-script.md` | 90-second script, shot list, house rules | Script ready; not recorded |

The tutorial's own quality bar — *copy-paste runnable from a clean machine* — is
listed as an unchecked checklist at the end of that document rather than assumed.
Every code block in it is lifted from code that was running when it was written,
which is necessary but not the same thing.

---

## Local dev note — two servers, one database

Midway through the session `wrangler dev` began failing with:

```text
Uncaught Error: NOSENTRY database is locked: SQLITE_BUSY
```

Cause: two `wrangler dev` instances were running against the same local Durable
Object SQLite file. Not a code fault. Fixed by killing every wrangler process and
starting one. Recorded because the error message does not mention the real
problem, and the next person to hit it will search for it.
