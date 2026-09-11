/**
 * card-verify.mjs — verify a signed Agent Card against a PINNED public key.
 *
 * The buyer-side twin of src/card-signing.ts. It is a separate plain-JS copy so
 * the buyer keeps running on Node 20 without a TypeScript step. Two copies of a
 * signature algorithm is exactly the kind of thing that drifts silently, so a
 * test (test/regressions.spec.ts, "A4") signs with the seller's code and
 * verifies with this one. If they ever disagree, that test goes red.
 *
 * Why pinned, not fetched: the card's `jku` points at the seller's own domain.
 * Fetching the key from there proves only what TLS already proved. A key
 * obtained out of band — here, SELLER_CARD_PUBLIC_JWK in .env — is what makes a
 * signature mean "this is the seller I intended", not just "this is the domain I
 * connected to".
 */

const encoder = new TextEncoder();

/** RFC 8785 JCS — see src/card-signing.ts for why this form is conformant. */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("JCS: non-finite numbers cannot be canonicalized");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  }
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function thumbprint(jwk) {
  const members = canonicalize({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(members))));
}

/**
 * @returns {Promise<{ok: true, kid: string} | {ok: false, reason: string}>}
 */
export async function verifyCard(card, trustedPublicJwk) {
  if (!Array.isArray(card?.signatures) || card.signatures.length === 0) {
    return { ok: false, reason: "card_unsigned" };
  }

  const pub = { kty: trustedPublicJwk.kty, crv: trustedPublicJwk.crv, x: trustedPublicJwk.x, y: trustedPublicJwk.y };
  const key = await crypto.subtle.importKey("jwk", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const expectedKid = await thumbprint(pub);

  const { signatures, ...unsigned } = card;
  const payloadB64 = base64url(encoder.encode(canonicalize(unsigned)));

  for (const s of signatures) {
    let header;
    try {
      header = JSON.parse(new TextDecoder().decode(base64urlToBytes(String(s.protected))));
    } catch {
      continue;
    }
    if (header?.alg !== "ES256" || header?.kid !== expectedKid) continue;
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64urlToBytes(String(s.signature)),
      encoder.encode(`${s.protected}.${payloadB64}`)
    );
    if (valid) return { ok: true, kid: expectedKid };
  }
  return { ok: false, reason: "card_signature_invalid" };
}
