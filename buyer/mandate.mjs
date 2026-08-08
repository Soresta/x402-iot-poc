/**
 * mandate.mjs — Signed spending mandate for the autonomous buyer agent
 *
 * A mandate is a signed JSON document that authorizes the buyer agent to spend
 * on behalf of the mandate issuer. Verification happens on EVERY iteration,
 * not just startup, to catch expiry mid-run.
 *
 * Signature scheme: EIP-191 personal_sign (viem's signMessage) over the
 * JSON-serialised mandate body. Verification uses recoverMessageAddress.
 * This reuses viem which is already in the dependency tree.
 *
 * Usage:
 *   import { createMandate, verifyMandate } from "./mandate.mjs";
 *   const mandate = await createMandate(account, { ... });
 *   const { valid, reason } = await verifyMandate(mandate);
 */

import { privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";

/**
 * @typedef {Object} MandateBody
 * @property {string} buyer     — buyer address (0x...)
 * @property {string} seller    — seller base URL
 * @property {number} max_per_call — max USDC per single payment
 * @property {number} daily_cap — max USDC per day
 * @property {string} currency  — "USDC"
 * @property {string} expiry    — ISO-8601 UTC expiry timestamp
 * @property {string} nonce     — random hex to prevent replay of the mandate itself
 */

/**
 * @typedef {Object} SignedMandate
 * @property {MandateBody} body
 * @property {string} signature — EIP-191 signature over JSON.stringify(body)
 */

/**
 * Create a signed mandate.
 * @param {import("viem/accounts").PrivateKeyAccount} account
 * @param {MandateBody} body
 * @returns {Promise<SignedMandate>}
 */
export async function createMandate(account, body) {
  const message = JSON.stringify(body);
  const signature = await account.signMessage({ message });
  return { body, signature };
}

/**
 * Verify a signed mandate.
 * Returns { valid: true } or { valid: false, reason: string }.
 *
 * Checks performed:
 *   1. Signature valid (signer matches mandate.body.buyer)
 *   2. Not expired
 *
 * @param {SignedMandate} mandate
 * @returns {Promise<{ valid: boolean; reason?: string }>}
 */
export async function verifyMandate(mandate) {
  if (!mandate || !mandate.body || !mandate.signature) {
    return { valid: false, reason: "mandate_missing_fields" };
  }

  const { body, signature } = mandate;

  // 1. Check expiry first (fast path, no crypto needed)
  const expiryMs = new Date(body.expiry).getTime();
  if (isNaN(expiryMs) || Date.now() >= expiryMs) {
    return { valid: false, reason: "mandate_expired" };
  }

  // 2. Verify signature
  try {
    const message = JSON.stringify(body);
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== body.buyer.toLowerCase()) {
      return {
        valid: false,
        reason: `mandate_signer_mismatch: expected ${body.buyer}, got ${recovered}`,
      };
    }
  } catch (err) {
    return { valid: false, reason: `mandate_signature_error: ${err.message}` };
  }

  // 3. Sanity checks on values
  if (body.max_per_call <= 0 || body.daily_cap <= 0) {
    return { valid: false, reason: "mandate_invalid_caps" };
  }

  return { valid: true };
}

/**
 * Check that the quoted price fits within the mandate's per-call cap.
 * @param {MandateBody} mandateBody
 * @param {number} priceUsdc — e.g. 0.001
 * @returns {{ allowed: boolean; reason?: string }}
 */
export function checkPriceInScope(mandateBody, priceUsdc) {
  if (priceUsdc > mandateBody.max_per_call) {
    return {
      allowed: false,
      reason: `price_exceeds_mandate: ${priceUsdc} > max_per_call ${mandateBody.max_per_call}`,
    };
  }
  return { allowed: true };
}
