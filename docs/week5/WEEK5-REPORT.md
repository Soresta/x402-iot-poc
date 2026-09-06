# Week 5 Report — Turn the PoC into a funnel

**Date:** 2026-09-06 · **Deployed version:** `e286ca43-7499-4048-bc19-351d19ed7d20`
**Evidence:** `docs/week5/BUILD-LOG.md`

Week 5's theme was convergence: the PoC stops being a demo of one thing and
starts being infrastructure with two products and a way to capture interest.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| Second resource — pay-per-inference | Buyer purchases both types; demo shows both | **PASS** — verified local and deployed |
| Email capture | Capture live + first CSV export handed over | **PARTIAL** — capture live and tested; export blocked on one secret |
| soft.house flagship tutorial | Complete draft, every code block re-tested from a clean checkout | **PARTIAL** — draft complete, clean-machine run outstanding |
| Research board v2 + funnel wiring | Funnel map agreed Friday | **DRAFTED** — map and UTM sheet written; agreement needs the manager |
| 90-second demo video | File to manager for review | **NOT RECORDED** — script and shot list ready |
| Rhythm + Friday demo #5 | Launch checklist frozen | **NOT HELD** |

Three of six are code-complete. The three that are not all end at the same
place: they need either a person or a decision.

---

## 1. Two products on one rail

The seller now sells **stored data** and **live compute** through the same
payment gate:

| Resource | Price | What it is |
|---|---:|---|
| `sell-iot-reading` | $0.001 | one simulated sensor reading |
| `sell-inference` | $0.002 | one sentiment classification on Workers AI |

Both are advertised on the same Agent Card, so a buyer that has never seen this
seller discovers both and their prices in one fetch. The buyer agent rotates
across whatever its mandate can afford, so a long run exercises both.

**The price gap is the point, not the products.** Compute costs more to produce
than a stored measurement, so it is priced higher — and that makes the buyer's
`max_per_call` limit mean something. An agent authorized for $0.001 readings is
refused when it reaches for $0.002 compute:

```
403 mandate_scope_exceeded
```

Refused at the authorization layer, before any payment is attempted. This is the
first time in the project that the mandate has had a real decision to make rather
than a formality to wave through.

### The refactor that made it cheap

Adding the second resource started by deleting the first one's payment logic from
`index.ts` and moving it into a reusable middleware. Both resources now share
rate limiting, identity and mandate verification, the payment screen, settlement,
receipts and the fail-closed path.

This was not tidiness. Twice already in this project a control has been present
and silently not running. A copied gate would have made a third occurrence a
matter of time — the copy that misses one check looks identical to the one that
does not.

### One bug found, and its shape is familiar

The classifier reported the **least likely** label: "this settlement rail is
surprisingly pleasant" came back `NEGATIVE` with confidence 0.0002. The model
returns one entry per class in a fixed order, not sorted by confidence, and the
code took the first entry.

Status 200, well-formed JSON, correct field names, wrong answer. That is the
third bug in this project with exactly that shape, and it is worth naming as a
pattern: **in this stack, wrong looks like working.** Nothing throws. The only
defence is checking values, not shapes.

Fixed and verified in both directions.

---

## 2. Email capture — built, tested, one command from usable

`POST /api/subscribe` is live and consent-first. Tested through the real form in
a browser, not just curl.

**Privacy decisions, made deliberately:**

- Stored: **email, timestamp, source.** Nothing else. No IP, no user agent, no
  fingerprint.
- The abuse throttle uses a truncated hash of the IP with a one-hour TTL. That is
  a throttle, not a record.
- An unticked consent box is a `400`, not a silent opt-in.
- The count endpoint is public but aggregate-only; it exposes no addresses.

**The export fails closed.** Without `EXPORT_TOKEN` it returns `503` and exports
nothing. An unprotected CSV endpoint on a public Worker is an email list
published to the internet, and open-by-default would have been the easy mistake.

**This is why the task is PARTIAL.** The DoD includes "first CSV export handed
over", and the deployed Worker has no `EXPORT_TOKEN` set, so the export currently
returns `503` in production — correctly. I did not set it: a secret should be
created by the person who will hold it, not by an agent session that would then
have it in a transcript.

```powershell
npx wrangler secret put EXPORT_TOKEN
```

One command, then the export works and the weekly handover can start.

---

## 3. The tutorial

A twelve-step draft that takes a reader from an empty directory to an autonomous
agent buying data, with the three gotchas that cost real time called out where
they bite:

- payment middleware must be constructed inside the request handler;
- two package generations disagree on the header name, and mixing them fails
  silently;
- a signed payment proof is a bearer credential — the replay key is yours to
  supply.

It includes the honest caveats: the write-after-settle window, and the daily cap
resetting at UTC midnight.

**Why PARTIAL.** The brief's bar is *copy-paste runnable from scratch, tested on
a clean machine*. Every block is lifted from code that was running when the
tutorial was written — necessary, not sufficient. The clean-machine run is an
unchecked checklist at the end of the document, not an assumption buried in it.

---

## 4. Funnel map and UTM sheet

Two funnels are mapped end to end:

- **demo → readiness notes → research board → Watch trial**
- **tutorial → soft.house signup**

with a naming sheet strict enough that two people tagging links a month apart
produce the same strings.

**The useful part is where attribution stops.** Two KPIs — email list and
external agent payments — are read directly out of infrastructure in this repo.
Everything past the boundary of our own Worker is `assisted` at best, never
`direct`. Writing that down now is what will keep the Week 8 impact memo honest,
because that is the memo where the temptation to reclassify `unknown` as `mine`
will be strongest.

---

## 5. The video

Ninety seconds, second by second, with a shot list ordered for recording rather
than for playback — the chain will not settle on cue, so shots get captured out
of order and cut together.

House rules are applied: no prices of ours on screen, wordmark watermark
throughout, the TESTNET badge deliberately left visible in at least one shot.

One rule written in and worth keeping: if a settlement fails during recording,
use an earlier take rather than re-timing footage to imply the settlement was
faster than it was.

**Not recorded.** It needs a screen and a person.

---

## Carried limitations

Unchanged from Week 4, none closed this week:

1. Write-after-settle window on the replay key.
2. Paid-but-undelivered if the device fails after settlement; no refund path.
3. The daily cap is a UTC calendar-day counter, not a rolling window.
4. The Agent Card is unsigned.
5. No automated test suite — every check is a script run by hand. **Scheduled for
   Week 8, and now the most overdue item on the list:** this week added a
   refactor touching every paid route, and the only thing standing between that
   and a regression was running the scripts by hand and reading the output.
6. Rate limiting is not atomic under concurrency.
7. Single device, single buyer — though no longer a single price.
8. Graceful `Ctrl+C` exit unproven on Windows.

New this week:

9. **Inference input is not validated before payment.** A buyer who sends no
   `?text=` still pays and receives a classification of a default sample string.
   Rejecting after payment would mean charging for nothing, so the request is
   served — but the honest fix is validating before the gate, which is not done.

---

## What I need

1. **`EXPORT_TOKEN` on the deployed Worker.** One command. Until then the CSV
   handover in the DoD cannot happen.
2. **The publish decision**, still. Posts #1 and #2 have been ready since Week 4.
   Every funnel in section 4 has an empty top until something is published, and
   every downstream KPI stays at zero by construction.
3. **A clean machine and 20 minutes** for the tutorial run, ideally with someone
   who has not seen the project — that single session closes the tutorial DoD
   *and* the stranger test that has been open since Week 3.
