import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
console.log("buyer:", account.address);

const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

const paidFetch = wrapFetchWithPayment(fetch, client);

const res = await paidFetch(process.env.RESOURCE_URL, { method: "GET" });
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