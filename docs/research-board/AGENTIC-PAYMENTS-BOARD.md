# Agentic Payments — research board package (draft for pragma.vision)

**Prepared:** 2026-09-06 · **Status:** draft for manager review, not loaded
**Author:** internship, Machine-Payments Revenue Sprint, W4

This is the content package for the agentic-payments readiness lens. It is not
loaded to the platform — the manager does that. What follows is 11 technologies
with per-facet readiness notes, 20 dated signals with sources, and a score for
every facet with a one-line justification.

**House rule applied throughout:** if a score cannot cite either a source or
something we hit ourselves while building, the score goes down. Several scores
here are lower than the press coverage would suggest, and the reasons are in
the notes.

Scores are 1–5:

| Score | Meaning |
|---|---|
| 5 | Production-ready; we would build a paid product on it today |
| 4 | Solid; known gaps with known workarounds |
| 3 | Usable but sharp edges; expect to write your own safety net |
| 2 | Early; specification or tooling moves under you |
| 1 | Experimental; treat as a research subject |

---

## Scoreboard

| # | Technology | Adopt. | Spec | Tooling | Security | Regul. | Overall |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | x402 (protocol) | 4 | 4 | 4 | 2 | 3 | **3.4** |
| 2 | x402 facilitators (as a layer) | 4 | 3 | 3 | 2 | 3 | **3.0** |
| 3 | EIP-3009 `exact` scheme | 4 | 5 | 4 | 3 | 3 | **3.8** |
| 4 | A2A (Agent2Agent) | 4 | 4 | 4 | 3 | 3 | **3.6** |
| 5 | Signed Agent Cards (A2A v1.0) | 2 | 4 | 2 | 4 | 3 | **3.0** |
| 6 | AP2 (Agent Payments Protocol) | 3 | 3 | 2 | 3 | 3 | **2.8** |
| 7 | ACP (Agentic Commerce Protocol) | 4 | 3 | 4 | 3 | 4 | **3.6** |
| 8 | Pay-per-crawl / pay-per-use | 3 | 2 | 3 | 3 | 3 | **2.8** |
| 9 | Edge runtimes as seller infrastructure | 4 | 4 | 4 | 4 | 4 | **4.0** |
| 10 | Stablecoin settlement (regulatory) | 4 | 4 | 4 | 4 | 4 | **4.0** |
| 11 | Autonomous agent spending controls | 2 | 2 | 2 | 2 | 2 | **2.0** |

The lowest score on the board is the one we are most confident about, because
it is the one we tested hardest. See #11.

---

## 1. x402 — the protocol

**What it is.** Revives HTTP 402: the server answers an unpaid request with
machine-readable payment terms, the client retries with a signed payment header,
a facilitator verifies and settles on-chain.

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | Contributed to the Linux Foundation; the x402 Foundation announced its operational launch on 2026-07-14 with 40 members, including AWS, Circle, Cloudflare, Coinbase, Google, Mastercard, Stripe and Visa ([LF press release](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications)). Coinbase has been reported as saying the protocol processed 169M payments across 590k buyers and 100k sellers in its first year — a figure seen only in secondary coverage. |
| Spec stability | 4 | v2 is settled enough to build on, but the v1→v2 change altered network identifiers from `base-sepolia` to CAIP-2 `eip155:84532` — a breaking change that fails silently when generations are mixed. We lost time to exactly this. |
| Tooling | 4 | Official SDKs work. The header name changed between generations (`X-PAYMENT` → `payment-signature`) with no deprecation error; our own seller silently lost two security controls to this for a week. |
| Security | **2** | Three independent 2026 papers document replay, overpayment wallet-drain, prompt-injection and linkability attacks. The protocol has **no application-layer nonce**, so a signed payment proof behaves as a bearer credential. |
| Regulatory | 3 | Settlement is stablecoin; see #10. The protocol itself takes no custody, which simplifies the question but does not remove it. |

**What we learned building.** The silent failures are the real risk, not the
cryptography. Both defects we found in our own seller were of the same shape:
the code looked correct, the payments still settled, and a control that was
supposed to be running simply was not. Anyone integrating x402 should write a
test that proves each control *fires*, not merely that payments succeed.

## 2. x402 facilitators

**What it is.** A service that verifies payment payloads and settles them
on-chain so sellers do not run blockchain infrastructure.

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | A USENIX Security 2026 study evaluated 15 major facilitators, including Coinbase, Thirdweb, PayAI and Mogami ([paper](https://www.usenix.org/system/files/usenixsecurity26-wang-qinying.pdf)) — a count of those significant enough to test, not a census. Stellar documents a production-ready facilitator of its own ([docs](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar)). |
| Spec stability | 3 | Facilitator behaviour is less specified than the wire protocol; error semantics vary. |
| Tooling | 3 | Easy to point at one; hard to evaluate one. |
| Security | **2** | The USENIX Security 2026 study tested 15 major facilitators, Coinbase's included, and found that every one violated at least one security rule ([paper](https://www.usenix.org/system/files/usenixsecurity26-wang-qinying.pdf)). |
| Regulatory | 3 | The facilitator submits the transaction and pays gas, which places it, not the seller, at the centre of any custody question. |

**What we learned building.** The facilitator is a single point of failure that
the protocol encourages you to forget about. Our seller fails closed — an
unreachable facilitator returns `503 + Retry-After` and serves nothing — and
that path had to be built and tested deliberately. Any integration that treats
facilitator success as the default will serve paid resources for free the first
time the facilitator is slow.

## 3. EIP-3009 `transferWithAuthorization`

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | The settlement primitive under x402's `exact` scheme; widely deployed in USDC. |
| Spec stability | 5 | A finalised, narrow, years-old standard. Nothing moved under us. |
| Tooling | 4 | viem signs it cleanly; works unmodified inside a Cloudflare Worker. |
| Security | 3 | The on-chain nonce prevents the *same authorization* being settled twice — a genuine second line of defence — but it does not protect the application layer above it. |
| Regulatory | 3 | Inherits the stablecoin position. |

**What we learned building.** This is the strongest link in the chain. The
buyer needs no gas: the facilitator submits and pays. That single property is
what makes per-call pricing at $0.001 plausible at all, and it is worth leading
with when explaining the model to someone new.

## 4. A2A (Agent2Agent)

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | 150+ organisations, 22k+ GitHub stars, SDKs in five languages as of 2026-04-09; joined the Agentic AI Foundation alongside MCP on 2026-08-19. |
| Spec stability | 4 | v1.0 shipped 2026-03-12 with a defined migration path for early adopters. |
| Tooling | 4 | Agent Card discovery is a static JSON document over HTTPS — trivially implementable, which is most of why it spread. |
| Security | 3 | The transport story is fine. The trust story depends on signed cards, which is a separate line — see #5. |
| Regulatory | 3 | Not a payments protocol; carries no direct exposure. |

**What we learned building.** Discovery was the cheapest part of the entire
build: one JSON file at a well-known path and an autonomous buyer can find the
price and the endpoint with no prior relationship. The value is in the
convention, not the technology.

## 5. Signed Agent Cards

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | **2** | Formalised in A2A v1.0 (2026-03-12) using JWS with JCS canonicalization. We have seen little evidence of deployment in the wild — **our own Agent Card is unsigned**. |
| Spec stability | 4 | Built on RFC 7515 and RFC 8785, both stable. |
| Tooling | 2 | Signing is straightforward; *verifying* on the buyer side is not yet a default in any SDK we used. |
| Security | 4 | This is the piece that makes decentralised discovery trustworthy at all. |
| Regulatory | 3 | Neutral. |

**What we learned building.** Our buyer fetches an Agent Card over HTTPS and
trusts the price it finds there, with TLS as the only guarantee that the card
came from who it claims. That is adequate for a known seller and inadequate for
open discovery. This is the clearest gap between what we built and what a
production system needs, and it is a strong candidate for the next iteration.

## 6. AP2 (Agent Payments Protocol)

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 3 | Announced 2025-09 with 60+ partners including Mastercard, PayPal and Amex; donated to the FIDO Alliance. Partner counts are not deployments. |
| Spec stability | 3 | v0.2.0 (2026-04) added "Human Not Present" payments. Still a `0.x` version number. |
| Tooling | **2** | We implemented a mandate ourselves rather than adopt an AP2 library, because none we found fitted a Workers runtime. Our mandate is AP2-*style*, not AP2-compliant, and the report says so. |
| Security | 3 | The mandate concept is sound: a signed, scoped, expiring authorization separate from the payment instrument. |
| Regulatory | 3 | The signed audit trail is an asset in any compliance conversation. |

**What we learned building.** The idea is more valuable than the current
specification. Separating *authorization* from *settlement* is the single design
decision that made our system explainable: identity `401`, mandate `403`,
payment `402`, in that order. We got that structure from AP2's thinking without
using AP2's code.

## 7. ACP (Agentic Commerce Protocol)

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | Powers Instant Checkout in ChatGPT; Etsy live, Shopify merchants announced. Real consumer volume. |
| Spec stability | 3 | Beta, date-versioned; latest stable snapshot 2026-04-17. |
| Tooling | 4 | Stripe-backed, and adoptable without Stripe as the processor. |
| Security | 3 | Conventional card rails with delegated payment and authentication — a mature threat model. |
| Regulatory | 4 | Fiat card rails sit inside existing regulation. This is its clearest advantage over crypto settlement. |

**Relevance to us.** Out of our scope, and the honest comparison matters: ACP is
where consumer agentic commerce is actually happening. x402's distinct claim is
per-call machine-to-machine amounts too small for card rails — fractions of a
cent, no account, no prior relationship. Those are different markets, and a
readiness board that pretends they compete would be wrong.

## 8. Pay-per-crawl → pay-per-use

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 3 | Stack Overflow adopted the model (2026-02-19); Cloudflare's Monetization Gateway launched 2026-07-01. Still closed beta for publishers. |
| Spec stability | **2** | The model itself changed inside a year: charging per fetch became paying per *use* in AI answers. A pricing model that moves that fast is not something to build a business plan on yet. |
| Tooling | 3 | Enforced at Cloudflare's edge, so adoption is configuration rather than engineering. |
| Security | 3 | Bot identification is the hard problem, and it is adversarial by nature. |
| Regulatory | 3 | Content licensing rather than payments regulation. |

**Why it belongs on this board.** It is the same thesis from the other end:
machine traffic should pay. Our own baseline makes the case concrete — 21,000
bot visits against 1,400 human ones, and none of the machine traffic can pay for
anything today. The 2026-09-15 crawler-blocking deadline puts a date on when
that stops being theoretical for publishers.

## 9. Edge runtimes as seller infrastructure

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | Cloudflare is a founding member of the x402 Foundation and shipped monetization at the edge. |
| Spec stability | 4 | Workers, Durable Objects and KV are mature. |
| Tooling | 4 | One caveat we hit: payment middleware must be constructed inside the request handler, because crypto is restricted at global scope. And Durable Objects need `new_sqlite_classes` on the free plan. |
| Security | 4 | No servers, no key custody on our side, no blockchain node to run. |
| Regulatory | 4 | Standard cloud posture. |

**What we learned building.** The entire seller — payment gate, replay
protection, rate limiting, receipts, live demo — runs on a free tier. Cost is
not the barrier to entry for machine payments. That is worth saying plainly,
because it is the opposite of what people assume.

## 10. Stablecoin settlement — regulatory posture

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | 4 | The rails work today and are widely used. |
| Spec stability | 4 | Reserve and disclosure requirements are now written down. |
| Tooling | 4 | Compliance tooling follows the licensed issuers. |
| Security | 4 | Issuer risk is now a supervised question rather than an open one. |
| Regulatory | 4 | The GENIUS Act became US law on 2025-07-18 (PL 119-27); MiCA is in full enforcement with authorization required by 2026-07-01. Japan and Brazil have frameworks in force. |

**Why this is a 4 and not a 2.** A year ago "regulatory uncertainty" was the
honest blocker. It is now largely a licensing and counsel question rather than
an open policy one. **This does not change our position:** this programme is
testnet-only until the company's external counsel signs off, and nothing in this
board is a recommendation to move real value. It does mean that review is
cheaper and faster than it would have been in 2025, which is the point of the
Week 7 memo.

## 11. Autonomous agent spending controls

**What it is.** The controls that stop an autonomous buyer spending more than
its owner intended: budget caps, kill switches, mandate scope, expiry.

| Facet | Score | Justification |
|---|:--:|---|
| Adoption | **2** | Everyone agrees they are necessary; no standard says what they must do. |
| Spec stability | **2** | AP2 mandates are the nearest thing, at `0.x`. |
| Tooling | **2** | We wrote all of it ourselves, including the seller-side verification. |
| Security | **2** | See below. |
| Regulatory | **2** | "The agent overspent" has no settled liability answer. |

**What we learned building — this is the most useful entry on the board.**

We shipped a buyer with a daily cap, a kill switch, a signed mandate and a
per-call limit, and then tested them properly. Three findings:

1. **Buyer-side enforcement is an honour system.** Our Week 3 buyer checked its
   own mandate and stopped correctly every time — but a compromised agent simply
   would not have. We moved verification to the seller in Week 4, where it can
   actually refuse: `401` for identity, `403` for scope or expiry.

2. **A mandate without an identity binding is a bearer token.** A valid signed
   mandate copied from a request log works for whoever holds it, unless the
   seller checks that the mandate holder is the account paying. That check is
   four lines of code and nobody's specification mandates it.

3. **A "daily cap" is not a rolling limit.** Ours counted spending per UTC
   calendar day, so an agent running across midnight could spend up to twice its
   cap within 24 hours. We found this by running the agent for an hour across
   midnight and reading the ledger, not by reasoning about the code. Fixed since
   with a rolling window; the finding stands, because the calendar-day version
   is the one most implementations will write first.

None of these are exotic. All three sat inside a system whose author believed
the controls worked. That is why this row scores 2 across the board.

---

## Dated signals

Twenty signals, newest first. Every entry carries a source; one is marked undated because its primary source gives no date, and a date copied from secondary coverage was removed rather than kept.

| # | Date | Signal | Source |
|---|---|---|---|
| 1 | 2026-09-15 | Cloudflare's default settings begin blocking "mixed-use" crawlers on ad-bearing pages | [thenextweb.com](https://thenextweb.com/news/cloudflare-block-ai-crawlers-pay-publishers) |
| 2 | 2026-08-19 | A2A joins the Agentic AI Foundation alongside MCP | [forbes.com](https://www.forbes.com/sites/janakirammsv/2026/08/19/agent2agent-joins-the-agentic-ai-foundation-alongside-mcp/) |
| 3 | 2026-07 | "When HTTP 402 Meets the Blockchain: Risks on Emerging x402 Payments" | [arxiv.org/abs/2607.19545](https://arxiv.org/abs/2607.19545) |
| 4 | 2026-07-14 | Linux Foundation announces the operational launch of the x402 Foundation, with 40 members (intent to launch was announced in April 2026) | [linuxfoundation.org](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications) |
| 5 | 2026-07-01 | Cloudflare launches its Monetization Gateway; pricing for pages, APIs, datasets and MCP tools settled in stablecoins via x402 | [techcrunch.com](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/) |
| 6 | 2026-07-01 | MiCA authorization deadline for crypto-asset service providers in the EU | [blindpay.com](https://blindpay.com/resources/more/stablecoin-regulation-tracker-2026) |
| 7 | 2026 | USENIX Security 2026: 15 major x402 facilitators tested, Coinbase included; every one violated at least one security rule | [usenix.org](https://www.usenix.org/system/files/usenixsecurity26-wang-qinying.pdf) |
| 8 | 2026-05 | "Five Attacks on x402 Agentic Payment Protocol" — authorization, binding, replay and web-layer weaknesses | [arxiv.org/abs/2605.11781](https://arxiv.org/abs/2605.11781) |
| 9 | 2026-05 | "Free-Riding the Agentic Web: A Systematic Security Analysis of x402 Payments" | [arxiv.org](https://arxiv.org/pdf/2605.30998) |
| 10 | 2026-04-17 | ACP publishes its latest stable date-versioned snapshot | [docs.stripe.com](https://docs.stripe.com/agentic-commerce/acp) |
| 11 | 2026-04-09 | A2A passes 150+ organisations, 22k+ GitHub stars, SDKs in five languages | [stellagent.ai](https://stellagent.ai/insights/a2a-protocol-google-agent-to-agent) |
| 12 | 2026-04 | AP2 v0.2.0 ships "Human Not Present" payments | [eco.com](https://eco.com/support/en/articles/15192002-ap2-protocol-explained-google-s-agentic-commerce-standard-2026) |
| 13 | 2026-04 | "Hardening x402: PII-Safe Agentic Payments via Pre-Execution Metadata Filtering" | [arxiv.org](https://arxiv.org/pdf/2604.11430) |
| 14 | 2026-03-12 | A2A v1.0 released; cryptographically signed Agent Cards via JWS + JCS | [agora-intelligence.com](https://agora-intelligence.com/en/blog/leon-a2a-protocol-production-2026) |
| 15 | undated | Stellar documents a production-ready x402 facilitator ("Built on Stellar") | [developers.stellar.org](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar) |
| 16 | 2026-02-19 | Stack Overflow and Cloudflare launch a pay-per-crawl model | [stackoverflow.blog](https://stackoverflow.blog/2026/02/19/stack-overflow-cloudflare-pay-per-crawl/) |
| 17 | 2026 (1st yr) | Reported Coinbase figure: 169M x402 payments, 590k buyers, 100k sellers — **secondary only**, attributed to Coinbase without a link | [infoq.com](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/) |
| 18 | 2025-09 | AP2 announced with 60+ partners (PayPal, Mastercard, Amex) | [stripe.com](https://stripe.com/blog/developing-an-open-standard-for-agentic-commerce) |
| 19 | 2025-07-18 | GENIUS Act signed into US law as PL 119-27 | [bitwage.com](https://bitwage.com/en-us/blog/stablecoin-regulation-guide-2026-genius-clarity-mica) |
| 20 | 2025-05-06 | Coinbase releases the x402 protocol | [x402.org](https://x402.org/x402-v2-launch/) |

### Signal quality note — checked 2026-09-11

The first draft flagged four signals as secondary coverage. Each was checked
against its source and a primary source was looked for:

| Signal | What the check found | Outcome |
|---|---|---|
| "18 facilitators across 7 chains" | **The cited article does not contain this claim.** It had come from a search summary that merged several sources, and the link was never opened. No primary source found. | **Removed.** |
| x402 Foundation operational launch | Date correct, but the link pointed to April's *intent to launch*. The draft also said "Anthropic among 20+ members"; the primary release lists **40 members and does not name Anthropic**. | **Corrected** to the primary release. |
| Facilitators failing security tests | Primary source found: a **USENIX Security 2026** paper. 15 facilitators tested; every one violated at least one rule. | **Upgraded** to the paper. |
| Stellar production facilitator | **The cited article does not mention Stellar.** Stellar's own documentation confirms a production-ready facilitator but gives no release date. | **Corrected**; date removed. |
| 169M payments, 590k buyers | The cited article does contain it, attributed to Coinbase, with no link. No primary source found. | **Kept**, labelled as a reported figure. |

Two of the four flagged signals cited an article that did not say what the board
claimed. That is the same failure this project kept finding in its own code — a
reference that looked right and was never opened — and it is the reason signals
are now checked before load rather than after.

---

## What this board says, in three sentences

The rails work: settlement is solved, discovery is trivial, and the whole seller
side runs on a free tier. What is not solved is everything above the payment —
identity of the seller you discovered, authorization of the agent that is
spending, and the fact that a signed payment proof is a bearer credential with
no application-layer nonce. Anyone building here should expect to write those
safety nets themselves, and should test that they actually fire, because the
failure mode is silence rather than an error.

---

## Open items before this can be loaded

1. ~~Confirm the flagged signals against primary sources.~~ Done 2026-09-11 — see
   the signal quality note. One removed, two corrected, one upgraded, one kept
   and labelled. The board now carries 20 signals.
2. Manager decision on whether ACP belongs on an *agentic payments* board at all,
   given it is fiat rails — included here for honest contrast, easily cut.
3. Scores are one person's assessment from one build. A second reader should
   challenge #1 security (2) and #10 regulatory (4) in particular; those are the
   two most likely to be argued with.
