# CFP abstracts and podcast pitch

**W8 GTM** · DoD: 2–3 talk proposals + 1 podcast pitch submitted, listed in the CRM
**Status: DRAFTED, NOT SUBMITTED.** Nothing has been sent, and the CRM rows are
empty. Submission targets need dates checked and the manager's sign-off.

Every abstract links the live demo. A talking demo beats credentials, and this
one has the advantage of being real and checkable during the talk.

---

## Talk 1 — the general audience version

**Title:** Machine customers: what happens when your API's best user isn't human

**Format:** 25–30 min conference talk
**Targets:** local developer conferences, Cloudflare community meetups
**Abstract (148 words):**

> Fifteen out of every sixteen visits to the sites I work on are automated. They
> read content, they cost money to serve, and none of them can pay — because
> every payment path on the web ends at a human with a card.
>
> HTTP has had a status code reserved for this since 1997, unused. This talk is
> what happened when I filled it in: a working API that answers `402 Payment
> Required` with machine-readable terms, and an autonomous agent that discovers
> it, agrees a price, pays on-chain, and consumes the data — with no account, no
> API key, and no prior relationship between the two sides.
>
> I will run it live. I will also show the four bugs that reached production,
> because they share a property worth naming: in this stack, wrong looks like
> working. One of them switched off two security controls for a week while every
> test passed.
>
> Testnet throughout. Free tier throughout. Code is MIT.

**Bio (2 lines):**
> Akif builds machine-payment infrastructure at Pragma.Vision, where the current
> project is a public, open-source proof of concept for agent-to-agent payments.
> He writes up the failures as well as the wins, at github.com/Soresta/x402-iot-poc.

---

## Talk 2 — the security-focused version

**Title:** Your payment proof is a bearer token: what nobody tells you about agent payments

**Format:** 20–25 min, security or protocol track
**Targets:** agent/web3 events, security meetups
**Abstract (151 words):**

> Agent payment protocols are shipping fast. In 2026 alone, three papers
> documented real attacks on x402 implementations, and an assessment of fifteen
> payment facilitators — including the reference one — found violations in every
> single one.
>
> I built a working agent-payment system and then tried to break it. This talk is
> the three things I got wrong, all of which looked correct until tested:
>
> A signed payment proof is a bearer credential with no application-layer nonce.
> A spending mandate checked only on the buyer is an honour system. And a mandate
> without an identity binding works for whoever holds it — the fix is four lines,
> and no specification asks for them.
>
> None of these threw an exception. The system settled payments perfectly
> throughout. If you are building on these protocols, this is the list I wish I
> had started with.

**Why this one is worth submitting:** it is the only version of this talk that
someone else cannot give from a press release. It is grounded in defects from a
specific codebase, with the failing output published.

---

## Talk 3 — the practitioner version

**Title:** Charging for bot traffic: metering an API for machine clients on a free tier

**Format:** 15–20 min lightning / practical track
**Targets:** self-hosting, web performance and API-design tracks
**Abstract (139 words):**

> If you run a public endpoint, some share of your traffic is already automated.
> The usual response is to block it. This talk is about the other option:
> charging for it.
>
> A live walkthrough of a metered API for machine clients — payment gate, replay
> protection, per-caller rate limiting, receipts, and a live settlement feed —
> built on a free tier with no servers, no blockchain node, and no custody of
> anyone's funds or keys.
>
> The practical parts: why the buyer needs no gas, why you must fail closed when
> your payment verifier is slow, and why a "daily" spending cap that counts
> calendar days lets an autonomous agent spend twice its limit by running across
> midnight. I found that one by running an agent for an hour and reading the
> ledger.

---

## Podcast pitch

**Target profile:** developer or infrastructure podcasts covering protocols,
payments or the agent ecosystem. One specific show to be named with the manager
before sending — a pitch to a show I have not listened to is the kind of message
this project's outreach rules exist to prevent.

**Subject:** The API whose best customer isn't a person

> Hi <name>,
>
> <HOOK — one specific, true observation about a recent episode. Written after
> listening, not before. If I cannot write this line, the pitch does not go.>
>
> I have spent nine weeks building a public, open-source API that sells to
> software instead of people — an autonomous agent discovers it, agrees a price,
> pays on-chain, and gets the data, with no account and nobody approving
> anything. It is live, MIT-licensed, and runs on a free tier.
>
> The episode I would want to record is not the launch story. It is what broke:
> four bugs reached production and every one of them looked like working
> software. One switched off two security controls for a week while every test I
> had passed — and passed for the wrong reason, which I think is the more useful
> failure to talk about.
>
> I can also speak to where this ecosystem honestly is: three papers this year
> documented real attacks on the protocol I use, and an assessment found security
> violations in every payment facilitator it evaluated. I am not selling anything
> — the project is a research PoC and it is testnet-only by design.
>
> Happy to send the demo link and a rough episode outline if it is of interest.
> If not, no follow-up.
>
> Akif · github.com/Soresta/x402-iot-poc

---

## Submission tracker

| # | Target | Type | Deadline | Submitted | Response |
|---|---|---|---|---|---|
| 1 | *to be selected with manager* | Talk 1 | | ☐ | |
| 2 | *to be selected with manager* | Talk 2 | | ☐ | |
| 3 | *to be selected with manager* | Talk 3 | | ☐ | |
| 4 | *to be selected with manager* | Podcast | | ☐ | |

**Empty on purpose.** Picking targets means checking live CFP deadlines and, for
the podcast, actually listening to an episode. Both are the manager's call and a
person's afternoon — and submitting to a conference whose CFP closed last month
is the kind of thing that only looks efficient.

## House rules applied

- No outcome promises, no "guarantee", no SLA language.
- Affiliation disclosed in every bio.
- No prices of ours anywhere.
- The security talk names real papers and a real assessment rather than
  gesturing at "concerns".
- Every abstract includes at least one failure. That is the differentiator, not a
  disclaimer.
