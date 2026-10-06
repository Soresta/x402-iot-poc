# Week 2 — Pick the use-case, prove the rails

**Dates:** 20–24 July 2026 (deliverables dated 27–28 July) · **Status after the programme:** 5 of 6 tasks done

The use-case was chosen (an autonomous sensor-data market) and the first x402
payment settled on Base Sepolia, first against a local server and then against the
public Worker.

## Tasks

| Task | Definition of done | Result | Where |
|---|---|---|---|
| IoT use-case one-pager ⚑ | Manager sign-off (Milestone 1) | ✅ Delivered; sign-off pending | [`use-case-one-pager.pdf`](./use-case-one-pager.pdf) |
| "Hello-402" spike | curl transcript + explorer link in README; second call returns data + receipt | ✅ Done 27–28 July | [`hello-402-report.pdf`](./hello-402-report.pdf) · [`../evidence/week2-402-transcript.txt`](../evidence/week2-402-transcript.txt) · README |
| Channel #1 goes live | 2 posts live, UTM-tagged, scored | ❌ Blocked: the book posts never arrived | [`../OPEN-ITEMS.md`](../OPEN-ITEMS.md) (E1, E2) |
| Audience map ⚑ | 30 companies + 15 communities | ✅ Done: 50 rows after trimming the long tail (36 companies, 14 communities) | Kept private — see note |
| Build-in-public post #1 (draft) ⚑ | 600–900 word draft to the manager | ✅ Delivered | [`../content/post-1-build-in-public.md`](../content/post-1-build-in-public.md) |
| Friday demo #2 | The live testnet payment demonstrated | ✅ Held online | — |

## The first payments

| # | Endpoint | Transaction |
|---|---|---|
| 1 | Local (`wrangler dev`) | [`0xe18db476…4d1f3`](https://sepolia.basescan.org/tx/0xe18db4768d05030511485080ad850270b49e8a00df7965470a27ae2b93f4d1f3) |
| 2 | Public Worker | [`0xc5b68a95…3e92ff`](https://sepolia.basescan.org/tx/0xc5b68a953aa2ff89162a46c4a378d8c5fe35e3b86f77cf32dfbb4c2b403e92ff) |

The report walks through the exchange with screenshots: the unpaid `402` with its
`PAYMENT-REQUIRED` header, the same URL served to a browser, the signed retry, the
`200` with a settlement object, and the public endpoint behind Cloudflare. It also
records the problems hit along the way. One example: keystrokes pasted into the
terminal running `wrangler dev` triggered its single-key shortcuts and stopped the
server. The fix was to run every test from a second terminal.

## Kept out of this public repository

| Item | Why |
|---|---|
| Audience map (sheet and page) | It names individual people and their roles. The outreach rubric that uses it is in [`../content/outreach-wave-1.md`](../content/outreach-wave-1.md) |
| PDF of post #1 | Same text as the markdown draft linked above |
