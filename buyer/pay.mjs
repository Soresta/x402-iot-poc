import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { readBuyerPrivateKey } from "./buyer-key.mjs";

// RESOURCE_URL wins when set (the Week 2 behaviour). Otherwise buy a reading from
// SELLER_URL, which is what QUICKSTART.md tells people to set. Until 2026-09-14
// this script read RESOURCE_URL only, so the quickstart as written could not work.
// A first-time user found that, stuck on step 4 with ECONNREFUSED 127.0.0.1:8787.
const SELLER_URL = (process.env.SELLER_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const RESOURCE_URL = process.env.RESOURCE_URL || `${SELLER_URL}/api/readings`;

const account = privateKeyToAccount(readBuyerPrivateKey());
console.log("buyer:", account.address);
console.log("resource:", RESOURCE_URL);

const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

const paidFetch = wrapFetchWithPayment(fetch, client);

let res;
try {
  res = await paidFetch(RESOURCE_URL, { method: "GET" });
} catch (err) {
  if (err?.cause?.code === "ECONNREFUSED") {
    const source = process.env.RESOURCE_URL ? "RESOURCE_URL" : "SELLER_URL";
    console.error(
      `\nNothing is listening at ${RESOURCE_URL}.\n` +
        `That address comes from ${source} in your .env. To pay the live seller, set:\n` +
        `  SELLER_URL=https://x402-iot-poc.akifk-x402-26.workers.dev\n` +
        (process.env.RESOURCE_URL ? `and remove the RESOURCE_URL line.\n` : "")
    );
    process.exit(1);
  }
  throw err;
}

console.log("status:", res.status);
console.log("body:", await res.json());

const header = res.headers.get("payment-response");
if (header) {
  const decoded = decodePaymentResponseHeader(header);
  console.log("settlement:", decoded);
  if (decoded?.transaction) {
    console.log("explorer: https://sepolia.basescan.org/tx/" + decoded.transaction);
  }
}
