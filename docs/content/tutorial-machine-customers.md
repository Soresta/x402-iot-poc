# Flagship tutorial — Build an API that sells to software

**W5 GTM ⚑ GATE** · target: soft.house
**Status: complete draft.** Every code block is taken from working code in
`github.com/Soresta/x402-iot-poc`, which was running when this was written.
**Not yet re-run on a clean machine** — that check is the last thing before
hand-in, and it is listed at the end.

Estimated reading time 15 minutes. Estimated time to a working payment: 20.

---

## Machine customers

Look at your server logs. On the sites this was written for, machine traffic
outnumbers human traffic fifteen to one — 21,000 automated visits a week against
1,400 people. That ratio is not unusual any more, and it is getting worse in the
direction you would expect.

Every one of those automated visits wants something. It reads a page, calls an
endpoint, scrapes a dataset. It costs you bandwidth and compute. And it pays you
nothing, not because it is unwilling, but because there is no way for it to pay.
It has no credit card. It cannot complete a signup form. It will not wait for
you to approve an API key. The entire payment infrastructure of the web assumes
a human with a wallet at the end of it.

There is now a way around that, and it is smaller than you would expect: an HTTP
status code that has been reserved and unused since 1997. `402 Payment
Required`. This tutorial builds a working API that answers `402` with
machine-readable terms, accepts payment from a piece of software that has never
seen it before, and delivers the goods — in about twenty minutes, on a free
tier, with no blockchain node and no server.

---

## What you will have built

Two programs that have no prior relationship:

- A **seller**: a Cloudflare Worker that sells simulated sensor readings for a
  tenth of a cent each, and refuses to serve anyone who has not paid.
- A **buyer**: a Node script that discovers the seller, pays, and consumes the
  data — on its own, in a loop, with a spending limit it cannot exceed.

Everything runs on a testnet. The tokens are free and worth nothing, which is
exactly what you want while learning.

---

## Prerequisites

| What | Why | Cost |
|---|---|---|
| Node 20+ | the buyer runs here | free |
| A Cloudflare account | the seller runs here | free tier |
| Two testnet wallets | one buys, one gets paid | free |
| Test USDC on Base Sepolia | what the buyer spends | free, from a faucet |

Create two accounts in any EVM wallet. Call them **buyer** and **seller**. You
need the buyer's *private key* and the seller's *address*.

> **Use throwaway keys.** Not an account that has ever held real value. The habit
> matters more than the amount.

Fund the buyer with test USDC from the [Circle faucet](https://faucet.circle.com/),
selecting **Base Sepolia**. The buyer does **not** need test ETH — you will see
why in step 7.

Install Wrangler:

```bash
npm install -g wrangler
wrangler login
```

---

## Part 1 — The seller

### Step 1. Create the project

```bash
npm create cloudflare@latest -- my-x402-seller --type=hello-world --ts --no-git --no-deploy
cd my-x402-seller
npm install hono @x402/hono @x402/core @x402/evm @x402/fetch viem dotenv
```

### Step 2. Configure the Worker

Replace `wrangler.jsonc` with this. Put **your seller address** in `PAY_TO`.

```jsonc
{
  "name": "my-x402-seller",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-13",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "PAY_TO": "0xYOUR_SELLER_ADDRESS",
    "FACILITATOR_URL": "https://x402.org/facilitator",
    "PRICE_PER_READING": "$0.001",
    "USDC_ASSET": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "RATE_LIMIT_QUOTA": "10",
    "RATE_LIMIT_WINDOW_S": "60"
  }
}
```

`0x036CbD…CF7e` is USDC on Base Sepolia. `eip155:84532` is that chain's CAIP-2
identifier, which you will see shortly.

### Step 3. The smallest thing that answers 402

`src/index.ts`:

```ts
import { Hono, type MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = new Hono<{ Bindings: any }>();

let payment: MiddlewareHandler | undefined;

app.use("/api/readings", async (c, next) => {
  // Build the middleware INSIDE the handler. See the note below.
  payment ??= paymentMiddleware(
    {
      "GET /api/readings": {
        accepts: {
          scheme: "exact",
          price: c.env.PRICE_PER_READING,
          network: "eip155:84532",
          payTo: c.env.PAY_TO,
        },
        description: "One simulated sensor reading",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(
      new HTTPFacilitatorClient({ url: c.env.FACILITATOR_URL })
    ).register("eip155:84532", new ExactEvmScheme())
  );
  return payment(c, next);
});

app.get("/api/readings", (c) =>
  c.json({
    device_id: "sim-sensor-01",
    temperature_c: Number((18 + Math.random() * 6).toFixed(2)),
    ts: new Date().toISOString(),
    note: "TESTNET — no real value",
  })
);

export default app;
```

> **Gotcha that will cost you an afternoon.** The payment middleware must be
> constructed *inside* the request handler. At module scope, Workers restricts
> the cryptographic APIs it needs and you get an error that does not mention
> payments at all. The `??=` memoises it after the first request.

### Step 4. See the 402

```bash
npx wrangler dev
```

In another terminal:

```bash
curl -i http://127.0.0.1:8787/api/readings
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVk...

{}
```

That header is base64 JSON. Decode it and you get the terms — scheme, network,
amount in atomic units, asset, and who to pay:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xYOUR_SELLER_ADDRESS"
  }]
}
```

`1000` is atomic units: USDC has six decimals, so this is $0.001.

**That is the whole seller side of the protocol.** Everything after this is
hardening.

---

## Part 2 — The buyer

### Step 5. Configure it

`.env` — and add `.env` to `.gitignore` before you write a key into it:

```
BUYER_PRIVATE_KEY=0xYOUR_TESTNET_BUYER_KEY
SELLER_URL=http://127.0.0.1:8787
```

### Step 6. Buy something

`buyer/pay.mjs`:

```js
import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

const paidFetch = wrapFetchWithPayment(fetch, client);

const res = await paidFetch(`${process.env.SELLER_URL}/api/readings`);
console.log("status:", res.status);
console.log("body:", await res.json());

const header = res.headers.get("payment-response");
if (header) {
  const settled = decodePaymentResponseHeader(header);
  console.log("explorer: https://sepolia.basescan.org/tx/" + settled.transaction);
}
```

```bash
node buyer/pay.mjs
```

```text
status: 200
body: { device_id: 'sim-sensor-01', temperature_c: 21.4, ts: '...', note: 'TESTNET — no real value' }
explorer: https://sepolia.basescan.org/tx/0x79dfd1fb69ccec50afcdbb33a54014e8953405d928ad6d3451a5dcdcb4d2226a
```

Open that link. There is a real transfer on a real chain, from your buyer to
your seller, that no human authorized.

### Step 7. Why the buyer needed no gas

`wrapFetchWithPayment` did four things: made the request, read the `402`, signed
an **EIP-3009 `transferWithAuthorization`**, and retried with the signature in a
`payment-signature` header.

EIP-3009 is what makes tenth-of-a-cent pricing possible. The buyer signs an
authorization; the **facilitator** submits the transaction and pays the gas. A
buyer with zero ETH can still pay. If the buyer had to cover gas, per-call
micropayments would not be worth the arithmetic.

> **Gotcha, and it is a nasty one.** Two generations of x402 packages are in
> circulation. The older one uses `network: "base-sepolia"` and sends the proof
> in `X-PAYMENT`. The current scoped `@x402/*` family uses CAIP-2
> (`eip155:84532`) and sends `payment-signature`. Mix them and it fails
> **silently**. In the reference project, a seller that read only `X-PAYMENT`
> kept settling payments perfectly while its replay protection and rate limiter
> never ran once — for a week. Write code that accepts both names:
>
> ```ts
> const proof =
>   c.req.header("payment-signature") ??
>   c.req.header("X-PAYMENT");
> ```

---

## Part 3 — Hardening

A demo takes payments. A payment system refuses the wrong ones. Three things
separate them.

### Step 8. Replay protection

A signed payment proof is a **bearer credential**. Anyone who sees it can send it
again. Security research on x402 in 2026 names this explicitly: there is no
application-layer nonce, so you must supply one.

Use the proof itself as an idempotency key. Add a KV namespace:

```bash
npx wrangler kv namespace create IOT_KV
```

```jsonc
"kv_namespaces": [{ "binding": "IOT_KV", "id": "PASTE_THE_ID" }]
```

```ts
async function rejectReplay(c: any) {
  const proof = c.req.header("payment-signature") ?? c.req.header("X-PAYMENT");
  if (!proof || !c.env.IOT_KV) return null;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proof));
  const key = "idem:" + Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  if (await c.env.IOT_KV.get(key) !== null) {
    return c.json({ error: "payment_already_used", docs_url: DOCS_URL }, 402);
  }
  await c.env.IOT_KV.put(key, "1", { expirationTtl: 86400 });
  return null;
}
```

Call it at the top of your route handler:

```ts
app.get("/api/readings", async (c) => {
  const replay = await rejectReplay(c);
  if (replay) return replay;
  return c.json({ /* the reading */ });
});
```

Now replay the same proof and you get `402 payment_already_used` with no data.

> **Be honest about the residual risk.** The key is written *after* settlement
> confirms. If the Worker dies in between, the same proof could be reused. The
> on-chain nonce is an independent second barrier, so the practical risk is
> small — but do not tell people this window does not exist.

### Step 9. Fail closed

The facilitator is a third party, and one day it will be slow. Decide now what
happens then. There is only one acceptable answer: **serve nothing**.

```ts
try {
  return await payment(c, next);
} catch {
  return new Response(
    JSON.stringify({ error: "facilitator_error", docs_url: DOCS_URL }),
    { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "5" } }
  );
}
```

Test it by pointing `FACILITATOR_URL` at a dead port. You must get `503` and no
data. A `200` here means you are giving away paid resources whenever a third
party has a bad minute.

### Step 10. Rate limiting, and a structured error contract

A per-payer sliding window in KV, checked **before** you call the facilitator —
rejecting a flood should not cost you a settlement each time.

Give every failure a machine-readable code, because your customers are programs:

| Status | Meaning | Example code |
|---|---|---|
| `401` | we cannot establish who you are | `identity_unverified` |
| `402` | payment needed, or wrong | `payment_already_used` |
| `403` | you are known, but not authorized | `mandate_expired` |
| `429` | too many requests | `rate_limit_exceeded` |
| `503` | we could not verify, so we serve nothing | `facilitator_error` |

```json
{ "error": "payment_already_used", "docs_url": "https://example.com/docs#errors" }
```

A program cannot read your apology. It can branch on a code.

---

## Part 4 — Letting it run on its own

### Step 11. A mandate, and why the seller must check it

Give the buyer a signed statement of what it may spend:

```js
const body = {
  buyer: account.address,
  seller: SELLER_URL,
  max_per_call: 0.002,
  daily_cap: 0.05,
  expiry: new Date(Date.now() + 24 * 3600e3).toISOString(),
  nonce: crypto.randomUUID(),
};
const signature = await account.signMessage({ message: JSON.stringify(body) });
```

The buyer sends it as `X-Agent-Mandate` (base64 of `{body, signature}`), and the
**seller verifies it**. Checking it only on the buyer is an honour system: a
compromised agent skips its own check and you never find out.

Two checks matter most:

```ts
// Is the signer who the mandate says?
const recovered = await recoverMessageAddress({ message: JSON.stringify(body), signature });
if (recovered.toLowerCase() !== body.buyer.toLowerCase()) return reject(401, "identity_unverified");

// Is the mandate holder the one actually paying?
if (payer && payer.toLowerCase() !== body.buyer.toLowerCase()) return reject(401, "identity_mismatch");
```

The second is four lines and no specification asks for it. Without it a mandate
is a bearer token: valid signature, valid expiry, and usable by anyone who
copies it out of a request log.

### Step 12. A budget cap and a kill switch

An autonomous spender without both is a bug, not a feature.

```js
const spentToday = readLedgerTotalForToday();
if (spentToday + price > DAILY_CAP) {
  console.log("DAILY CAP REACHED. Stopping.");
  return "cap_reached";
}
if (process.env.BUYER_ENABLED === "false") return "killed";
```

Check the cap **before** paying, not after. And note what this cap actually is:
it counts per UTC calendar day, so an agent running across midnight can spend up
to twice it in 24 hours. That was found by running an agent for an hour across
midnight and reading the ledger — not by reasoning about the code.

---

## What it costs

Free, at this scale. Workers, KV and Durable Objects all have free tiers that
comfortably cover a demo. The reference project ran a full hour of continuous
buying — 111 settlements — and the only thing consumed was testnet USDC, which
is free from a faucet.

The interesting number is the other one: **$0.001 per call, with no account, no
invoice and no human in the loop**. Whether that is a business depends entirely
on your traffic mix — and if fifteen out of sixteen of your visitors are machines,
it is worth an afternoon to find out.

---

## Where to go next

- **Add a second resource.** The reference project sells sensor readings *and*
  model inferences on the same rail at different prices. Once the gate is a
  reusable middleware, a second product is a config object.
- **Sign your Agent Card.** Discovery over plain HTTPS means TLS is your only
  guarantee. A2A v1.0 specifies signed cards; the reference project has not
  implemented them, and says so.
- **Read the attacks.** Three 2026 papers document real x402 attack classes.
  Read them before you put anything of value behind this.

Full working code, MIT licensed:
**github.com/Soresta/x402-iot-poc**

---

> **Building this for real?**
> soft.house builds and operates agent-facing infrastructure — payment rails,
> discovery, and the boring hardening that decides whether a demo becomes a
> product. If you want a second pair of eyes on your machine-payments plan,
> [get in touch](https://soft.house).

---

## Before hand-in — the quality bar this draft has not yet cleared

The brief's standard is *copy-paste runnable from scratch, tested on a clean
machine*. Outstanding:

- [ ] Run every block start to finish on a machine that has never had this repo
      on it, from an empty directory.
- [ ] Confirm `npm create cloudflare@latest` still scaffolds the shape step 1
      assumes.
- [ ] Confirm the faucet flow still works and note how long funding takes.
- [ ] Time the whole thing. If it exceeds 20 minutes, say so in the intro rather
      than trimming the truth.
- [ ] Have someone who has not seen it try it, and fix every place they stall.
- [ ] Manager review of the soft.house CTA wording.
