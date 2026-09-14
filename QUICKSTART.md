# Pay this API in 5 minutes

You are going to make a piece of software buy something. No account, no API key,
no signup form. Testnet, so it costs nothing real.

Five minutes once you have a funded testnet wallet; allow ten more if you are
creating one for the first time (step 1). If it takes you longer than that, it is a
bug in this page — please
[open an issue](https://github.com/Soresta/x402-iot-poc/issues) saying where you
stalled. That feedback is more useful to us than the payment.

---

## What you need

- **Node 20+** — check with `node -v`
- **MetaMask** (or any EVM wallet). Never used one? Step 1 walks through it.
- **About 5 minutes for the wallet and the faucet.** It is the slowest part, and
  you only do it once.

## 1 · Get a wallet, test USDC and the private key

The steps below use the **MetaMask browser extension**. Button names change
between MetaMask versions; if one is not where described, the linked MetaMask help
page has the current wording.

> **Use a throwaway account.** If you already keep real funds in MetaMask, create a
> separate account for this (1a). Better still, use a separate browser profile
> with a brand-new wallet. The private key you export in 1e controls that account
> completely. It goes into one file on your machine, `.env`, and nowhere else:
> not a chat, not a screenshot, not a commit. `.env` is gitignored in this repo.

### 1a · Create an account

No MetaMask yet: install it from [metamask.io](https://metamask.io/download/),
choose **Create a new wallet**, set a password and store the Secret Recovery
Phrase somewhere safe. The account it creates is the one you will use.

Already have MetaMask: open the **account selector** at the top →
**Add account or hardware wallet** → **+ Ethereum account** → name it, e.g.
`x402-test` → **Add account**.
([MetaMask help](https://support.metamask.io/configure/accounts/how-to-add-accounts-in-your-wallet/))

### 1b · Copy your address

Click the account name at the top to copy its **address**: `0x` followed by 40
characters. The address is public and safe to share. It is **not** the private key.

### 1c · Get test USDC

1. Open [faucet.circle.com](https://faucet.circle.com/). No account is needed.
2. Choose **USDC**, and **Base Sepolia** as the network.
3. Paste your address and request the tokens.

You get 20 test USDC, and you can request again every 2 hours. This project
charges $0.001 a call, so one request lasts a long time.

**You do not need test ETH.** The facilitator submits the transaction and pays the
gas, so your wallet needs no gas of its own. That is what makes
tenth-of-a-cent payments possible.

### 1d · (Optional) See the USDC in MetaMask

Paying works without this step: the script signs with the key directly, and your
address is the same on every EVM network. Do it if you want to confirm the faucet
delivered.

**Add the network.** Open the menu at the top right → **Networks** →
**Add a custom network**, and enter:

| Field | Value |
|---|---|
| Network name | `Base Sepolia` |
| Default RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Currency symbol | `ETH` |
| Block explorer URL | `https://sepolia.basescan.org` |

Save and switch to it. If MetaMask already lists Base Sepolia under test networks,
turn on **Show test networks** in the same Networks list and pick it instead.
([MetaMask help](https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/))

**Show USDC.** In the token list use **Import tokens** and paste the USDC contract
on Base Sepolia:

```
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

The balance should read 20 USDC.

### 1e · Export the private key

Click the **three dots** next to the account → **Account details** → **Private
key** → enter your MetaMask password → **hold** the reveal button → copy.
([MetaMask help](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/))

It is 64 characters long. MetaMask usually shows it **without** the leading `0x`.
You can paste it either way, because the scripts add the `0x` if it is missing.

Paste it straight into `.env` in step 3, and do not keep it anywhere else.

## 2 · Clone and install

```bash
git clone https://github.com/Soresta/x402-iot-poc.git
cd x402-iot-poc
npm install
```

## 3 · Point it at the live seller

Create a `.env` file in the `x402-iot-poc` folder with **exactly these two lines**:

```
BUYER_PRIVATE_KEY=0xYOUR_TESTNET_KEY
SELLER_URL=https://x402-iot-poc.akifk-x402-26.workers.dev
```

Replace `0xYOUR_TESTNET_KEY` with the private key from 1e, with or without `0x`.
On macOS or Linux, `nano .env` opens an editor in the terminal; on Windows,
`notepad .env`.

Do not start from `.env.example`. It is set up for running your own seller locally,
and its `RESOURCE_URL` line points at `127.0.0.1`.

## 4 · Buy something

```bash
node buyer/pay.mjs
```

Expected:

```text
buyer: 0xYOUR_ADDRESS
resource: https://x402-iot-poc.akifk-x402-26.workers.dev/api/readings
status: 200
body: {
  seq: 1834,
  device_id: 'sim-sensor-01',
  temperature_c: 21.4,
  humidity_pct: 58.2,
  ts: '2026-09-08T...',
  note: 'TESTNET — no real value'
}
settlement: { success: true, transaction: '0x...', network: 'eip155:84532', ... }
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

**`ECONNREFUSED 127.0.0.1:8787`** (or "Nothing is listening at 127.0.0.1") — your
`.env` points at a local server that is not running. Usually it was copied from
`.env.example`. Remove the `RESOURCE_URL` line and set `SELLER_URL` as in step 3.

**`402` and it never retries** — check the wallet actually received test USDC
(step 1d shows how to see it). Also check you requested **Base Sepolia**, not
another network. The faucet can take a minute.

**`BUYER_PRIVATE_KEY does not look like a private key`** — you probably pasted the
**address** (`0x` + 40 characters) instead of the **private key** (64
characters). Go back to step 1e.

**The `buyer:` address printed is not the one you funded** — the key in `.env`
belongs to a different MetaMask account. Export the key from the account you sent
the USDC to.

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

Read the [limitations](./README.md#known-gotchas-things-that-cost-real-time-here)
first. Short version: one person outside this project has paid it so far, and
only because we asked them to test this page. If you find it on your own and pay,
you are the first who did.

Three 2026 papers document real attacks on x402 implementations. They are worth
reading before you put anything of value behind this.

**Testnet only. No real value. MIT licensed.**
