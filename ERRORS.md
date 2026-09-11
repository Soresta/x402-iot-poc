# Error Contract — x402-iot-poc

All error responses follow the structured format:

```json
{
  "error": "<machine_readable_code>",
  "docs_url": "https://github.com/Soresta/x402-iot-poc#errors"
}
```

---

## Error Codes

| Code | HTTP Status | Meaning | Remedy |
|------|------------|---------|--------|
| `identity_unverified` | 401 | Mandate signature does not recover to the address it names | Sign the mandate with the key that owns `body.buyer` |
| `identity_mismatch` | 401 | The mandate holder is not the account funding the payment | Present your own mandate, not someone else's |
| `mandate_required` | 403 | No mandate presented and `REQUIRE_MANDATE` is on | Send `X-Agent-Mandate` with a signed mandate |
| `mandate_malformed` | 403 | Mandate could not be decoded, or is missing required fields | Base64-encode `{ body, signature }` with all fields present |
| `mandate_expired` | 403 | The mandate's `expiry` has passed | Issue a fresh mandate |
| `mandate_invalid_caps` | 403 | `max_per_call` or `daily_cap` is zero or negative | Use positive caps |
| `mandate_scope_exceeded` | 403 | The resource costs more than the mandate's `max_per_call` | Raise the cap or buy something cheaper |
| `payment_required` | 402 | No payment proof provided | Include a valid `payment-signature` header as per the x402 protocol |
| `payment_amount_invalid` | 402 | Authorized amount below the required price | Use the price specified in the `402` requirements payload |
| `payment_network_invalid` | 402 | Payment on the wrong network or wrong asset | Use Base Sepolia (`eip155:84532`) with USDC |
| `payment_recipient_invalid` | 402 | Authorization pays an address other than `PAY_TO` | Use the `payTo` from the `402` requirements payload |
| `payment_already_used` | 402 | Replay detected — this payment proof was already used | Obtain a fresh payment authorization |
| `facilitator_timeout` | 503 | Facilitator did not respond within 8 seconds | Retry after the indicated `Retry-After` interval |
| `facilitator_error` | 503 | Unexpected error communicating with the facilitator | Retry; if persistent, check facilitator URL |
| `rate_limit_exceeded` | 429 | Too many requests from this payer, or from this IP, within the window | Wait for the `Retry-After` interval. Two buckets: per payer (`RATE_LIMIT_QUOTA`) and per IP (`IP_RATE_LIMIT_QUOTA`) |
| `device_twin_error` | 503 | Durable Object failed to return a reading | Retry; the DO self-heals on the next tick |
| `kv_unavailable` | 503 | KV namespace not reachable | Infrastructure issue; retry later |
| `mandate_wrong_seller` | 403 | The mandate authorizes spending with a different seller | Present a mandate whose `seller` is this origin |
| `inference_unavailable` | 503 | The Workers AI binding is not configured | Infrastructure issue; retry after `Retry-After` |
| `inference_failed` | 503 | The model run failed | Retry. **You were not charged** — the middleware does not settle a failed response |
| `inference_input_required` | 400 | `?text=` missing or blank on `/api/inference` | Send text to classify. Refused **before** the `402`, so you are never asked to sign for it |
| `inference_input_too_long` | 400 | `?text=` longer than 512 characters | Shorten it. Refused before the `402`; the text is not silently truncated |
| `unknown_resource` | 404 | `/api/negotiate` was asked about a resource that is not for sale | Use a resource id from the Agent Card |
| `offer_invalid` | 400 | `?offer=` was not a non-negative number | Send a numeric offer |
| `subscribe_malformed` | 400 | The subscribe body could not be parsed | Send JSON or form-encoded `{ email, consent }` |
| `subscribe_invalid_email` | 400 | The address failed a basic shape check | Check the address |
| `subscribe_consent_required` | 400 | The consent box was not ticked | Consent is required; there is no silent opt-in |
| `export_not_configured` | 503 | `EXPORT_TOKEN` is not set on the Worker | Set it with `npx wrangler secret put EXPORT_TOKEN`. **Failing closed is deliberate** — an unguarded export is an email list published to the internet |
| `export_unauthorized` | 401 | Wrong or missing export token | Supply the correct `?token=` |

---

## Notes

### Three layers, three status codes

Requests are judged in a fixed order, and each layer has its own code:

```
429  rate limit      — too many requests from this payer
401  identity        — we cannot establish who this agent is
403  mandate         — identity is fine, but this purchase is not authorized
402  payment         — identity and authorization are fine; now show the money
503  upstream        — we could not verify a payment, so we serve nothing
```

Identity and authorization are checked **before** payment, so an agent that is
not who it claims to be, or is not allowed to buy this, is turned away before
any money moves.

The mandate travels in the `X-Agent-Mandate` request header as base64 of
`{ body, signature }`, where `signature` is an EIP-191 signature over
`JSON.stringify(body)`. It is verified statelessly on every request — the seller
stores no buyer policy. `REQUIRE_MANDATE` (default `false`) controls whether a
request with no mandate at all is rejected; when off, a mandate is still fully
verified whenever one is presented.

### Which layer emits what

`payment_amount_invalid`, `payment_network_invalid` and
`payment_recipient_invalid` come from a pre-settlement screen in
`src/index.ts` that decodes the proof and refuses structurally wrong payments
before the facilitator is contacted. The screen only ever **rejects** — anything
it passes still goes to the facilitator for real verification, so the
fail-closed guarantee is unaffected.

A payment that is well-formed but fails verification on-chain (bad signature,
insufficient balance, expired authorization) is refused by the x402 middleware
itself, which answers `402` with the requirements payload and an empty JSON
body. Those cases do not carry one of the codes above.

### Payment header name

The installed x402 generation (`@x402/core` v2) sends the signed proof in the
`payment-signature` request header. An older generation used `X-PAYMENT`. The
seller accepts both; keying on `X-PAYMENT` alone silently disables idempotency
and rate limiting against current clients.

### A failed response is never charged

The x402 middleware verifies the payment, runs the handler, and settles **only if
the handler returned a status below 400**. So `device_twin_error`,
`inference_failed` and every other `4xx`/`5xx` from a paid route arrive without a
charge. Verified on-chain on 2026-09-11: two paid requests against a deliberately
broken device returned `503`, and the buyer's balance was unchanged.

An earlier version of this file said the opposite. It was wrong.

### `payment_already_used` without a charge

The replay key is written inside the handler, which runs before settlement. If
the handler or settlement then fails, the key exists but nothing was charged, and
resending that same proof returns `payment_already_used`. Nothing was spent; sign
a fresh authorization. The x402 client does this automatically on the next
`402`.

### General

- Every `503` response includes a `Retry-After` header with the recommended wait time in seconds.
- Every `402` response includes the full x402 payment requirements payload in the `PAYMENT-REQUIRED` header.
- The `402 payment_already_used` code means the **exact same payment signature** was already accepted. This is the replay-protection mechanism (idempotency key = SHA-256 of the payment header, TTL 24 h).
