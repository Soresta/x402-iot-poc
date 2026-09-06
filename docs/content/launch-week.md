# Launch week — copy, sequence, and log (W6)

**⚑ GATE — manager review before anything goes out.**
**Status: NOT PUBLISHED.** No post has gone live. There are no links, no interest
scores and no traffic in this document, because none exist yet.

Everything here is written to be posted as-is once approved.

---

## The sequence

| When | Channel | Asset |
|---|---|---|
| Tue, US morning | Hacker News | Show HN + immediate first comment |
| Wed | Reddit | one subreddit, rewritten for it |
| Wed | dev.to | post #2 (architecture) |
| Wed | X | thread #2 |
| Thu | Reddit | second subreddit, rewritten again |
| Thu | dev.to | post #1 (build in public) |

**Rules that override the schedule.** Answer every comment the same day. Thank
critics. If something is broken, fix it and say so in-thread — "fixed, thanks"
earns more than any rebuttal. Never cross-post the same text; each community
gets its own writing or it gets nothing.

---

## 1. Show HN

Read the [Show HN guidelines](https://news.ycombinator.com/showhn.html) again
before posting. Plain description, zero marketing tone, no superlatives.

### Title

```
Show HN: An API that sells sensor readings to software agents for $0.001 a call
```

Alternatives if that reads long:

```
Show HN: A pay-per-call API where the customer is an autonomous agent
Show HN: HTTP 402 in practice – an API that only serves paid requests
```

Rejected on purpose: anything with "revolutionary", "the future of", or a
question mark. HN punishes all three.

### First comment — post immediately after submitting

> I built this to answer a question about my own traffic: roughly fifteen out of
> sixteen visits to the sites I work on are automated. They read things, they
> cost money to serve, and none of them can pay, because paying assumes a human
> with a card.
>
> This is a working end-to-end version of the alternative. A Cloudflare Worker
> sells simulated sensor readings and small model inferences. An unpaid request
> gets `402` with machine-readable terms. A Node agent discovers the seller
> through an A2A Agent Card, presents a signed spending mandate, pays over x402
> on Base Sepolia, and gets the data. No account, no API key, no prior
> relationship between the two sides.
>
> **Stack:** Cloudflare Workers + Hono, a Durable Object for the simulated
> device, KV for replay keys and receipts, x402 with the `exact` scheme
> (EIP-3009). The buyer needs no gas — the facilitator submits and pays, which is
> what makes tenth-of-a-cent pricing arithmetically possible.
>
> **What I would most like feedback on:** the authorization layer. The buyer
> carries a signed mandate (max per call, daily cap, expiry) and the seller
> verifies it before payment — `401` if the signature does not recover or the
> mandate holder is not the account paying, `403` if it is expired or the price
> is out of scope. I could not find a specification that requires binding the
> mandate holder to the payer, but without it a mandate is a bearer token that
> works for anyone who copies it out of a request log. I would like to know if I
> have missed a standard that handles this.
>
> **Known limitations, all in the repo's limitations list:**
>
> - The Agent Card is unsigned. Discovery trusts TLS and nothing else. A2A v1.0
>   specifies signed cards; I have not implemented them.
> - The replay key is written after settlement confirms, so there is a small
>   window where a crash could allow reuse. The on-chain nonce is a second
>   barrier, but my layer alone does not close it.
> - The "daily" cap counts per UTC calendar day, so an agent running across
>   midnight can spend up to twice it in 24 hours. I found that by running it for
>   an hour across midnight and reading the ledger.
> - No automated test suite yet. Every check is a script run by hand.
>
> Three bugs I hit are written up in the build log, and they share a shape worth
> naming: in this stack, wrong looks like working. The seller read the payment
> proof from the wrong header for a week — payments settled perfectly while replay
> protection and rate limiting silently never ran. Nothing threw an exception.
>
> Testnet only, deliberately, for the whole project. Code is MIT.
>
> Repo: https://github.com/Soresta/x402-iot-poc
> Live demo: https://x402-iot-poc.akifk-x402-26.workers.dev

**Why this comment leads with limitations.** HN finds them anyway. Finding them
yourself first is the difference between a thread about your work and a thread
about your overclaiming.

---

## 2. Reddit — rewritten per community

Never the same text twice. If a subreddit's rules require flair, a disclosure, or
a self-promotion ratio, follow them exactly or do not post.

### r/webdev — angle: the traffic problem

> **Title:** Fifteen out of sixteen visits to my sites are bots. I spent a month
> building something that lets them pay.
>
> Not a bot-blocking post. The opposite.
>
> I looked at the analytics for the sites I work on: 21,000 automated visits a
> week against 1,400 human ones. The automated ones read content and cost money
> to serve. None of them can pay, because every payment path on the web assumes a
> person with a card at the end.
>
> So I built the other option, using a status code that has been reserved and
> unused since 1997 — `402 Payment Required`. Unpaid request gets `402` plus
> machine-readable terms. The client signs an authorization, retries, and a
> facilitator settles it. Two HTTP requests, no account, no signup.
>
> The whole seller is a Cloudflare Worker on the free tier. Writing it up because
> the part that surprised me was how much of the work is *not* the payment — it
> is deciding who the caller is and whether it is allowed to buy, before you take
> any money.
>
> Testnet only, MIT, and the limitations are in the README rather than hidden:
> [repo link]
>
> Happy to answer anything about the implementation. I'm the author.

### r/selfhosted — angle: it costs nothing to run

> **Title:** Metering your self-hosted API for machine clients, on a free tier
>
> If you self-host anything with a public endpoint, some share of your traffic is
> already automated. I wanted to know what it would take to charge for that
> instead of blocking it, without running payment infrastructure.
>
> Turns out: a Worker, a KV namespace, and about 200 lines. The seller never
> touches a blockchain node and holds no keys for anyone. A third-party
> facilitator verifies the payment and submits the transaction; the client pays
> no gas either, which is what makes per-call pricing at fractions of a cent
> workable.
>
> Things I would tell my past self:
>
> - fail closed. If the facilitator is slow and you return `200`, you are giving
>   away paid resources to anyone patient enough to wait for a bad minute.
> - the payment proof is a bearer credential. Hash it, store the hash, reject
>   repeats. There is no application-layer nonce in the protocol.
> - test that each control *fires*, not that payments succeed. Mine passed while
>   two controls silently never ran.
>
> Testnet only. MIT. [repo link]

---

## 3. Cross-link triangle

The DoD asks for three URLs that each link the other two.

| Asset | Links to |
|---|---|
| Live demo | tutorial · readiness board |
| Tutorial | live demo · readiness board |
| Readiness board | live demo · tutorial |

**Done:** the demo page footer now links the tutorial and the readiness board.
**Not done:** the tutorial and the board are not published anywhere public yet,
so two thirds of the triangle currently point at files in a GitHub repo rather
than at destinations on company property. That is a real link, not a placeholder,
but it is not the triangle the DoD describes and it does not produce the backlinks
the KPI counts.

---

## 4. Launch log — fill as you go

One row per post. Interest score after 48 h:
`3×replies + 2×saves + 5×signups + 8×checkout starts + 20×purchases − 10×warnings`

| Channel | URL | Posted (UTC) | Replies | Saves | Signups | Warnings | Score | Top question |
|---|---|---|---|---|---|---|---|---|
| Hacker News | | | | | | | | |
| r/webdev | | | | | | | | |
| r/selfhosted | | | | | | | | |
| dev.to #1 | | | | | | | | |
| dev.to #2 | | | | | | | | |
| X thread #1 | | | | | | | | |
| X thread #2 | | | | | | | | |

**Empty because nothing has been posted.** These stay empty until they are
measured; they do not get filled with estimates.

## 5. Daily metrics log

Pull our own numbers with one request:

```powershell
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/metrics/daily"
```

Returns visits by source, settlements by resource, volume, distinct payers and
cumulative subscribers — with its own caveats attached, including that visit
counts are a floor because KV has no atomic increment.

| Date | Visits | Top source | Settlements | Distinct payers | Subscribers |
|---|---:|---|---:|---:|---:|
| | | | | | |

Numbers we cannot see ourselves — site analytics, ebook sales, Watch trials —
come from the manager's exports and go in a separate column when they arrive.

---

## 6. FAQ — from anticipated questions

**These are predicted, not collected.** The DoD asks for an FAQ built from real
questions; there are none yet. When the posts go out, replace every entry that no
one actually asked and add the ones they did.

**Is this real money?**
No. Base Sepolia testnet, for the entire project. The tokens come from a faucet
and are worth nothing. Real-value settlement is a legal decision that has not
been made, and nothing here is wired for it.

**Why not just use Stripe?**
For a human buying once, use Stripe. This is for a caller with no account, no
card, and no patience for a signup — at a tenth of a cent, where card fees are
larger than the payment. ACP is where consumer agentic commerce is actually
happening; these are different markets.

**What stops someone replaying a payment?**
A SHA-256 of the payment proof is stored as an idempotency key for 24 hours, and
a repeat gets `402 payment_already_used`. There is a window between settlement
and that write; the on-chain nonce is an independent second barrier.

**What if the facilitator goes down?**
`503` with `Retry-After`, and nothing is served. Tested by pointing it at a dead
port.

**Can the agent overspend?**
It has a per-call limit, a daily cap checked before payment, and a kill switch.
The seller verifies the mandate too, so a compromised buyer cannot simply skip
its own check. The cap counts per UTC day rather than a rolling 24 hours, which
is in the limitations list.

**Why is the seller a Cloudflare Worker?**
No servers, no key custody, and it runs on the free tier. An hour of continuous
buying — 111 settlements — cost nothing but faucet tokens.

---

## Pre-flight checklist

- [ ] Manager approved every piece of copy (⚑ GATE)
- [ ] Live demo confirmed working within the hour before the first post
- [ ] Every link UTM-tagged and clicked once to confirm it resolves
- [ ] `/api/metrics/daily` returning sane numbers before traffic arrives
- [ ] Each subreddit's rules read, in full, that day
- [ ] Calendar cleared to answer comments for the day of each post
