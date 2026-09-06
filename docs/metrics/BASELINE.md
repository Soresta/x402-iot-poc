# KPI baseline — as of programme start

Source: the manager's metrics sheets for `pragma.vision` and `soft.house`,
supplied 2026-09-06 as screenshots and transcribed here. This file is the
reference the Week 8 Revenue Impact Memo measures against, so it is recorded
before any of the work it will be used to judge.

Transcribed from an image, not exported from the sheet. If a number here is
wrong, the sheet wins.

## pragma.vision

| KPI | Baseline | Measurement definition (proposal) | Source |
|---|---:|---|---|
| Real human visits / week | 1400 | Bot-filtered, total across all 3 sites | Analytics export |
| Bot visits | 21000 | Bot visits | Analytics export |
| Ebook sales / week | 0 | Completed orders | Sales export |
| Backlinks + mentions | 0 | Indexed pages on real domains, excluding directories (70%) | Manual search |
| Watch subscriptions | 0 | Paid active subscription | Manager confirmation |
| Email list | 0 | Approved registration with consent | Our KV — built in W5 |
| External agent payments | 0 | Settlements from wallets we do not own | Our KV receipt log |
| B2B briefings | 0 | Scheduled meeting in the calendar | CRM sheet |
| Native-AI-agents | 0 | SEO (AEO/GEO) 30% | — |

## soft.house

| KPI | Baseline | Measurement definition (proposal) | Source |
|---|---:|---|---|
| Real human visits / week | see note | Bot-filtered, total across all 3 sites | Analytics export |
| Bot visits | 1000 | Bot visits | Analytics export |
| Ebook sales / week | 0 | Completed orders | Sales export |
| Backlinks + mentions | 0 | Indexed pages on real domains, excluding directories (70%) | Manual search |
| Watch subscriptions | 0 | Paid active subscription | Manager confirmation |
| Email list | 0 | Approved registration with consent | Our KV — built in W5 |
| External agent payments | 0 | Settlements from wallets we do not own | Our KV receipt log |
| B2B briefings | 0 | Scheduled meeting in the calendar | CRM sheet |
| Native-AI-agents | 0 | SEO (AEO/GEO) 30% | — |

## Open question — one number disagrees with itself

The two sheets do not agree on soft.house weekly human visits:

- The pragma.vision sheet's `Baseline(soft.hours)` column reads **0**.
- The soft.house sheet's own `Baseline` column reads **1400** — the same figure
  as pragma.vision, which is what a copied row looks like.

Both cannot be right, and 1400 vs 0 is the difference between "we have an
audience to convert" and "we are starting from nothing". Not resolved here.
Until the manager confirms which is correct, any calculation that depends on it
will state the assumption it used.

## What this baseline means for the programme

Seven of the nine KPIs start at zero. Only traffic is non-zero, and most of that
traffic is not human: 21000 bot visits against 1400 human ones on pragma.vision
is a 15:1 ratio.

That ratio is the argument for this whole project. Machine traffic is already
the majority of what these sites serve, and today none of it can pay for
anything. The PoC is the beginning of an answer to that.

Two KPIs are wired directly to infrastructure built in this repo, and both are
measured from our own KV rather than reported by hand:

- **Email list** — the capture form and consent flow are Week 5 work.
- **External agent payments** — the receipt log already exists; the metric counts
  settlements from wallets we do not control.
