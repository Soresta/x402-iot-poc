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
| `payment_required` | 402 | No payment proof provided | Include a valid `payment-signature` header as per the x402 protocol |
| `payment_amount_invalid` | 402 | Authorized amount below the required price | Use the price specified in the `402` requirements payload |
| `payment_network_invalid` | 402 | Payment on the wrong network or wrong asset | Use Base Sepolia (`eip155:84532`) with USDC |
| `payment_recipient_invalid` | 402 | Authorization pays an address other than `PAY_TO` | Use the `payTo` from the `402` requirements payload |
| `payment_already_used` | 402 | Replay detected — this payment proof was already used | Obtain a fresh payment authorization |
| `facilitator_timeout` | 503 | Facilitator did not respond within 8 seconds | Retry after the indicated `Retry-After` interval |
| `facilitator_error` | 503 | Unexpected error communicating with the facilitator | Retry; if persistent, check facilitator URL |
| `rate_limit_exceeded` | 429 | Too many requests from this buyer within the time window | Wait for the `Retry-After` interval |
| `device_twin_error` | 503 | Durable Object failed to return a reading | Retry; the DO self-heals on the next tick |
| `kv_unavailable` | 503 | KV namespace not reachable | Infrastructure issue; retry later |

---

## Notes

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

### General

- Every `503` response includes a `Retry-After` header with the recommended wait time in seconds.
- Every `402` response includes the full x402 payment requirements payload in the `PAYMENT-REQUIRED` header.
- The `402 payment_already_used` code means the **exact same payment signature** was already accepted. This is the replay-protection mechanism (idempotency key = SHA-256 of the payment header, TTL 24 h).
