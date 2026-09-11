# Agentic payments readiness briefing — 10 slides

**W7 REV** · the deck behind the free 20-minute briefing offered in outreach.
**Status: content complete, not designed.** This is the script; someone still has
to build the slides.

**The rule that makes this deck worth attending:** honest scores only. A briefing
that concludes "this is not ready for you yet" earns more than a pitch, and it is
the only version that survives the audience checking it afterwards.

---

## 1 · What changed

> Machine traffic is already the majority, and none of it can pay.

On the sites behind this project: **21,000 automated visits a week against 1,400
human ones.** Fifteen to one.

Those visits read content, call endpoints, and cost money to serve. They pay
nothing — not from unwillingness, but because every payment path on the web
terminates in a human with a card.

**Speaker note:** open with their number, not ours, if they will share it. This
slide lands when it is their log file.

---

## 2 · Four protocols, and what each is actually for

| | Question it answers | Where it is used |
|---|---|---|
| **x402** | How does a machine pay for one HTTP request? | Per-call APIs, content, MCP tools |
| **AP2** | What is this agent allowed to spend? | Signed mandates, audit trail |
| **A2A** | How do agents find and describe each other? | Agent Cards, discovery |
| **ACP** | How does an agent buy from a shop? | ChatGPT Instant Checkout, card rails |

**They are not competitors.** ACP is where consumer agentic commerce is actually
happening today, on card rails, inside existing regulation. x402's distinct claim
is amounts too small for cards — fractions of a cent, no account, no prior
relationship.

**Speaker note:** if their use case is a consumer buying a product, say so and
point at ACP. That answer is why they will take the second meeting.

---

## 3 · Readiness scores

From our research board — 11 technologies, five facets, every score citing a
source or one of our own experiments.

| | Adopt. | Spec | Tooling | Security | Regul. |
|---|:--:|:--:|:--:|:--:|:--:|
| x402 | 4 | 4 | 4 | **2** | 3 |
| Facilitators | 4 | 3 | 3 | **2** | 3 |
| EIP-3009 | 4 | **5** | 4 | 3 | 3 |
| A2A | 4 | 4 | 4 | 3 | 3 |
| Signed Agent Cards | **2** | 4 | **2** | 4 | 3 |
| AP2 | 3 | 3 | **2** | 3 | 3 |
| ACP | 4 | 3 | 4 | 3 | 4 |
| Edge as seller infra | 4 | 4 | 4 | 4 | 4 |
| Stablecoin settlement | 4 | 4 | 4 | 4 | 4 |
| **Agent spending controls** | **2** | **2** | **2** | **2** | **2** |

**Speaker note:** do not skip the twos. They are the reason this briefing is
credible.

---

## 4 · Security posture — the part nobody leads with

Three peer-reviewed papers in 2026 documented attacks on x402 implementations:

- payment replay — **the protocol has no application-layer nonce**
- wallet drain via overpayment
- prompt injection leading to fraudulent payments
- privacy leakage through transaction-graph linkability

And an independent assessment applied agent-economy security tests to fifteen
facilitators, **including Coinbase's**. Violations were found in every one
evaluated.

**What that means for you:** a signed payment proof behaves as a bearer
credential. If you build on this, the replay protection is yours to write. Ours
is a SHA-256 of the proof held for 24 hours, written before any money moves.
Two simultaneous requests with one proof can both pass that check — only one can
settle, but test that yourself rather than taking our word for it.

---

## 5 · Regulatory posture — better than you have been told

| | |
|---|---|
| **US** | GENIUS Act signed 2025-07-18. First federal payment-stablecoin law: 1:1 reserves, licensed issuers, yield prohibited |
| **EU** | MiCA in force; CASP authorization required by 2026-07-01 |
| **Japan** | Revised Payment Services Act in force |
| **Brazil** | Framework under Law 14.478/2022 |

A year ago the honest answer was "nobody knows". Today it is a licensing and
counsel question with written rules to read against.

**What stays undecided:** what AML obligations attach to accepting payment from
an anonymous wallet with no account — which is the exact property that makes the
model commercially interesting.

---

## 6 · What this means for your sector

*One slide, rewritten per recipient. This is the ≥70% custom part.*

| Sector | The real question | Honest answer today |
|---|---|---|
| IoT platform | Can devices sell their own data? | The device side works. The hard part is authorization, not payment |
| API vendor | Is per-call machine pricing real? | Yes, at a tenth of a cent, on a free tier — with three named failure modes |
| Agent tooling | How do agents pay safely? | Mandates and caps exist; nothing standardises them, and we found three ways to get them wrong |
| Paytech | Where does this sit vs ACP? | Different markets. We will not pitch against your rails |

---

## 7 · What a first experiment costs

**Nothing, and about an afternoon.**

We ran an hour of continuous machine-to-machine buying: 111 settlements, 98.2%
success, on free-tier infrastructure. The only consumable was faucet tokens.

The buyer needs no gas — EIP-3009 lets the facilitator submit and pay. That is
what makes tenth-of-a-cent pricing arithmetically possible.

**So the question is not "can we afford to try". It is "do we have traffic that
would pay".**

---

## 8 · What we would not build on yet

Said plainly, because you will find these anyway:

- **Discovery is unsigned in practice.** A2A v1.0 specifies signed Agent Cards.
  We have not implemented them; TLS is the only guarantee that a price came from
  who you think.
- **Agent spending controls are the least mature layer in the stack.** Our own
  build produced three findings: buyer-side enforcement is an honour system, a
  mandate without identity binding is a bearer token, and a "daily" cap that
  counts calendar days lets an agent spend twice it across midnight. All three
  are fixed in our build — the point is that each looked correct until tested.
- **There is no refund or dispute path.** A failed request is never charged —
  we checked on-chain — but a successful one that is later disputed has no way
  back, and on-chain settlement is irreversible.

**Speaker note:** this slide is the product. Everything else is available from a
press release.

---

## 9 · How ongoing monitoring works

The readiness board is maintained, not published once: dated signals with source
URLs, re-scored as specs move, with the reasoning attached to each score.

The Watch subscription is that board, kept current, so you are not re-doing this
assessment every quarter while four specifications move underneath you.

---

## 10 · The offer

**A free 20-minute readiness briefing for your sector.** Useful whether or not we
ever work together.

What you get: this deck rewritten for your traffic and your constraints, plus a
straight answer on whether machine payments are worth your time yet.

What we want: to know what breaks for you. That is what keeps the board honest.

Live demo · open-source PoC · testnet only:
**github.com/Soresta/x402-iot-poc**

---

## Delivery notes

- **20 minutes means 20 minutes.** Ten slides, two minutes each, questions after.
- Never promise outcomes. Never use "guarantee". No SLA language.
- No prices of ours appear anywhere in the deck.
- If their honest answer is "not yet", say it in the meeting. The follow-up you
  earn is worth more than the one you would have forced.
