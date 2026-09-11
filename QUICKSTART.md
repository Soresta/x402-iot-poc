# Pay this API in 5 minutes

You are going to make a piece of software buy something. No account, no API key,
no signup form. Testnet, so it costs nothing real.

If it takes you longer than five minutes, that is a bug in this page — please
[open an issue](https://github.com/Soresta/x402-iot-poc/issues) saying where you
stalled. That feedback is more useful to us than the payment.

---

## What you need

- **Node 20+**
- **A throwaway EVM wallet.** Not one that has ever held real value.
- **About 60 seconds at a faucet.**

## 1 · Get a wallet and some test USDC

Create a new account in any EVM wallet and copy its **private key**.

Fund it with test USDC on **Base Sepolia**:
[faucet.circle.com](https://faucet.circle.com/) → select *Base Sepolia* → paste
your address.

You do **not** need test ETH. The facilitator submits the transaction and pays
the gas, so your wallet needs no gas of its own. That is the trick that makes
tenth-of-a-cent payments possible at all.

## 2 · Clone and install

```bash
git clone https://github.com/Soresta/x402-iot-poc.git
cd x402-iot-poc
npm install
```

## 3 · Point it at the live seller

Create a `.env` file:

```
BUYER_PRIVATE_KEY=0xYOUR_TESTNET_KEY
SELLER_URL=https://x402-iot-poc.akifk-x402-26.workers.dev
```

## 4 · Buy something

```bash
node buyer/pay.mjs
```

Expected:

```text
buyer: 0xYOUR_ADDRESS
status: 200
body: {
  seq: 1834,
  device_id: 'sim-sensor-01',
  temperature_c: 21.4,
  humidity_pct: 58.2,
  ts: '2026-09-08T...',
  note: 'TESTNET — no real value'
}
explorer: https://sepolia.basescan.org/tx/0x...
```

Open that explorer link. There is a real USDC transfer on a real chain that no
human approved.

## 5 · See yourself on the board

```
https://x402-iot-poc.akifk-x402-26.workers.dev
```

Your wallet appears in **Who is paying**, marked `external` — the demo's own
wallets are marked `ours`, so you can tell the difference between real adoption
and us buying from ourselves.

**That's it. You paid an API.**

---

## Want the loop instead of one purchase?

```bash
node buyer/agent.mjs
```

This runs an autonomous agent: it discovers the seller through its Agent Card,
carries a signed spending mandate, buys from every resource it can afford, and
logs each purchase. It has a daily cap and a kill switch (`BUYER_ENABLED=false`),
because an autonomous thing that spends money without both is a bug.

There are two things on sale, at different prices:

| Resource | Price | What you get |
|---|---:|---|
| `/api/readings` | $0.001 | one simulated sensor reading |
| `/api/inference` | $0.002 | one sentiment classification |

The price gap is deliberate. A mandate authorized for $0.001 readings gets
`403 mandate_scope_exceeded` when it reaches for the $0.002 compute — try it by
setting `MAX_PER_CALL=0.001`.

---

## Troubleshooting

**`ECONNREFUSED 127.0.0.1:8787`** — `SELLER_URL` is not set, so it defaulted to
localhost. Set it in `.env` as in step 3.

**`402` and it never retries** — check the wallet actually received test USDC.
The faucet can take a minute.

**`429 rate_limit_exceeded`** — 10 requests per minute per wallet. Wait a minute.

**`403 mandate_scope_exceeded`** — your mandate's `max_per_call` is below the
price of what you asked for. That is the authorization layer working.

**Nothing happens for a long time** — settlement goes through a third-party
facilitator to a public testnet. A few seconds is normal.

---

## What is actually happening

1. Your script requests the resource. The server answers **`402 Payment
   Required`** with machine-readable terms in a header.
2. Your script signs an **EIP-3009** authorization for the exact amount.
3. It retries with the signature in a `payment-signature` header.
4. The server checks it has not seen that proof before, sends it to a
   facilitator, and the facilitator settles it on Base Sepolia.
5. Only then do you get the data.

Two HTTP requests. The status code has been in the spec, unused, since 1997.

## Before you build on this

Read the [limitations](./README.md#known-gotchas--things-that-cost-real-time-here)
first. Short version: the Agent Card is unsigned, and nobody outside this project
has paid it yet — so if you do, you are the first.

Three 2026 papers document real attacks on x402 implementations. They are worth
reading before you put anything of value behind this.

**Testnet only. No real value. MIT licensed.**
