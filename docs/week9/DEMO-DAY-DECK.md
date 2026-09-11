# Demo Day — deck script

**W9 OPS** · 14 slides · target runtime 20 minutes, 10 for questions
**Status: written. Not rehearsed. No fallback video recorded.**

The DoD asks for two rehearsals and a recorded fallback for the live demo.
Neither has happened, and both are listed in `docs/OPEN-ITEMS.md`. Rehearsing is
an hour; the fallback recording follows `docs/content/demo-video-script.md`.

**The spine:** use-case (1) → live run (4) → funnel numbers (3) → impact memo
(3) → months 3–6 (2) → the ask (1).

---

## 1 · The number this whole thing rests on

> **21,000 machine visits a week. 1,400 human ones.**
> Fifteen to one — and none of the fifteen can pay you.

Your own baseline sheet, not an industry statistic.

Every one of those visits reads something and costs something to serve. They do
not pay because there is no way for them to: no card, no account, no patience for
a signup form.

**Speaker note:** do not rush this. Everything after it is a consequence.

---

## 2 · What was built

> An API whose customer is software.

A Cloudflare Worker sells two things — simulated sensor readings and model
inferences — to autonomous agents that have never seen it before. No account, no
API key, no prior relationship.

HTTP has had a status code reserved for this since 1997 and unused: `402 Payment
Required`.

Live, MIT-licensed, testnet-only, `v1.0.0` tagged.

---

## 3 · LIVE — discovery

*Terminal and browser side by side.*

Run the buyer. It fetches `/.well-known/agent-card.json` and finds two products
with two prices it has never been told.

> The buyer had never seen this seller before this request.

**If the live run fails:** cut to the fallback video. Do not debug on stage.

---

## 4 · LIVE — the payment

Unpaid request → `402` with machine-readable terms. The agent signs, retries,
settles.

> No account. No API key. No human approved this.

Then the block explorer, held for a full two seconds: **Status Success**, the
USDC transfer, buyer → seller.

**This is the slide the talk exists for.** If one thing is in focus, it is this.

---

## 5 · LIVE — refusals

The part that separates a demo from a payment system. Four things the seller
refuses, run live:

| Attempt | Response |
|---|---|
| Replay the same proof | `402 payment_already_used` |
| Underpay | `402 payment_amount_invalid` |
| Expired mandate | `403 mandate_expired` |
| Someone else's mandate | `401 identity_mismatch` |

Three layers, in order: **401 who are you · 403 are you allowed · 402 show the
money.** Each is cheaper than the next, so the expensive check runs last.

---

## 6 · LIVE — negotiation, and an honest "no"

An agent whose mandate cannot cover the price counters at its limit:

```
[agent] Counter-offer declined for sell-inference: offered $0.001, they want $0.002
[agent] Paying $0.001 for sell-iot-reading …
```

Our seller does not discount, so it always declines. What the exchange buys is a
**machine-readable no with the real price attached** — the agent stops guessing
and buys what it can afford instead.

---

## 7 · The funnel: built, instrumented, empty

| | |
|---|---:|
| Settlements executed | 189 |
| Volume | $0.191 testnet |
| Distinct paying wallets | 1 |
| **External paying wallets** | **0** |
| Email list | 0 |
| Backlinks | 0 |

**Nothing has been published.** Ten assets are written and unposted.

The 189 settlements are the system buying from itself. The external-payer count
is computed by excluding our own wallets **in code** — `/api/payers` returns
`milestone_w7_met: false` — so this slide cannot be written any other way.

---

## 8 · Why zero

One input requested in Week 2 never arrived, and one publish decision has been
open since Week 4.

> Every GTM and REV metric is zero **by construction**, not by underperformance.

**And the part that is mine:** I treated distribution as something that starts
once the build is ready, and kept making the build readier. The plan says *"the
REV lane survives first — say it Monday, not Friday."* I reported it weekly
instead of escalating it once, hard, in Week 3.

---

## 9 · What the work is actually worth

Zero revenue. Six reusable assets:

| Asset | State |
|---|---|
| Working PoC, deployed, tagged v1.0.0 | live |
| 61-test suite, 8 of 8 known defects caught when reintroduced | live |
| Real-value readiness memo, 12 counsel questions | delivered |
| Agentic-payments research board — 11 technologies, 21 dated signals | drafted |
| Ten publishable assets — tutorial, 3 posts, threads, Show HN, deck | written |
| Four documented defect classes in a young ecosystem | published |

The memo shortens a future legal review. The board is the Watch subscription's
content. Both are real and neither is revenue, and I would rather you see both
numbers than have one dressed as the other.

---

## 10 · What broke — the most useful slide here

Four defects reached production in nine weeks. All four shared one property:

> **In this stack, wrong looks like working.**

The worst: the seller read the payment proof from the wrong header for a week.
Payments settled perfectly while replay protection and rate limiting **never
ran**. My replay test passed the whole time — the rejection was coming from the
blockchain, not from the protection I thought I was testing.

Right answer, wrong reason. The least useful kind of green check.

---

## 11 · What I did about it

A regression suite with one test per shipped bug, then each bug deliberately
reintroduced to prove the tests catch it.

**The fourth proved itself by accident.** The mutation script crashed after
writing a mutation and before restoring the file, leaving the header bug back in
the tree. The suite failed immediately, unprompted.

> That defect survived a week of manual testing in Week 3.
> It survived ninety seconds this time.

---

## 12 · Where this ecosystem honestly is

From the research board — scores that cite sources or our own experiments:

- **x402 security: 2/5.** Three 2026 papers document replay, wallet-drain and
  prompt-injection attacks. No application-layer nonce.
- **Facilitators: 2/5.** An assessment found violations in **every one it
  evaluated**, Coinbase's included.
- **Regulatory: 4/5.** GENIUS Act is US law; MiCA is enforcing. This is no longer
  the blocker people assume.
- **Agent spending controls: 2/5 everywhere** — the lowest row, and the one we
  know best, because all three findings behind it came from this repo.

**Recommendation in the readiness memo: do not move to real value next quarter.**
The blocker is security, not regulation.

---

## 13 · Months 3–6

Conditional on the publish decision, because without it none of these are
reachable and I will not sign up for numbers I cannot influence.

| Target | Number |
|---|---:|
| External paying wallets | 5 |
| Email list | 50 |
| Quality backlinks | 10 |
| B2B briefings held | 6 |
| Real-value pilot | **counsel opinion obtained, no value moved** |

Plan: publish → sign the Agent Card → run the human tests →
counsel review → *then* consider paid acquisition.

---

## 14 · The ask

**One decision and one hour.**

1. **Publish.** Everything is written and reviewed-ready. Days, not weeks.
2. **One hour of somebody's time** for six tests I cannot run myself — the
   stranger test, the comprehension test, a real `Ctrl+C`. They close six DoD
   rows currently reading NOT VERIFIED.

And a role: **own the agentic-payments research vertical** — the board, the
readiness briefings, and the PoC as its evidence. Written up in
`docs/week9/ROLE-PROPOSAL.md`.

> The machine works. Nobody has seen it. That is the whole gap, and it closes
> with a decision rather than more code.

---

## Delivery notes

- **Slides 3–6 are live.** Pre-flight: deploy current, `buyer/ledger.jsonl`
  moved aside so the daily cap does not stop the agent mid-demo, explorer tab
  pre-opened on a known-good transaction.
- **Do not debug on stage.** One failure → fallback video → keep talking.
- Slide 7 will be read as bad news. Say the number plainly and move to slide 8;
  defending it makes it worse.
- Expected question — *"why not just fund a second wallet?"* Answer: it would
  produce a settlement from a different address and it would not be adoption. The
  KPI is wallets we do not own, and the exclusion is in config so the line cannot
  blur later.
- Expected question — *"is 189 settlements good?"* Answer: it is 189 settlements
  the system made buying from itself. It proves the machine runs. It proves
  nothing about demand.
