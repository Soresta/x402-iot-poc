# Post #2 — architecture deep-dive (draft)

**Owed from:** W3 GTM · **Publishes:** W4 publish wave #1
**Target:** dev.to, cross-posted as an X thread
**Status:** DRAFT — not published. Manager review required before it goes live.
**Length:** ~1100 words
**Required by the brief:** sequence diagram · the three-layer story
(identity → mandate → settlement) · what broke and why.

---

## Title

`Three status codes, in this order: 401, 403, 402`

*(Alternative: "How to let software buy from your API without trusting it")*

---

## Body

I built an API that sells sensor readings to autonomous agents for a tenth of a
cent each. The interesting part turned out not to be the payment. It was
everything that has to happen before the payment, and the order it happens in.

Disclosure: I work with the team at Pragma.Vision and this is a project for
them. The code is MIT-licensed.

### The exchange

```
Buyer                          Seller (Cloudflare Worker)
  │
  │  GET /.well-known/agent-card.json
  ├─────────────────────────────────────►  who I am, what I sell, the price
  │  ◄─────────────────────────────────────
  │
  │  GET /api/readings  + X-Agent-Mandate
  ├─────────────────────────────────────►  verify identity        → 401?
  │                                        verify authorization   → 403?
  │  ◄───────── 402 + payment terms ─────
  │
  │  sign EIP-3009 authorization
  │
  │  GET /api/readings  + payment-signature
  ├─────────────────────────────────────►  replay check (KV)
  │                                        verify + settle ──► facilitator ──► chain
  │  ◄───────── 200 + the reading ───────  receipt + live event
```

Two round trips. No account, no API key, no prior relationship. The buyer had
never seen this seller before it fetched the card.

### Three layers, and why the order matters

Most API auth collapses into one question: *are you allowed?* Agent payments
split it into three, and each one deserves its own status code.

**Identity — 401.** Who is this? The buyer presents a signed mandate naming an
address. I recover the signature. If it doesn't match the address it claims, that
is a `401`, and nothing downstream is meaningful.

**Authorization — 403.** This agent is who it says. Is it *allowed to buy this*?
The mandate carries `max_per_call`, `daily_cap` and an `expiry`. Expired mandate,
or a resource that costs more than the mandate permits: `403`. No payment is
attempted.

**Settlement — 402.** Identity and authorization are fine. Now show the money.

Ordering matters because each layer is more expensive than the one above it. A
`401` costs one signature recovery. A `402` costs a blockchain settlement. Do
them in the wrong order and you're paying to reject requests you could have
refused for free.

### The mistake I want you to avoid

Here's what my first version got wrong, and it took a proper second look to find.

I checked the mandate **on the buyer**. The agent verified its own mandate before
every purchase, refused to exceed its own cap, and stopped cleanly when the
mandate expired. Every test passed. The logs were beautiful.

It was an honour system. A compromised or simply buggy agent skips the check, and
the seller — which is the party with something to lose — has no idea. I had built
an authorization layer that only worked when nobody was attacking it.

Moving verification to the seller is maybe forty lines. Once it was there, a
second problem appeared immediately: **a mandate is a bearer token.** It's a
signed document. It's in the request. Anyone who sees a request log has a valid
mandate — signature checks out, expiry is fine, and now they can spend under
someone else's authorization.

The fix is one comparison: the address in the mandate must equal the address
funding the payment.

```ts
if (payerAddress.toLowerCase() !== body.buyer.toLowerCase()) {
  return reject(401, "identity_mismatch");
}
```

Four lines. No specification I read told me to write them.

### The bug that taught me the most

My seller read the payment proof from the `X-PAYMENT` header. The x402 library I
was using sends it as `payment-signature` — the name changed between package
generations.

Payments settled perfectly. Buyers got their data. The demo page streamed
transactions. Nothing errored, anywhere.

But two controls keyed on that header — replay protection and rate limiting —
were never running. The idempotency key was never written. The rate limiter never
counted a request. For a week, in production.

Worse: my replay test *passed*. It sent a payment, replayed it, got a `402`,
printed PASS. But the rejection was coming from the blockchain refusing a reused
EIP-3009 authorization, not from the protection I thought I was testing. Right
answer, wrong reason — the least useful kind of green check.

Two lessons I'd pass on to anyone integrating a payment protocol:

1. **Test that each control fires, not that payments succeed.** Those are
   different assertions. Mine only ever checked the second.
2. **In this stack, the failure mode is silence.** No exception, no 500, no
   warning. A security control that isn't running looks exactly like one that is.

### What settlement actually costs

The buyer needs no gas. EIP-3009's `transferWithAuthorization` lets it sign an
authorization that the facilitator submits and pays for. That's what makes a
tenth of a cent viable — the transaction fee isn't the buyer's problem.

The seller side is a Cloudflare Worker, a Durable Object for the simulated
device, and KV for replay keys and receipts. It runs on the free tier. Cost is
not the barrier here, which surprised me.

### What I still haven't solved

**The Agent Card isn't signed.** My buyer fetches a JSON document over HTTPS and
believes the price in it. TLS says the document came from that domain. It doesn't
say the domain is who the buyer thinks. A2A v1.0 specifies signed cards; I
haven't implemented them.

**When does settlement actually happen?** I got this backwards for weeks. The
x402 middleware verifies the payment, runs my handler, and settles only if the
handler succeeded. So a broken device never charges anyone — I checked against
the chain — and my replay key is written *before* money moves, not after. The
real side effect is smaller and the other way round: a proof whose request fails
is already recorded, so resending it gets "already used" although nothing was
spent.

**The daily cap used to reset at UTC midnight.** It counted per calendar day, so
an agent running across midnight could spend twice its cap in 24 hours. I found
it by running the agent for an hour across midnight and reading the ledger, and
it is now a rolling window with a regression test pinning the exact case.

All three are in the repo's known-limitations list, because a limitations
section that only contains things you've already fixed isn't a limitations
section.

### Try it

Code: **github.com/Soresta/x402-iot-poc** — MIT, free tier, testnet only.

There's a live demo streaming settlements as they happen. Every row links to the
block explorer.

If you've hit different failure modes on x402 or A2A, tell me. The silent ones
are the ones worth trading.

---

## Pre-publication checklist

- [ ] Manager review (⚑ GATE)
- [ ] Code snippet re-tested against the current `main`
- [ ] UTM tags on both links
- [ ] Live demo confirmed working within the hour before posting
- [ ] Interest score logged after 48 h

## Notes on the writing

The brief asked for the sequence diagram, the three-layer story, and what broke.
All three are here, and the "what broke" section is the longest — deliberately.
Two real bugs are described with enough detail that a reader can check whether
they have the same one. No hype adjectives, no guarantees, no claims about
outcomes. Prices for our own products do not appear.
