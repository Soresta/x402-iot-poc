# Real-value settlement — readiness memo

**To:** manager · **From:** internship, Machine-Payments Revenue Sprint
**Date:** 2026-09-08 · **Status:** ⚑ decision input only

**Nothing in this memo has been actioned, and nothing should be.** The programme
is testnet-only and stays that way until external counsel signs off. This exists
so that when that review happens it is fast and cheap, because the questions are
already framed and the technical position is already written down.

Recommendation up front: **do not move to real value in the next quarter.** The
blocker is no longer regulatory ambiguity — that has largely resolved. It is
security posture, and specifically the fact that the payment layer we use has
documented attacks with no fix available to us at the application level.

---

## 1. Current posture, and why it is defensible

| Property | Today |
|---|---|
| Network | Base Sepolia testnet, all nine weeks |
| Asset | Faucet USDC. No real value, by design |
| Custody of funds | **None.** We never hold a balance for anyone |
| Custody of keys | **None.** No key belonging to anyone else is held |
| Who submits transactions | A third-party facilitator, which also pays gas |
| Who bears settlement risk | The buyer, whose own wallet funds it |
| Money direction | Buyer → seller address, directly on-chain |

The architecture has a property worth stating plainly to counsel: **we are not a
payment intermediary.** We never take possession of a customer's funds. A buyer
signs an EIP-3009 authorization; a facilitator submits it; the transfer goes
buyer-to-seller. Our software decides whether to serve a resource, not whether
money moves.

That is a materially smaller regulatory surface than "we process payments", and
it is worth counsel understanding it before they read anything else, because the
first instinct on seeing "stablecoin" is to reach for the money-transmission
analysis.

**Weakness in that position.** It rests on the facilitator remaining a
third party we merely call. If we ever ran our own facilitator — which is
technically straightforward and would improve reliability — we would be
submitting transactions on behalf of others and the analysis changes completely.
That decision should not be made on engineering grounds alone.

---

## 2. What moving to real value would require

### 2.1 Facilitator terms

We currently point at a public facilitator with no contract, no SLA and no
liability position. For testnet that is fine. For real value it is the first
thing to fix.

Needed: a named counterparty, written terms, a stated position on what happens
when a settlement is submitted but fails, and a security attestation.

**The uncomfortable data point.** A 2026 assessment applied agent-economy
security tests to fifteen facilitators including Coinbase's. Violations were
found in **every one evaluated**. This is not one bad vendor; it is an immature
layer. Any facilitator selection needs to be a diligence exercise, not a config
change.

### 2.2 Custody boundaries

Three lines that must not be crossed without a deliberate decision:

1. **We do not hold customer funds.** Not in escrow, not "briefly", not in a
   pooled account.
2. **We do not hold customer keys.** Not even encrypted, not even testnet.
3. **We do not run the facilitator.** See 2.1 — this converts us from a caller
   into a submitter.

All three hold today. Each has an engineering reason to break it, which is why
they are written here rather than assumed.

### 2.3 Abuse and refunds

This is the section I would put in front of counsel first, because it is where
our own testing produced findings rather than opinions.

> **Correction, 2026-09-11.** The first draft of this memo stated two findings
> here that turned out to be wrong: that a device failure after settlement left a
> buyer paid and unserved, and that the replay key was written after settlement.
> Reading the payment middleware's source, then testing it on-chain, showed both
> are the reverse of what this memo said. They are corrected below rather than
> quietly removed, because a counsel review built on the first version would have
> spent time on problems that do not exist.

**A failed response is never charged.** The payment middleware verifies the
proof, runs our handler, and settles only if the handler succeeded. We verified
this against the chain: two paid requests against a deliberately broken device
returned `503`, and the buyer's USDC balance was identical before and after.
So there is no "paid but undelivered" case in this system. There is still **no
refund mechanism** — a request that settles and is later disputed has no path
back — but that is a policy gap, not an observed failure.

**A signed payment proof is a bearer credential.** The protocol has no
application-layer nonce, so we supply one: the proof's hash is stored as an
idempotency key for 24 hours, written *before* settlement. Two requests carrying
the same proof at the same instant can both pass that check, because KV reads
and writes are not atomic; by the middleware's design only one can settle, since
the on-chain EIP-3009 nonce rejects the second, and an unsettled response is
never delivered. **That concurrent case is reasoned from source, not tested.**

**Three 2026 papers document attacks on x402 implementations:** payment replay,
wallet drain via overpayment, prompt injection leading to fraudulent payments,
and privacy leakage through transaction-graph linkability. These are not
theoretical write-ups; they test real facilitator and server implementations.

**Autonomous spending controls are the weakest layer in the whole stack.** Our
own build produced three findings that generalise:

- Buyer-side mandate enforcement is an honour system. We moved verification to
  the seller in Week 4; nothing required us to.
- A mandate without an identity binding is a bearer token. Four lines fix it. No
  specification asks for them.
- Our "daily" cap counted per UTC calendar day, so an agent crossing midnight
  could spend up to twice it in 24 hours. Fixed 2026-09-11 with a rolling window.

All three sat inside a system whose author believed the controls worked. With
real money, "the agent overspent" has no settled liability answer.

### 2.4 Accounting

Per-call micropayments produce a volume of tiny on-chain events that no standard
finance process expects. Before real value:

- Who reconciles the on-chain record against our receipt log, and how often?
- Revenue recognition on a $0.001 API call — per call, or aggregated?
- Which entity's balance sheet does the receiving address belong to?
- Stablecoin holdings: an asset, or a cash equivalent? The GENIUS Act's
  prohibition on yield is relevant to how it is characterised.
- What happens to a settlement that confirms on-chain but never reaches our
  receipt log? Today: nothing. It is revenue we cannot see.

### 2.5 Jurisdictions to ask counsel about

The regulatory picture changed substantially during 2025–26, and mostly in the
direction of clarity:

| Jurisdiction | Position |
|---|---|
| United States | **GENIUS Act** signed 2025-07-18 (PL 119-27). First federal law for payment stablecoins: 1:1 reserves, licensed issuers, published disclosures, yield prohibited |
| European Union | **MiCA** stablecoin provisions in force; CASP authorization required by 2026-07-01 |
| Japan | Revised Payment Services Act in force |
| Brazil | Framework under Law 14.478/2022 and Central Bank Resolutions 519–521 |

**This is why the memo now is cheap.** A year ago the honest answer was "nobody
knows". Today it is a licensing and counsel question with written rules to read
against. The work is bounded.

---

## 3. Pricing models, with unit economics

Our observed cost base, measured rather than estimated: an hour of continuous
buying produced **111 settlements** and cost **nothing** in infrastructure. The
seller runs entirely on free-tier Workers, KV and Durable Objects. Faucet USDC
is free.

That means the interesting variable is not our cost. It is what a machine buyer
will pay, and how the pricing shape affects the accounting burden above.

| Model | Shape | For | Against |
|---|---|---|---|
| **Per call** (today) | $0.001–0.002 per request | No commitment; a stranger's agent can buy once. Aligns cost with use | Maximum accounting events. Revenue per call is below most reconciliation thresholds |
| **Prepaid balance** | Agent tops up, spends down | One settlement per top-up instead of per call. Far less on-chain noise | **We would hold customer funds.** Crosses the custody line in 2.2 and changes the regulatory analysis |
| **Post-paid, settled periodically** | Meter now, settle daily | Fewest settlements; familiar to finance | Requires credit and a collections story with an anonymous counterparty. Probably unworkable |
| **Subscription** | Flat fee, unmetered | Simplest accounting | Throws away the property that makes this interesting — a buyer with no account and no relationship |

**Assessment.** Per-call is the only model that preserves the thing worth
having: a caller with no prior relationship can pay. Prepaid balance is the
obvious efficiency gain and is exactly the change that would make us a custodian.
That trade is a business and legal decision, not an engineering one, and it
should be made explicitly rather than arrived at.

For a first real-value pilot, per-call at a **higher** price point — cents rather
than tenths of cents — reduces the count of accounting events per unit of revenue
without touching custody.

---

## 4. A phased path

Each phase has an explicit go/no-go. No phase begins because the previous one
merely finished.

### Phase 0 — Counsel review (weeks, not months)

**Do:** put this memo and the numbered questions in section 5 to external
counsel. Get a written position on money transmission, on the facilitator
relationship, and on which jurisdictions apply.

**Go/no-go:** written counsel opinion that our non-custodial posture holds, and
that the entity may receive stablecoin revenue in the jurisdictions we operate
in. **Without this, nothing proceeds.**

### Phase 1 — Fix what our own testing found

Independent of counsel, and required before any real value regardless of what
they say:

- [ ] Test the concurrent-replay case that section 2.3 reasons about from
      source: two simultaneous requests with one proof must produce exactly one
      settlement and one delivery.
- [ ] Decide a refund/dispute policy. Not because a failure mode needs it — none
      was found — but because real value will eventually produce a dispute.
- [ ] Sign the Agent Card (A2A v1.0, JWS). Discovery currently trusts TLS alone.
- [x] Make the spending cap a rolling window rather than a UTC calendar day.
      *Done 2026-09-11.*
- [x] Automated test suite. *38 regression tests, one per defect that shipped,
      mutation-checked. Route behaviour over HTTP is still verified by hand.*
- [ ] Facilitator diligence: named counterparty, written terms, security
      attestation.

**Go/no-go:** every box ticked, or each unticked box has a written accepted-risk
sign-off naming who accepted it.

### Phase 2 — Capped pilot

**Do:** one resource, real value, with hard limits set in code:

- a per-transaction cap in the low single-digit dollars;
- a daily total cap for the whole endpoint, not per buyer;
- a kill switch that stops real-value settlement without a deploy;
- daily reconciliation of the on-chain record against our receipt log.

**Go/no-go to proceed past pilot:** thirty consecutive days with zero
reconciliation discrepancies, zero undelivered-but-charged incidents, and no
security finding above low severity.

### Phase 3 — Open

**Do:** remove the caps, keep the kill switch and the reconciliation.

**Go/no-go:** Phase 2 clean, counsel re-confirms against whatever changed, and
someone owns this operationally who is not the person who built it.

---

## 5. Questions for counsel

Numbered so answers can be returned against them.

1. Does a service that never holds customer funds or keys, and whose transfers
   move buyer-to-seller via a third-party facilitator, constitute money
   transmission in the jurisdictions where the entity operates?
2. Does the answer to (1) change if we operate our own facilitator — that is, if
   we submit transactions on behalf of buyers?
3. Which entity should own the receiving address, and does receiving stablecoin
   revenue create a licensing obligation for it?
4. Under MiCA, does accepting a payment in a third-party-issued stablecoin bring
   us within scope of any CASP obligation, given we neither issue nor exchange?
5. What KYC/AML obligations attach to accepting payment from an **anonymous
   wallet with no account**? This is the core commercial property of the product,
   and if it cannot survive AML review then the product does not survive it.
6. What is our liability when an autonomous agent spends beyond its owner's
   intent — and does a signed mandate we verified change that answer?
7. What refund obligation exists when a payment settles and the resource is not
   delivered? On-chain settlement is irreversible.
8. What is the required record-keeping period for micropayment settlements, and
   is our KV receipt log sufficient as a record?
9. How should stablecoin received as revenue be characterised for accounting and
   tax — currency, asset, or cash equivalent?
10. Does publishing prices in a stablecoin constitute pricing in a foreign
    currency for consumer-protection or disclosure purposes?
11. Are there jurisdictions where we should geo-block real-value settlement
    outright rather than analyse further?
12. Does our current public testnet demo, which anyone can pay, create any
    obligation today — or is "no real value" a complete answer?

Question 5 is the one I would ask first. Everything commercially interesting
about this product follows from a buyer needing no account, and that is exactly
the property AML review is most likely to challenge.

---

## 6. What I would say in one paragraph

The technical rails work, the regulatory picture has become legible, and our
infrastructure costs nothing. What is not ready is the security layer above the
payment: the protocol has documented attacks, every facilitator evaluated in 2026
failed a security assessment, and autonomous spending controls are the least
standardised part of the stack — our own build turned up three ways to get them
wrong, all of which looked correct until tested. Get the counsel opinion now,
because it is cheap and it expires slowly. Do not move value until the six items
in Phase 1 are closed, and treat a prepaid-balance model as a custody decision
rather than a product feature.
