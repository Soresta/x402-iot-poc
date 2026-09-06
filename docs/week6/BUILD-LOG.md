# Week 6 Build Log — `x402-iot-poc`

> Append only. Executed 2026-09-06 against local `wrangler dev` and the deployed
> Worker.

**Deployed version this week:** `61f7fd32-93a8-486a-8efa-73289ad1877c`
**Public Worker:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

---

## Audit summary

- **Checks run:** 9
- **PASS:** 9
- **Not runnable this week:** everything that requires publishing — which is most
  of Week 6. See the report.

Week 6 is a launch week. The launch did not happen, so what was actually built is
the instrumentation that makes a launch measurable, plus the copy that would go
out. This log covers the instrumentation; the copy is in `docs/content/`.

---

## Block 1 — Funnel instrumentation

`src/metrics.ts`. Two endpoints:

| Route | Purpose |
|---|---|
| `POST /api/visit` | one aggregate counter per (day, source, campaign) |
| `GET /api/metrics/daily?date=` | everything this project can measure about itself |

**What is stored: a counter.** No IP, no user agent, no cookie, no session, no
path history. The data answers "how many arrived from Hacker News today" and
cannot answer "who". That was a design constraint, not a side effect — the
project already holds an email list, and adding a visitor-tracking store next to
it would have been a second privacy surface for no gain.

`utm_source` and `utm_campaign` are matched against the values in the UTM naming
sheet. Anything unrecognised is bucketed rather than written through, so the KV
namespace cannot be filled with arbitrary strings by anyone who can post a
beacon.

### Test — beacon accepts known values, buckets junk

```powershell
curl.exe -X POST .../api/visit -d '{"source":"hn","campaign":"w6-launch"}'      # 204
curl.exe -X POST .../api/visit -d '{"source":"hn","campaign":"w6-launch"}'      # 204
curl.exe -X POST .../api/visit -d '{"source":"<script>evil</script>","campaign":"whatever"}'  # 204
```

Resulting counters:

```json
"by_source": {
  "direct/none": 1,
  "hn/w6-launch": 2
}
```

**PASS** — the injected string was never stored. It landed in `direct/none`
because it matched nothing in the allow-list.

### Test — daily metrics endpoint

```powershell
curl.exe -sS http://127.0.0.1:8787/api/metrics/daily
```

```json
{
  "date": "2026-09-06",
  "visits": { "total": 3, "by_source": { "direct/none": 1, "hn/w6-launch": 2 } },
  "settlements": {
    "total": 13,
    "by_resource": { "readings": 4, "inference": 5, "unlabelled": 4 },
    "volume_usdc": 0.018,
    "distinct_payers": 1
  },
  "subscribers_cumulative": 2,
  "caveats": [
    "Visit counts are a floor: KV has no atomic increment, so concurrent visits can be undercounted.",
    "Settlement figures cover the last 100 receipts only; older days will read low.",
    "Nothing here identifies a visitor. No IP, user agent, cookie or session is stored."
  ]
}
```

**PASS** — one request replaces assembling the daily row by hand, and the
response carries its own caveats so a reader cannot take the numbers for more
than they are.

### Test — the beacon fires from the real page

Navigated a browser to the deployed demo with launch tags:

```
https://x402-iot-poc.akifk-x402-26.workers.dev/?utm_source=hn&utm_campaign=w6-launch
```

Polling the metrics endpoint afterwards:

```text
t+5s:  {"github/evergreen": 1}
t+10s: {"github/evergreen": 1, "hn/w6-launch": 1}
```

**PASS** — the page's own beacon recorded the campaign without any manual call.

### Finding — remote KV reads lag writes

The beacon above did not appear on the first read and did appear five seconds
later. Cloudflare KV is eventually consistent: a write is not guaranteed visible
to a subsequent read for up to about a minute.

Consequences to hold on to during a real launch:

- `/api/metrics/daily` is **not** a live dashboard. A number pulled seconds after
  a spike will read low.
- Pull the daily figures once, after the day is over, rather than watching them.
- This compounds with the non-atomic increment already documented: both push in
  the same direction, so **visit counts are a floor, never a ceiling.**

Not a defect, and not fixable at this layer. Recorded because the first instinct
on launch day will be to refresh the endpoint and believe it.

---

## Block 2 — Cross-link triangle (partial)

The demo page footer now links the tutorial and the readiness board alongside
the existing GitHub, Agent Card and Receipts links.

```text
GitHub · Agent Card · Receipts API · Tutorial · Readiness board · Base Sepolia testnet · MIT license
```

**PASS as far as it goes.** The DoD asks for three live URLs each linking the
other two. The tutorial and the board are not published on company property, so
two thirds of the triangle currently point at files in the GitHub repo. Those are
real, working links — they are not the triangle the DoD describes, and they do
not produce the backlinks the KPI counts.

---

## Block 3 — Regression after this week's changes

```text
unpaid /api/readings          402
unpaid /api/inference         402
legacy /reading               402
agent card                    200, 2 skills
subscribers count             200
metrics daily                 200
deploy                        61f7fd32-93a8-486a-8efa-73289ad1877c
npx tsc --noEmit              exit 0
```

**PASS**

---

## What is not in this log

The Week 6 tasks are, by hours, mostly publication: a coordinated launch across
Hacker News, Reddit, dev.to and X; a fifteen-message B2B outreach wave; a launch
log with per-channel interest scores; and launch-feedback fixes driven by real
questions.

None of that happened, so none of it is recorded as done. The copy is written and
sitting in `docs/content/launch-week.md` and `docs/content/outreach-wave-1.md`
with every metrics table empty, and the report says why.
