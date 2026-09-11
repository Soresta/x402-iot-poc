# Post #3 — the numbers post (draft)

**W7 GTM ⚑ GATE** · DoD: draft to manager
**Status: DRAFT, NOT PUBLISHED.**
**Length:** ~900 words

The brief asks for "N days of agents paying my testnet API — real numbers + what
broke". Below are the real numbers. They are smaller than this genre of post
usually contains, and the reason is in the post itself.

---

## Title

`189 payments, 0 customers: five weeks of building an API for machines`

*(Alternative: "What five weeks of machine payments actually looks like")*

---

## Body

I have been building an API that sells to software instead of people. Here is
every number I have, including the one that matters most and reads zero.

Disclosure: I work with the team at Pragma.Vision. The code is MIT.

### The numbers

| | |
|---|---|
| Total settlements | **189** |
| Total volume | **$0.191** in testnet USDC |
| Days with activity | **5** |
| Longest unattended run | **1 hour** — 111 settlements, 98.2% success |
| Distinct paying wallets | **1** |
| **External paying wallets** | **0** |
| Infrastructure cost | **$0** |
| Automated tests | **72** — written after the bugs below, and checked by putting each bug back |

The number that decides whether any of this is interesting is the sixth one.
Every payment this API has ever taken came from a wallet I own. I built a thing
that sells, and then I bought from myself 189 times.

That is not a failure of the technology. It is a failure to have shown it to
anyone, and those are different problems with different fixes.

### Why zero, specifically

The posts that would have brought people here are written. Two long articles, two
X threads, a Show HN with its first comment, subreddit posts rewritten per
community. All drafted, all sitting in the repo, none published — they need a
review that has not happened.

So the funnel is complete and empty. Instrumentation, consent-first email
capture, a page that shows exactly which wallets are ours and which are not. All
of it wired to a top that nobody has walked through.

I could have written this post about the 189. It reads better. It would also be
the same mistake this project keeps catching itself making: reporting the shape
of success rather than checking the value.

### What actually broke

Four bugs. All four shared one property, which is the finding I would keep if I
had to throw the rest away.

**1. The seller read the wrong header.** The x402 library renamed the payment
proof header between package generations — `X-PAYMENT` became
`payment-signature`. My seller read the old name.

Payments settled perfectly. Buyers got their data. Nothing errored. But two
security controls keyed on that header — replay protection and rate limiting —
never ran. Not once, for a week, in production.

My replay test passed the whole time. It sent a payment, replayed it, got a
`402`, printed PASS. The rejection was coming from the blockchain refusing a
reused authorization, not from the protection I thought I was testing. Right
answer, wrong reason.

**2. The spending mandate was an honour system.** The buyer carried a signed
mandate — spending limit, daily cap, expiry — and checked it before every
purchase. Every test passed.

The seller never checked it. A compromised or simply buggy agent skips its own
check, and the party with something to lose finds out never. Moving verification
to the seller took about forty lines.

**3. A mandate is a bearer token.** Once the seller was checking mandates, a
second problem appeared: a mandate is a signed document sitting in a request.
Anyone who reads a request log has a valid one. Signature checks out, expiry is
fine, and now they spend under someone else's authorization.

The fix is one comparison — the address in the mandate must equal the address
funding the payment. Four lines. No specification I read asks for them.

**4. The classifier reported the least likely answer.** I added a second product,
a sentiment classification. "This settlement rail is surprisingly pleasant" came
back `NEGATIVE` with a confidence of 0.0002.

The model returns one entry per class in a fixed order, not sorted by confidence.
I took the first one. Status 200, correct field names, well-formed JSON, wrong
answer every time.

### The pattern

Every one of those four looked like working software. No exception, no 500, no
log line. A security control that is not running looks exactly like one that is.
A classifier reporting the wrong class returns the same shape as one reporting
the right one.

If you build on this stack, the lesson I would pass on is: **test that each
control fires, not that requests succeed.** Those are different assertions, and
for five weeks I was only ever checking the second.

### What I still have not solved

- The Agent Card can now be signed (A2A v1.0's JWS format) and the buyer verifies
  it against a pinned key — but the key has not been generated yet, so today the
  live card is still unsigned.
- **My rate limiter didn't work, and every test said it did.** It passed the
  sequential test — request 11 got a 429 — from week 3 onward. I finally fired 30
  requests at once: all 30 got through a quota of 10. KV reads and writes aren't
  atomic. It counts in a Durable Object now, and the same burst lets exactly 10
  through.
- **A mistake in my own limitations list.** For six weeks this list said a failed
  request could still charge the buyer, and that the replay key was written after
  settlement. Both were backwards: the payment middleware only settles a
  successful response, and our replay check runs before it. I had the evidence in
  week 3 — no settlement header on the failed response — and read it the wrong
  way. Checked against the chain this time: two paid requests to a broken device,
  buyer balance unchanged.
- **The tests came last.** For five weeks every check was a script I ran by hand,
  and four bugs got through all of them. The suite that exists now is one test per
  bug that shipped — which is the right suite, built in the wrong week.

### What it costs

Nothing. The seller — payment gate, replay protection, rate limiting, receipts,
live demo, a second AI-backed product — runs entirely on free-tier Cloudflare.
An hour of continuous buying cost faucet tokens and no infrastructure.

Cost is not the barrier to trying this. Showing it to anyone is.

### If you want to be wallet number two

Five minutes, no signup, testnet:
**github.com/Soresta/x402-iot-poc/blob/main/QUICKSTART.md**

Your wallet shows up on the demo page marked `external`, next to mine marked
`ours`, because a project that counts its own purchases as adoption is lying to
itself in public.

---

## Notes on this draft

Every figure is measured, not estimated: settlement counts from the receipt log
and the buyer's ledger, the hour-long run from `docs/week5/soak-run.log`, the
external payer count from `/api/payers`, which computes it by excluding
configured own-wallets rather than by eye.

The post leads with a zero. That is the point of it. The brief asks for real
numbers and what broke; the honest version of this project's numbers at week
seven is "the machine works and nobody has seen it", and a post that buried that
under 189 settlements would be the same overclaiming this project has spent five
weeks catching in itself.

**Publication note:** if the launch happens before this posts, the numbers
change and this draft must be re-measured, not adjusted. Do not publish these
figures at a later date without re-running them.
