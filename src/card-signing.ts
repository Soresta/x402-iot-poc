/**
 * card-signing.ts — sign the Agent Card (open item A4).
 *
 * WHY
 *
 * The buyer discovers this seller by fetching a JSON document and believing the
 * price in it. Until now TLS was the only guarantee that the document came from
 * who the buyer thought — and TLS says "this came from that domain", not "this
 * domain is the seller you meant". The research board scored signed Agent Cards
 * 2 for adoption on the grounds that almost nobody signs them, ours included.
 *
 * WHAT, AND HOW CLOSELY IT FOLLOWS THE SPEC
 *
 * The signature format follows A2A v1.0 §8.4, read from the specification
 * source (a2aproject/A2A docs/specification.md):
 *
 *   - payload: the card with its `signatures` field removed, canonicalized with
 *     JCS (RFC 8785)                                           — §8.4.1
 *   - JWS (RFC 7515), detached: the card is the payload        — §8.4.2
 *   - `signatures: [{ protected, signature }]`, protected header carrying
 *     `alg` = ES256, `typ` = JOSE, `kid`, and `jku`            — §8.4.2
 *
 * NOT claimed: A2A v1.0 schema compliance for the card itself. The card still
 * uses the v0.2.5 shape with a non-standard `payment` extension, and the spec's
 * "remove default-valued fields" step depends on the v1.0 protobuf schema. Our
 * canonicalization signs exactly the fields we serve.
 *
 * KEY TRUST
 *
 * `jku` points at /.well-known/jwks.json on this Worker, as the spec allows. A
 * buyer that fetches the key from the same domain as the card gains nothing TLS
 * did not already give it — whoever controls the domain controls both. So the
 * buyer in this repo verifies against a PINNED public key obtained out of band
 * (SELLER_CARD_PUBLIC_JWK), and `jku` is there for clients with no pinned key.
 *
 * The private key is a Worker secret (AGENT_CARD_SIGNING_KEY, a JWK). Without
 * it the card is served unsigned, and says so.
 */

const encoder = new TextEncoder();

/**
 * RFC 8785 JSON Canonicalization Scheme.
 *
 * RFC 8785 deliberately specifies number and string serialization to match
 * ECMAScript's JSON.stringify, and property order as sorting by UTF-16 code
 * units — which is what Array.prototype.sort does on strings. So a recursive
 * key sort around JSON.stringify is conformant for the value types a card can
 * hold (objects, arrays, strings, finite numbers, booleans, null).
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("JCS: non-finite numbers cannot be canonicalized");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : new Uint8Array(input as ArrayBuffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The public half of an EC JWK — the fields a verifier needs and nothing else. */
export function publicJwk(jwk: JsonWebKey): JsonWebKey {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

/** RFC 7638 JWK thumbprint, used as the `kid`. Deterministic from the key. */
export async function thumbprint(jwk: JsonWebKey): Promise<string> {
  const members = canonicalize({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(members)));
}

/** The bytes that get signed: BASE64URL(protected) '.' BASE64URL(JCS(card − signatures)). */
function signingInput(card: Record<string, unknown>, protectedB64: string): Uint8Array {
  const { signatures: _omit, ...unsigned } = card;
  return encoder.encode(`${protectedB64}.${base64url(canonicalize(unsigned))}`);
}

export interface AgentCardSignature {
  protected: string;
  signature: string;
}

export async function signCard(
  card: Record<string, unknown>,
  privateJwk: JsonWebKey,
  jku?: string
): Promise<Record<string, unknown> & { signatures: AgentCardSignature[] }> {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const header: Record<string, string> = {
    alg: "ES256",
    typ: "JOSE",
    kid: await thumbprint(privateJwk),
  };
  if (jku) header.jku = jku;
  const protectedB64 = base64url(canonicalize(header));

  // WebCrypto returns ECDSA signatures as raw r||s (IEEE P1363), which is
  // exactly the encoding JWS requires for ES256 — no DER conversion needed.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signingInput(card, protectedB64)
  );

  const { signatures: _drop, ...unsigned } = card;
  return { ...unsigned, signatures: [{ protected: protectedB64, signature: base64url(sig) }] };
}

export type CardVerification = { ok: true; kid: string } | { ok: false; reason: string };

/**
 * Verify a card against a public key the caller already trusts.
 * Succeeds if any signature in `signatures` verifies (the spec allows several,
 * for key rotation).
 */
export async function verifyCard(card: any, trustedPublicJwk: JsonWebKey): Promise<CardVerification> {
  if (!Array.isArray(card?.signatures) || card.signatures.length === 0) {
    return { ok: false, reason: "card_unsigned" };
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    publicJwk(trustedPublicJwk),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  const expectedKid = await thumbprint(trustedPublicJwk);

  for (const s of card.signatures) {
    let header: any;
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
      signingInput(card, String(s.protected))
    );
    if (valid) return { ok: true, kid: expectedKid };
  }
  return { ok: false, reason: "card_signature_invalid" };
}
