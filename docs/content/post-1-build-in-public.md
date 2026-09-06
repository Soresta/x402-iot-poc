# Post #1 — build in public (draft)

**Owed from:** W2 GTM · **Publishes:** W4 publish wave #1
**Target:** dev.to, cross-posted as an X thread
**Status:** DRAFT — not published. Manager review required before it goes live.
**Length:** ~780 words
**Affiliation disclosure:** present, second paragraph.

---

## Title

`My API's best customer might not be a person`

*(Alternatives, if the above reads too soft: "I'm building an API that only sells
to robots" · "What happens when software wants to buy from your API")*

---

## Body

Fifteen out of every sixteen visits to the sites I work on are not human.

That is not a complaint about bots. It is a measurement: 21,000 machine visits a
week against 1,400 human ones. Every one of those machine visits reads something,
costs something to serve, and pays nothing — because there is no way for it to
pay. It has no credit card, no account, and no patience for a signup form.

I'm spending nine weeks building something that fixes that specific gap, in
public, and writing down what happens. I work with the team at Pragma.Vision, and
this is their programme — but the code is mine and it's MIT-licensed, so anyone
can take it.

### The thing that made this feel close rather than futuristic

HTTP has had a status code reserved for this since 1997. `402 Payment Required`.
It has sat unused for nearly thirty years, because there was never a payment
method a machine could use without a human in the loop.

That changed quietly. A protocol called x402 fills the code in: your server
answers an unpaid request with `402` and a machine-readable description of what
payment it wants. The client — a piece of software, not a person — signs an
authorization, retries the request, and a facilitator settles the payment. The
whole exchange is two HTTP requests. There is no account, no API key, and no
prior relationship between the two parties.

The first time I watched a script get a `402`, sign something, retry, and receive
data it had paid for, the round trip took under three seconds and cost a tenth of
a cent. Nobody approved anything. That's the part that reframes it.

### What I'm building over eight more weeks

A simulated IoT sensor that sells its own readings, and an autonomous agent that
buys them.

The seller runs on Cloudflare Workers. It publishes a card at a well-known URL
describing what it sells and for how much — so a buyer that has never heard of it
can discover it. Unpaid requests get `402`. Paid requests get a reading.

The buyer is a Node script that finds the seller, checks a signed spending
mandate it carries, pays, records the purchase in a ledger, and repeats. It has a
hard daily cap and a kill switch, because an autonomous thing that spends money
without either of those is a bug rather than a feature.

Everything is on a testnet. The tokens have no real value, deliberately, for the
whole nine weeks.

### What I'll publish, and how honest it'll be

Every week: what I built, what broke, and the numbers. Including the weeks where
the number is zero.

I'd rather show you the failures, because they're where the information is. An
example from last week, before I've even got to the interesting part: my seller
was reading the payment proof from the wrong HTTP header. The library had renamed
it between versions. Payments still settled perfectly — but two security controls
I'd written, replay protection and rate limiting, had silently never run. Not
once. The tests I'd written passed, because they were sending the same wrong
header the server was reading.

Nothing was on fire. Everything looked healthy. That is exactly what makes it
worth writing about: in this stack the failure mode is silence, not an error
message.

### The unknowns, which are the honest part

I don't know whether anyone actually wants this. It's possible that the machine
traffic hitting my sites would rather keep taking things for free, and that the
economics only work for a narrow slice of content.

I don't know whether the security model survives contact with adversaries. Three
papers this year found real attacks on x402 implementations — replay, wallet
drain via overpayment, prompt injection. My mitigations are mine; nobody has
tried to break them.

I don't know whether per-call micropayments beat a monthly subscription for
anyone. Fractions of a cent per request is a genuinely different shape of
business, and different is not automatically better.

Those three questions are what the next eight weeks are for. I'll publish what I
find either way — including if the answer is that this doesn't work yet.

### If you want to follow along

The code is public and runs on a free tier: **github.com/Soresta/x402-iot-poc**

There's a live demo where you can watch settlements arrive as an agent buys
readings. Every transaction links to a block explorer, so you can check that the
payments are real rather than taking my word for it.

If you've built anything on x402, AP2 or A2A, I want to hear what broke for you.
That's most of what I'm collecting right now.

---

## Pre-publication checklist

- [ ] Manager review (⚑ GATE)
- [ ] Every link carries UTM tags per the naming sheet
- [ ] Live demo confirmed working within the hour before posting
- [ ] Interest score logged in the experiment sheet after 48 h
- [ ] Reply to every comment within ~2 hours for the first day

## Notes on the writing

Banned per the house rules and deliberately absent: "guarantee", "revolutionary",
"game-changing", any SLA language, any claim of outcomes. No prices for anything
we sell appear in the post. Affiliation is disclosed in the second paragraph,
before any product mention. The failure story is included because trust is built
by the failures, not the wins — and it is a real failure, not a decorative one.
