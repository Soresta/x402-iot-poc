/**
 * generate-card-key.mjs — create the Agent Card signing key without ever
 * displaying the private half.
 *
 * Generates an EC P-256 key pair, pipes the PRIVATE key straight into
 *   npx wrangler secret put AGENT_CARD_SIGNING_KEY
 * over stdin, and prints only the PUBLIC key — for buyers to pin.
 *
 * The private key never touches the terminal, a file, or a shell history. Run
 * this yourself; do not have an agent session run it, for the same reason the
 * EXPORT_TOKEN secret was created by its holder: a secret generated inside a
 * transcript is a secret that lives in the transcript.
 *
 * Re-running ROTATES the key. Every buyer that pinned the old public key will
 * then refuse the card until it pins the new one — which is the pinning working.
 *
 * Usage:
 *   node scripts/generate-card-key.mjs          dry run: explains, changes nothing
 *   node scripts/generate-card-key.mjs --yes    generate, store the secret, print public key
 */

import { spawn } from "node:child_process";

if (!process.argv.includes("--yes")) {
  console.log(`This will:
  1. generate a new EC P-256 signing key
  2. store the private key as the Worker secret AGENT_CARD_SIGNING_KEY
     (via stdin — it is never printed)
  3. print the public key, for buyers to pin as SELLER_CARD_PUBLIC_JWK

If a key already exists, this REPLACES it, and buyers pinning the old key will
refuse the card until they update. Deploy is not needed: secrets apply at once.

Re-run with --yes to proceed.`);
  process.exit(0);
}

const encoder = new TextEncoder();

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };

const digest = await crypto.subtle.digest(
  "SHA-256",
  encoder.encode(canonicalize({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y }))
);
const kid = Buffer.from(digest).toString("base64url");

console.log("Storing the private key as AGENT_CARD_SIGNING_KEY (not displayed)…");

const secretPut = spawn("npx", ["wrangler", "secret", "put", "AGENT_CARD_SIGNING_KEY"], {
  shell: true,
  stdio: ["pipe", "inherit", "inherit"],
});
secretPut.stdin.write(JSON.stringify(privateJwk));
secretPut.stdin.end();

const code = await new Promise((resolve) => secretPut.on("close", resolve));
if (code !== 0) {
  console.error(`\nwrangler secret put exited with ${code}. Nothing was stored; the key was discarded.`);
  process.exit(1);
}

console.log(`
Stored. The card is signed from the next request onward.

Key id (kid): ${kid}

Pin this PUBLIC key in the buyer's .env — it is safe to share:

SELLER_CARD_PUBLIC_JWK=${JSON.stringify(publicJwk)}

Verify it matches what the seller now publishes:
  curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/.well-known/jwks.json`);
