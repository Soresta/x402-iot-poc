# Publish wave #1 — distribution assets (draft)

**W4 GTM · ⚑ GATE — manager review required before anything goes live.**
**Status: NOT PUBLISHED.** Nothing in this file has been posted anywhere. There
are no live links, no interest scores and no referral traffic to report, because
no post has gone out.

Contents: two X threads (one per article), the ecosystem-directory submission,
the UTM scheme, and the post-publication checklist.

---

## 1. X thread — post #1 (build in public)

Nine posts. Each stands alone; the thread reads as one argument.

> **1/**
> 15 out of every 16 visits to the sites I work on are not human.
>
> 21,000 machine visits a week. 1,400 human ones.
>
> Every machine visit reads something, costs something to serve, and pays
> nothing — because there's no way for it to pay.

> **2/**
> I'm spending 9 weeks building the thing that closes that gap, in public.
>
> Disclosure: I work with the team at Pragma.Vision. The code is mine and it's
> MIT.

> **3/**
> HTTP has had a status code reserved for this since 1997.
>
> 402 Payment Required.
>
> Unused for nearly 30 years, because there was never a payment method a machine
> could use without a human in the loop.

> **4/**
> That changed quietly.
>
> Server answers an unpaid request with 402 + machine-readable terms.
> Client signs an authorization, retries.
> A facilitator settles it.
>
> Two HTTP requests. No account. No API key. No prior relationship.

> **5/**
> First time I watched a script get a 402, sign something, retry, and receive
> data it had paid for:
>
> under 3 seconds, a tenth of a cent, nobody approved anything.
>
> That's the part that reframes it.

> **6/**
> What I'm building: a simulated sensor that sells its own readings, and an
> autonomous agent that buys them.
>
> Hard daily cap. Kill switch. An autonomous thing that spends money without
> both is a bug, not a feature.

> **7/**
> Last week, before the interesting part even started:
>
> my seller was reading the payment proof from the wrong HTTP header. The
> library renamed it between versions.
>
> Payments settled fine. Two security controls silently never ran. Not once.

> **8/**
> My tests passed — because they sent the same wrong header the server was
> reading.
>
> Nothing was on fire. Everything looked healthy.
>
> In this stack the failure mode is silence, not an error.

> **9/**
> Code, live demo, every transaction checkable on a block explorer:
>
> github.com/Soresta/x402-iot-poc
>
> Testnet only, on purpose, for all 9 weeks.
>
> If you've built on x402/AP2/A2A — what broke for you?

---

## 2. X thread — post #2 (architecture)

Eight posts.

> **1/**
> I built an API that sells sensor readings to autonomous agents for a tenth of
> a cent.
>
> The interesting part wasn't the payment. It was everything that has to happen
> before it, and the order.

> **2/**
> Three layers, three status codes:
>
> 401 — who is this?
> 403 — is it allowed to buy this?
> 402 — now show the money.
>
> In that order.

> **3/**
> Order matters because each layer costs more than the one above.
>
> A 401 costs one signature recovery.
> A 402 costs a blockchain settlement.
>
> Wrong order = paying to reject requests you could refuse for free.

> **4/**
> My first version checked the spending mandate *on the buyer*.
>
> Every test passed. Logs were beautiful.
>
> It was an honour system. A compromised agent just skips the check, and the
> seller — the party with something to lose — never knows.

> **5/**
> Moving the check to the seller surfaced a second problem immediately:
>
> a mandate is a bearer token.
>
> It's signed, and it's in the request. Anyone with a request log has a valid
> one.

> **6/**
> Fix is one comparison — the address in the mandate must equal the address
> funding the payment.
>
> Four lines. No spec I read told me to write them.

> **7/**
> Still unsolved, and in the repo's limitations list:
>
> · my Agent Card isn't signed
> · a gap between settling and recording the replay key
> · the "daily" cap resets at UTC midnight, so an agent crossing midnight can
>   spend 2× its cap

> **8/**
> Code + live demo: github.com/Soresta/x402-iot-poc
>
> MIT, free tier, testnet only.
>
> If you've hit different failure modes on x402 or A2A, I want them. The silent
> ones especially.

---

## 3. Ecosystem directory submission

For the x402 ecosystem directory and relevant awesome-lists, submitted by PR.

**Name:** x402-iot-poc

**One line:** An autonomous IoT sensor agent that sells its readings per call
over x402, with seller-side mandate verification and replay protection.

**Category:** Demos / reference implementations

**Description (60 words):**
> A working end-to-end machine-to-machine payment loop on Base Sepolia. A
> Cloudflare Worker sells simulated sensor readings for $0.001 per call; an
> autonomous Node agent discovers it via an A2A Agent Card, presents a signed
> spending mandate, pays via x402, and logs every settlement. Includes
> seller-side identity/mandate checks (401/403), KV replay protection and a live
> demo. MIT, testnet only.

**Links:** repo · live demo · Agent Card

**Submission rules to respect:**
- One PR per list, following that list's contribution guide exactly.
- Alphabetical placement if the list is ordered.
- No marketing adjectives in the entry — every list rejects them.
- Do not submit to a list where the project doesn't genuinely fit.

---

## 4. UTM scheme

Lowercase, consistent, no spaces. Full naming sheet is a W5 deliverable; this is
the subset publish wave #1 needs.

```
utm_source   = devto | x | hn | reddit | directory
utm_medium   = post | thread | comment | listing
utm_campaign = w4-publish-wave-1
utm_content  = post-1 | post-2 | demo-link | repo-link
```

Example:
```
https://x402-iot-poc.akifk-x402-26.workers.dev/?utm_source=devto&utm_medium=post&utm_campaign=w4-publish-wave-1&utm_content=post-2
```

Every public link gets tagged. An untagged link is traffic we cannot attribute,
which for KPI purposes is traffic that did not happen.

---

## 5. Post-publication checklist

Run per channel, per post:

- [ ] Manager approved the exact copy (⚑ GATE)
- [ ] Live demo confirmed working in the hour before posting
- [ ] Every link UTM-tagged and clicked once to confirm it resolves
- [ ] Posted Tue or Thu morning
- [ ] Stay in the thread all day; reply to every comment within ~2 hours
- [ ] Recurring questions collected for the demo-page FAQ
- [ ] After 48 h: interest score logged in the experiment sheet
      `score = 3×replies + 2×saves + 5×signups + 8×checkout starts + 20×purchases − 10×warnings`
- [ ] Traffic snapshot recorded against the W4 baseline

## 6. What cannot be reported yet

The W4 DoD asks for live links collected and referral traffic visible in the
metrics log. Neither exists: nothing has been published. When these go out, the
numbers get recorded as measured — including if they are zero.
