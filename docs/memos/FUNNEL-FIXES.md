# Funnel fixes

**W8 REV** · DoD: top-3 drop-offs → before/after proposals with expected-impact
reasoning. I propose; the manager implements.
**Date:** 2026-09-08

---

## The honest caveat, first

The DoD says "from data". **There is no funnel data**, because nothing has been
published and the funnel has had no traffic. Visits: 0. Signups: 0. External
payers: 0.

So these are not measured drop-offs. They are **structural** drop-offs — points
where the current design will lose people, identified by walking the funnel as a
stranger would, plus the one real data point we do have.

Each proposal says what would prove it right or wrong, so the first fifty real
visitors settle these arguments instead of me.

---

## The one real data point

We have a working five-minute quickstart, a live demo, and a public repo. **Zero
external wallets have paid.** That is not a conversion problem — it is an
exposure problem, and it is worth stating before any copy change, because no
amount of button-wording fixes a funnel nobody has entered.

Every fix below is worth roughly nothing until the publish decision is made. I
would rather say that than present three copy tweaks as the answer.

---

## Drop-off 1 — the demo page explains the machinery, not the point

**Where:** first ten seconds on the demo page.

**Why I think it loses people.** The page opens with settlement counters, a live
event feed and a receipts table. All of it answers *"what is happening?"* and
none of it answers *"why should I care?"*. A visitor arriving from a Show HN
comment already knows they are looking at payments; a visitor arriving from a
shared link does not know why an API selling to software is interesting.

The strongest sentence this project owns is not on the page: **fifteen out of
sixteen visits to these sites are machines, and none of them can pay.**

**Before**
> [counters] SETTLEMENTS TODAY · TOTAL VOLUME · DISTINCT PAYERS · SSE STATUS

**After**
> **Most of the traffic hitting this API is not human. Now it can pay.**
> Watch a piece of software discover this endpoint, agree a price, and settle
> on-chain — with no account and nobody approving anything.
> [counters]

**Expected impact:** the largest of the three, because it is the widest point of
the funnel. Everything downstream is gated on someone staying past ten seconds.

**How we would know:** the 30-second comprehension test (`PENDING-HUMAN-TESTS.md`
item 1B). If a stranger cannot say what the page shows, this is confirmed. That
test is one person and thirty seconds, and has been open since Week 3.

---

## Drop-off 2 — nothing on the demo page asks the visitor to do anything

**Where:** between understanding the demo and taking any action.

**Why I think it loses people.** A reader who has understood the page has exactly
one call to action available: an email signup. There is no "try it yourself"
anywhere on the page, even though the quickstart exists, takes five minutes and
is the single highest-intent action available.

The **Who is paying** panel makes this worse in an interesting way: it correctly
says "no external payers yet", which is honest and also reads as *nothing is
expected of you*.

**Before**
> Who is paying — no external payers yet
> [table: our wallet, ours, 100 settlements]

**After**
> Who is paying — no external payers yet.
> **Be the first.** Five minutes, testnet, no signup → [Pay this API]
> [table]

**Expected impact:** moderate, and the most measurable of the three. It converts
a passive panel into the only high-intent CTA on the page, and it is honest — the
board really is empty and the invitation is real.

**How we would know:** clicks on that link, and whether `external_payers` moves
off zero. Both already measured.

---

## Drop-off 3 — the quickstart's first step is the hardest one

**Where:** step 1 of `QUICKSTART.md` — get a wallet and faucet funds.

**Why I think it loses people.** Steps 2–5 are `git clone`, `npm install`, edit a
file, run a command — a developer does those without thinking. Step 1 asks them
to create a wallet, copy a private key into a file, and wait at a third-party
faucet. It is the only step with an external dependency, an unpredictable wait,
and a mild security instinct working against it ("paste a private key where?").

**Before**
> ## 1 · Get a wallet and some test USDC
> Create a new account in any EVM wallet and copy its private key.

**After**
> ## 1 · Get a throwaway wallet (60 seconds)
> **You are creating a wallet that will never hold anything of value.** Not
> linking an existing one — making a disposable one, on purpose.
> [exact steps] · [faucet link] · *the faucet usually takes under a minute; if it
> takes longer, that is the faucet, not you*

**Expected impact:** smallest of the three in absolute terms, but it protects the
highest-value action in the whole funnel — someone who completes the quickstart
has a working x402 seller on their machine.

**How we would know:** the tutorial clean-machine run (`OPEN-ITEMS` B5) and any
issue opened saying "stuck at step 1". The quickstart already asks people to
report where they stalled, which is the instrument for this.

---

## What I am not proposing

**No paid acquisition.** Covered in the Week 7 channel decision: Gate 2 requires
organic signal that cannot exist yet.

**No new pages, no redesign.** Three copy changes and one link. If a visitor
cannot be converted by the honest version of what this is, a bigger page will not
help.

**No urgency or scarcity language.** It would work on some readers and would be
the first dishonest thing on the site.

---

## Order of operations

1. **Publish** — until then all three fixes are theoretical.
2. Ship fix 2 (the CTA) — one line, and it is measured automatically.
3. Run the comprehension test, then ship fix 1 informed by what the stranger
   actually said rather than by what I assume they would say.
4. Ship fix 3 after the first person reports where they stalled.

Fixes 1 and 3 are deliberately sequenced *after* a real observation. I have
guessed at three drop-offs; two of them should be confirmed by a human before
anyone spends time on them.
