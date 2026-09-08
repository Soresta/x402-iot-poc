# Months 3–6 — what I would own

**W9 OPS** · DoD: a written proposal for what I would own next, with targets I
would sign up for.
**Date:** 2026-09-08

The brief says *pick, don't list*. So this is one direction, argued, rather than
three options with the choice handed back.

---

## The pick

**Own the agentic-payments research vertical on pragma.vision — the readiness
board, the briefings that sell from it, and the PoC as its evidence base.**

Not the starter kit on soft.house. Not the growth loop. Those are defensible
choices and I am arguing against them below, because a proposal that does not say
what it is giving up is not a proposal.

---

## Why this one

**It is the only one of the three where the nine weeks are a moat rather than a
head start.**

The research board's credibility comes from a specific thing: every score cites
either a published source or a defect we hit ourselves. The row scoring lowest —
autonomous agent spending controls, 2 across every facet — is justified by three
findings from this repo:

- buyer-side mandate enforcement is an honour system;
- a mandate without an identity binding is a bearer token, and the fix is four
  lines no specification asks for;
- a "daily" cap counting calendar days lets an agent spend twice its limit across
  midnight.

Nobody writing that board from press releases can produce those. They are the
difference between a readiness assessment and a link roundup, and they only exist
because someone built the thing and then tried to break it.

**The market timing is unusually legible.** Four specifications are moving at
once — x402 to a Linux Foundation body, A2A to v1.0 with signed cards, AP2 at
0.2.0 and donated to FIDO, ACP in beta. Three 2026 papers document real attacks;
an assessment found violations in every facilitator it tested. Regulation went
from "nobody knows" to written law inside a year. Anyone evaluating this space
right now has to re-do that work every quarter, and re-doing it is exactly what a
Watch subscription is for.

**It converts the honest posture into the product.** The most useful slide in the
briefing deck is *"what we would not build on yet"*. That is not a caveat
attached to a sale — for this audience it is the sale, and it is a thing I have
already demonstrated I will write down even when it makes our own numbers look
worse.

---

## What I am giving up, and why

**Productizing the x402 starter kit on soft.house.** Genuinely attractive: the
tutorial exists, the code is MIT, the free-tier story is strong. I am not picking
it because it competes with every other x402 quickstart and the differentiation
is quality of writing, which is easy to copy. The research vertical's
differentiation is a maintained evidence base, which is not.

**Running the growth loop I built.** The instrumentation, funnel map, UTM scheme
and email capture are mine and they work. But the loop is currently a machine
with nothing in it, and the reason is a decision rather than a capability gap.
Owning a loop whose input I do not control is the position I have spent seven
weeks in, and I would rather not sign up for another quarter of it.

---

## What the role actually is

| | |
|---|---|
| **Maintain the board** | Re-score quarterly against dated signals with sources. Confirm the four currently flagged as secondary coverage. Add technologies as they appear |
| **Run the briefings** | The 20-minute readiness briefing per sector, from the 10-slide deck. Honest scores; a briefing that concludes "not yet for you" is a success |
| **Keep the PoC current** | It is the evidence. Close the six items gating v1.0; implement signed Agent Cards; keep the seller running as a live reference implementation |
| **Publish the findings** | Every defect found becomes a board entry and a post. The four so far are the template |
| **Feed the Watch product** | The board *is* the subscription's content. Making it worth paying for is the job |

---

## Targets I would sign up for

Conditional on the publish decision, stated plainly, because seven weeks of
evidence say that decision is the binding constraint and not my throughput.

| Target | Number | Measured by |
|---|---:|---|
| Board technologies maintained | 15 | the board, re-scored quarterly |
| Dated signals, every one sourced | 60 | the board |
| Readiness briefings delivered | 12 | CRM |
| Watch trials started | 6 | manager's export |
| External paying wallets on the PoC | 5 | `/api/payers` — unfakeable |
| Email list | 50 | `/api/subscribers/count` |
| Published findings posts | 6 | live links |
| Real-value readiness | **counsel opinion obtained, no value moved** | the memo's Phase 0 |

**Two of these are measured by infrastructure I built, in code that excludes our
own wallets.** I chose them deliberately: they are the targets I cannot flatter.

**What I will not sign up for:** a revenue number. I do not control pricing, the
sales conversation, or the publish decision, and a target I cannot influence is a
number to explain away rather than hit.

---

## The first thirty days

1. **Publish.** Everything is written. Days, not weeks.
2. **Close A1–A6 in `docs/OPEN-ITEMS.md`** — the correctness items that gate real
   value and that the briefings will be asked about.
3. **Sign the Agent Card.** The clearest gap between what we built and what open
   discovery needs, and the most credible single upgrade to show a briefing
   audience.
4. **Counsel review** of the readiness memo. Cheap now; the answer expires
   slowly.
5. **Confirm the four secondary-source signals**, then load the board.
6. **Run six briefings** from the deck and rewrite it from what people actually
   ask.

---

## The honest case against me

You should weigh these, and I would rather write them than have them raised.

**I did not get this in front of anyone.** Nine weeks, zero external readers,
zero external payers. Some of that is a blocked input and a pending decision.
Some of it is that I kept building because building is what I am comfortable
doing, and I reported the blocker weekly instead of escalating it once in Week 3.
Owning a research vertical means the output is writing and conversations, not
commits — that is a real shift and it is the shift I am asking for on purpose.

**I built the test suite last.** Four defects reached production in the interval.
The correction is shipped and mutation-verified, but the judgement error is on
the record.

**One nine-week project is not a track record** in a field where four
specifications are moving simultaneously. What I have is a demonstrated habit of
testing claims — including my own, including when the answer was that a report I
inherited cited evidence that did not exist.

That habit is the whole argument for putting me on a readiness board, and it is
the only argument I would make.
