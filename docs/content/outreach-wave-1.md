# B2B outreach wave #1 — founding cohort (W6)

**⚑ GATE — manager review before a single message is sent.**
**Status: NOTHING SENT.** 0 of 15. No replies, no briefings booked.

This document is the template, the targeting rubric and the CRM shape. It does
**not** contain a list of named people, and that is deliberate — see below.

---

## What I have not done, and why

The DoD is "15 sent, CRM updated". I have not assembled the list of 15 named
individuals at named companies.

Two reasons, both worth stating plainly rather than working around:

1. **The house rule is public business information only, no personal data
   scraping.** Compiling a table of named individuals, their roles and their
   contact details — from an agent session, at speed — is exactly the activity
   that rule exists to prevent. The rubric below is how to build that list; the
   building of it is a person's job, with the manager's sign-off.
2. **≥70% of every message must be custom to the recipient.** A message written
   without having read what that company actually shipped is the 30% with nothing
   attached to it. The hook cannot be generated in advance; if you cannot write a
   true, specific observation about them, the rule says do not send.

What follows is everything except the names.

---

## Targeting rubric

Pull from the W2 audience map. Prioritise in this order:

1. **Anyone who engaged with the launch.** They already know the work. This is
   the highest-yield group and the reason outreach rides launch week rather than
   preceding it.
2. **Companies publishing about agentic payments** — a blog post, a spec
   contribution, a conference talk. Public, recent, and it gives you the hook.
3. **Infrastructure adjacent to the problem**: IoT platforms, API vendors, agent
   tooling, paytech. Segment each one; the briefing is different for each.
4. **Ecosystem participants**: x402/A2A contributors, Cloudflare developer
   community, facilitator operators.

**Disqualify** if: you cannot write a true specific observation about them; they
have no public business contact route; the only route in is a named individual's
personal address.

### Segment → what the briefing is actually about

| Segment | The question they have | What we can honestly tell them |
|---|---|---|
| IoT platform | "Could our devices sell their own data?" | The device twin works; the hard part is authorization, not payment |
| API vendor | "Is per-call machine pricing real?" | Yes, at a tenth of a cent, on a free tier — with three named failure modes |
| Agent tooling | "How do agents pay for things safely?" | Mandates, caps, kill switches, and the bearer-token problem nobody specifies |
| Paytech | "Where does this sit against ACP?" | Different markets. We will say so rather than pitch against them |

---

## The message skeleton

Four parts, in this order, ≥70% custom.

**1. Hook — theirs, not ours.** One specific true observation about their
product, announcement or problem. *If you cannot write this line, do not send the
message.* Not "I love what you're building". Something that proves you read it.

**2. Who we are, one sentence.**
> I'm building a public machine-payments PoC with the team at Pragma.Vision — we
> track how ready this space actually is.

**3. The offer.** A free 20-minute readiness briefing for their sector. Useful
whether or not they ever pay us. Not a demo of our thing; a readiness assessment
of their thing.

**4. Easy out.** One line, no pressure, no follow-up threat.

### Worked example — the shape, with the hook left blank

> Subject: 20-minute readiness briefing — agent payments in <their sector>
>
> Hi <name>,
>
> <HOOK: one specific, true, recent observation about their product or
> announcement. This is the part that must be written after reading their work,
> not before.>
>
> I'm building a public machine-payments PoC with the team at Pragma.Vision — we
> track how ready this space actually is. Everything is open source and testnet,
> and the findings are unflattering where they should be: three papers this year
> document real attacks on the protocol we use, and our own build turned up two
> security controls that were silently not running for a week.
>
> If it is useful, I can put 20 minutes together on what agent payments would
> actually require in <their sector> — what works today, what does not, and what
> I would not build on yet. No pitch, and useful whether or not we ever work
> together.
>
> If this is not relevant, just say so and I will not follow up.
>
> <name>
> <repo link> · <demo link>

**Never in these messages:** "guarantee", "indemnify", SLA language, or any
outcome promise. Our own prices do not appear.

---

## Rules

- Business contacts only.
- ≥70% custom per message.
- **Maximum 3 touches, then stop.** Respect is the brand.
- Log everything in the CRM the same day.
- The manager attends any call that gets booked.
- Never promise outcomes.

## CRM shape

| Company | Segment | Person + role | Channel | Why them (one line) | Warm path | Sent | Replied | Booked | Next action | Date |
|---|---|---|---|---|---|---|---|---|---|---|

Empty. 0 sent, 0 replied, 0 booked, against a DoD target of 15 sent, ≥3 replies
and ≥1 briefing booked.

---

## The 10-slide readiness deck (W7 dependency)

Outline only; the deck is a Week 7 deliverable but the outreach promises it, so
it is sketched here.

1. What changed — machine traffic is the majority, and it cannot pay
2. The four protocols and what each is for (x402 · AP2 · A2A · ACP)
3. Readiness scores, from the research board — with the low ones kept in
4. Security posture — the 2026 attack papers, named
5. Regulatory posture — GENIUS Act, MiCA, and what stays undecided
6. What this means for **their** sector specifically
7. What a first experiment costs (a free tier and an afternoon)
8. What we would not build on yet — unsigned discovery, agent spending controls
9. How ongoing monitoring works — the Watch subscription
10. The offer

**Honest scores only.** A briefing that concludes "this is not ready for you yet"
wins more trust than a pitch, and it is the only version of this deck that
survives someone checking it.
