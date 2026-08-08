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
| `payment_required` | 402 | No payment header provided | Include a valid `X-PAYMENT` header as per the x402 protocol |
| `payment_amount_invalid` | 402 | Payment amount below the required price | Use the price specified in the `402` requirements payload |
| `payment_network_invalid` | 402 | Payment on wrong network or wrong asset | Use Base Sepolia (`eip155:84532`) with USDC |
| `payment_already_used` | 402 | Replay detected — this payment proof was already used | Obtain a fresh payment authorization |
| `facilitator_timeout` | 503 | Facilitator did not respond within 8 seconds | Retry after the indicated `Retry-After` interval |
| `facilitator_error` | 503 | Unexpected error communicating with the facilitator | Retry; if persistent, check facilitator URL |
| `rate_limit_exceeded` | 429 | Too many requests from this buyer within the time window | Wait for the `Retry-After` interval |
| `device_twin_error` | 503 | Durable Object failed to return a reading | Retry; the DO self-heals on the next tick |
| `kv_unavailable` | 503 | KV namespace not reachable | Infrastructure issue; retry later |

---

## Notes

- Every `503` response includes a `Retry-After` header with the recommended wait time in seconds.
- Every `402` response includes the full x402 payment requirements payload in the `Payment-Required` header.
- The `402 payment_already_used` code means the **exact same payment signature** was already accepted. This is the replay-protection mechanism (idempotency key = SHA-256 of the payment header, TTL 24 h).
