# Week 6 Report — Launch week

**Date:** 2026-09-06 · **Deployed version:** `61f7fd32-93a8-486a-8efa-73289ad1877c`
**Evidence:** `docs/week6/BUILD-LOG.md`

Week 6 is the launch. The launch did not happen.

That is the honest headline, and everything below is written around it rather
than over it. What was built is the instrumentation that makes a launch
measurable and the copy that would go out; what is missing is the part where a
person presses publish.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| Coordinated launch | Launch log with links, per-channel interest scores, traffic snapshots | **NOT EXECUTED** — copy written, nothing posted |
| Tutorial live + cross-link triangle | Three live URLs, each linking the other two; first backlinks land | **PARTIAL** — demo links both others; the other two are not published |
| Funnel instrumentation + daily metrics log | 7-day funnel snapshot presented Friday | **BUILT, NO DATA** — endpoint live and tested; there is no traffic to snapshot |
| B2B outreach wave #1 | 15 sent, CRM updated, ≥3 replies, ≥1 briefing | **NOT EXECUTED** — 0 sent; template and rubric written |
| Launch-feedback fixes | Zero broken paths; FAQ from real questions | **PARTIAL** — paths verified; FAQ is predicted, not collected |
| Rhythm + Friday demo #6 | Launch numbers reviewed channel by channel | **NOT HELD** — no numbers exist |

**Every metric this week is zero, and every zero is real.** None of them are
estimates, and none are presented as anything else.

---

## 1. What was actually built: instrumentation

The one thing worth doing in a launch week with no launch is making sure that
when the launch happens, it produces numbers instead of impressions.

`GET /api/metrics/daily` now returns, in one request:

- visits by `utm_source` / `utm_campaign`
- settlements for the day, split by resource
- volume in USDC
- distinct payers
- cumulative subscribers

The demo page fires a beacon on load, tested end to end: a browser opened at
`?utm_source=hn&utm_campaign=w6-launch` produced exactly that counter.

**What is stored is a counter, and nothing else.** No IP, no user agent, no
cookie, no session, no path history. The data can answer "how many arrived from
Hacker News today" and cannot answer "who". The project already holds an email
list; adding a visitor-tracking store beside it would have been a second privacy
surface for no analytical gain.

Unrecognised UTM values are bucketed rather than written through, so nobody who
can post a beacon can write arbitrary strings into our storage.

### Two reasons the visit numbers are a floor

Both are properties of KV, both documented in the response itself:

1. **No atomic increment.** Two visits in the same millisecond can read the same
   value and write the same value, losing one.
2. **Eventually consistent reads.** A write is not reliably visible to a read for
   up to about a minute. Observed directly: the browser beacon was absent at
   t+5s and present at t+10s.

The practical instruction is in the build log: **pull the day's figures once,
after the day is over.** The instinct on launch day will be to refresh the
endpoint and believe it, and that instinct will produce numbers that are wrong in
a predictable direction.

---

## 2. What is written and waiting

| Asset | What it is |
|---|---|
| `docs/content/launch-week.md` | Show HN title + full first comment, two subreddit posts rewritten per community, the posting sequence, an empty launch log, and an FAQ |
| `docs/content/outreach-wave-1.md` | Outreach skeleton, targeting rubric, segment table, CRM shape, and the 10-slide deck outline |
| `docs/content/post-1…`, `post-2…` | The two articles, ready since Week 4 |
| `docs/content/publish-wave-1.md` | X threads, directory submission, UTM scheme |

The Show HN first comment leads with limitations — unsigned Agent Card, the
write-after-settle window, the UTC-midnight cap, no automated test suite — and
asks for feedback on the one thing I could not find a standard for: binding the
mandate holder to the paying account. That is a deliberate choice. Hacker News
finds the limitations anyway; finding them yourself first is the difference
between a thread about the work and a thread about the overclaiming.

---

## 3. Outreach: what I did not do, and why

The DoD is 15 messages sent. Zero were sent, and I did not assemble the list of
15 named individuals either.

Two reasons, both of which I would rather state than route around:

**The house rule is public business information only, no scraping personal
data.** Compiling a table of named individuals, their roles and their contact
details — at speed, from an agent session — is the activity that rule exists to
prevent. The rubric for building that list is written; building it is a person's
job with the manager's sign-off.

**The rule that ≥70% of each message is custom makes advance drafting
impossible.** The hook is one specific true observation about that company's
recent work. It cannot be written before reading their work. The template makes
that explicit: *if you cannot write this line, do not send the message.*

So what exists is the skeleton, the segment-by-segment view of what the briefing
is actually about, the disqualifiers, and the CRM columns. The names are the
part a person adds.

---

## 4. The cross-link triangle, honestly

The demo page footer now links the tutorial and the readiness board. Those are
real working links to files in the public repo.

They are not what the DoD describes. The DoD wants three live destinations on
company property, each linking the other two, producing the first quality
backlinks — and a link from our own demo page to our own repo is not a backlink
by any definition the KPI would accept. Recorded as `PARTIAL` rather than dressed
up.

---

## 5. The FAQ is predicted, not collected

Six entries, covering the questions this project would most likely get: is it
real money, why not Stripe, what stops replay, what if the facilitator dies, can
the agent overspend, why a Worker.

They are written from knowing the system, not from anyone asking. The document
says so at the top, and the instruction is to delete every entry nobody actually
asked and add the ones they did. An FAQ assembled in advance is a guess about
strangers; the DoD asks for one built from real questions, and that distinction
is the whole value of the exercise.

---

## Carried limitations

Unchanged, and one is now overdue rather than merely open:

1. Write-after-settle window on the replay key.
2. Paid-but-undelivered if the device fails after settlement; no refund path.
3. The daily cap is a UTC calendar-day counter, not a rolling window.
4. The Agent Card is unsigned.
5. **No automated test suite.** Scheduled for Week 8. Two weeks running now, the
   only thing standing between a refactor and a regression has been running
   scripts by hand and reading the output.
6. Rate limiting is not atomic under concurrency.
7. Single device, single buyer.
8. Graceful `Ctrl+C` exit unproven on Windows.
9. Inference input is not validated before payment.

New this week:

10. **Metrics are a floor, not a measurement.** Non-atomic KV increments and
    eventually-consistent reads both undercount, and neither is fixable at this
    layer. Any figure quoted from `/api/metrics/daily` should carry that
    qualifier — it is quoted in the response for exactly that reason.

---

## What I need

Only one thing, and it is the same thing as last week and the week before:

**A decision on publishing.** Six assets are written and reviewed-ready. The
instrumentation is live and tested. Every funnel is wired and every metric reads
zero, because the top of the funnel is empty by construction.

Week 7 asks for external agents to start paying, and Week 8 asks for a revenue
impact memo. Both of those are downstream of publication. If nothing goes out,
Week 7's Milestone 4 cannot be reached by any route, and Week 8's memo will be a
memo about a launch that did not happen — which I will write honestly, but which
is a much smaller document than the one that was planned.
