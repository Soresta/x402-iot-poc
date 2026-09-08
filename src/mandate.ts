/**
 * mandate.ts — Seller-side verification of an AP2-style spending mandate.
 *
 * Week 3 shipped mandate checking on the buyer only. That is an honour system:
 * a compromised or buggy agent could exceed its own authorization and the
 * seller would never notice. This module moves the check to the seller, which
 * is where an authorization layer has to live to mean anything.
 *
 * The buyer presents its signed mandate in the `X-Agent-Mandate` request
 * header, base64-encoded. Three layers are then checked in order, and each
 * failure maps to its own status code:
 *
 *   401 identity  — we cannot establish who this agent is, or it is not who it
 *                   claims to be (bad signature, or mandate holder is not the
 *                   account paying)
 *   403 mandate   — identity is fine, but the mandate does not authorize this
 *                   request (expired, malformed, price outside scope)
 *   402 payment   — identity and authorization are fine; now show the money
 *
 * Verification is stateless and cheap: one signature recovery, no storage.
 * The seller deliberately stores no buyer policy — it verifies what it is
 * shown and forgets it.
 */

import { recoverMessageAddress } from "viem";

export interface MandateBody {
  buyer: string;
  seller: string;
  max_per_call: number;
  daily_cap: number;
  currency: string;
  expiry: string;
  nonce: string;
}

export interface SignedMandate {
  body: MandateBody;
  signature: `0x${string}`;
}

/** A rejection carries the status the caller should return, plus the code. */
export interface MandateRejection {
  ok: false;
  status: 401 | 403;
  error: string;
}

export interface MandateAcceptance {
  ok: true;
  mandate: SignedMandate;
}

export type MandateResult = MandateAcceptance | MandateRejection;

/** Compare sellers by origin, so a trailing slash or a path does not matter. */
function normaliseOrigin(value: string): string | null {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

const reject = (status: 401 | 403, error: string): MandateRejection => ({
  ok: false,
  status,
  error,
});

/** Decode a base64 / base64url mandate header. Returns null if unreadable. */
export function decodeMandateHeader(header: string): SignedMandate | null {
  try {
    const json = atob(header.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json);
    if (!parsed?.body || !parsed?.signature) return null;
    return parsed as SignedMandate;
  } catch {
    return null;
  }
}

/**
 * Verify a presented mandate against this request.
 *
 * @param header    raw `X-Agent-Mandate` header value
 * @param priceUsdc the price being charged, e.g. 0.001
 * @param payerAddress the address funding the payment, when one is present.
 *        If given, the mandate holder must match it — otherwise anyone could
 *        wave someone else's valid mandate around.
 * @param expectedSeller this seller's own origin, when known. A mandate names
 *        the seller it authorizes spending with; without checking it, a mandate
 *        written for one seller is spendable at any other seller that accepts
 *        the same format.
 */
export async function verifyPresentedMandate(
  header: string,
  priceUsdc: number,
  payerAddress?: string | null,
  expectedSeller?: string | null
): Promise<MandateResult> {
  const mandate = decodeMandateHeader(header);
  if (!mandate) return reject(403, "mandate_malformed");

  const { body, signature } = mandate;

  if (
    typeof body.buyer !== "string" ||
    typeof body.expiry !== "string" ||
    typeof body.max_per_call !== "number" ||
    typeof body.daily_cap !== "number"
  ) {
    return reject(403, "mandate_malformed");
  }

  // --- Layer 1: identity -----------------------------------------------
  // Who signed this? If we cannot answer, nothing downstream is meaningful.
  let recovered: string;
  try {
    recovered = await recoverMessageAddress({
      message: JSON.stringify(body),
      signature,
    });
  } catch {
    return reject(401, "identity_unverified");
  }

  if (recovered.toLowerCase() !== body.buyer.toLowerCase()) {
    return reject(401, "identity_unverified");
  }

  // The mandate holder must be the account actually paying. Without this,
  // a valid mandate is a bearer token anyone can copy out of a request log.
  if (payerAddress && payerAddress.toLowerCase() !== body.buyer.toLowerCase()) {
    return reject(401, "identity_mismatch");
  }

  // --- Layer 2: authorization ------------------------------------------
  const expiryMs = Date.parse(body.expiry);
  if (Number.isNaN(expiryMs) || Date.now() >= expiryMs) {
    return reject(403, "mandate_expired");
  }

  if (body.max_per_call <= 0 || body.daily_cap <= 0) {
    return reject(403, "mandate_invalid_caps");
  }

  if (priceUsdc > body.max_per_call) {
    return reject(403, "mandate_scope_exceeded");
  }

  // A mandate authorizes spending with a named seller. Accepting one addressed
  // to somebody else means a mandate issued for a cheap API is spendable at an
  // expensive one, which is not what its issuer agreed to.
  if (expectedSeller && typeof body.seller === "string" && body.seller) {
    const named = normaliseOrigin(body.seller);
    const mine = normaliseOrigin(expectedSeller);
    if (named && mine && named !== mine) {
      return reject(403, "mandate_wrong_seller");
    }
  }

  return { ok: true, mandate };
}
