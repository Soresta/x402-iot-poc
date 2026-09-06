# Funnel map and UTM naming sheet

**W5 REV** · draft for Friday agreement · **status: proposed, nothing live**

Two funnels, one link scheme. Every public link this project owns has a place in
this map; a link that does not appear here should not be published.

---

## 1. The UTM naming sheet

Rules, so that two people tagging links a month apart produce the same strings:

- **Lowercase only.** `devto`, never `DevTo`.
- **Hyphens, never spaces or underscores.** `w6-launch`, never `w6_launch`.
- **No dates in campaign names** beyond the week number — the week is the date.
- **Never invent a value on the spot.** If none of the listed values fit, add it
  to this sheet first, then use it.

### `utm_source` — where the click came from

| Value | Meaning |
|---|---|
| `devto` | dev.to article |
| `x` | X / Twitter |
| `hn` | Hacker News |
| `reddit` | any subreddit (the specific sub goes in `utm_content`) |
| `directory` | ecosystem directory or awesome-list entry |
| `email` | a readiness note we sent |
| `outreach` | a one-to-one B2B message |
| `github` | the repo README or release notes |

### `utm_medium` — what kind of placement

| Value | Meaning |
|---|---|
| `post` | a full article or top-level post |
| `thread` | a multi-part thread |
| `comment` | a reply we wrote, including our own first comment on Show HN |
| `listing` | a directory entry |
| `note` | body of an email note |
| `dm` | direct message or outreach email |

### `utm_campaign` — which push

| Value | Meaning |
|---|---|
| `w4-publish-wave-1` | first two posts |
| `w6-launch` | the coordinated launch week |
| `w7-adoption` | external-adoption push |
| `evergreen` | anything not tied to a push (README, directory entries) |

### `utm_content` — which specific asset or audience

Free-form but constrained to a short slug: `post-1`, `post-2`, `demo-link`,
`repo-link`, `tutorial-link`, `board-link`, `r-webdev`, `r-selfhosted`,
`show-hn-comment`.

### Worked example

```
https://x402-iot-poc.akifk-x402-26.workers.dev/?utm_source=hn&utm_medium=comment&utm_campaign=w6-launch&utm_content=show-hn-comment
```

An untagged public link is traffic that cannot be attributed, which for KPI
purposes is traffic that did not happen.

---

## 2. Funnel A — demo → research board → Watch trial

The machine-payments story pulls a technical audience; the research board is what
that audience can subscribe to.

```
   PUBLIC POST (devto / x / hn / reddit)
        │  utm_campaign = w6-launch
        ▼
   LIVE DEMO PAGE                     ← the proof. settlements arriving, explorer links
        │
        ├──► readiness notes signup    ← our KV, consent-first          [KPI: email list]
        │         │
        │         ▼
        │    weekly note ──► research board link
        │
        └──► research board (pragma.vision)   ← the durable asset
                  │
                  ▼
             Watch trial                                        [KPI: watch subscriptions]
```

**Instrumented where:** the demo page and the signup are ours, so steps 2 and 3
are measured from our own KV — `/api/subscribers/count`, and the receipt log for
settlement activity. The research board and Watch trial live on the company
platform; those numbers come from the manager's exports.

**Known blind spot:** we cannot see the hop from the note to the board, or from
the board to a trial. Attribution stops at the point our infrastructure ends.
Any claim past that boundary is `assisted`, never `direct`.

## 3. Funnel B — tutorial → soft.house signup

```
   SEARCH / SHARE
        │
        ▼
   FLAGSHIP TUTORIAL (soft.house)
        │  every code block copy-paste runnable
        ▼
   READER RUNS IT LOCALLY  ← they now have a working x402 seller
        │
        ├──► repo star / fork                            [KPI: backlinks + mentions]
        │
        └──► soft.house CTA ──► signup                   [KPI: signups]
```

**Why this funnel is the stronger one.** A reader who has run the tutorial has
already spent twenty minutes and has a working thing on their machine. That is a
far better qualified visitor than someone who read a post.

**Instrumented where:** entirely on company property. We supply the tagged links
and the content; the numbers come from the manager's analytics.

---

## 4. Where each KPI is measured

From the baseline sheet, with the source we will actually read:

| KPI | Baseline | Measured from | Ours or theirs |
|---|---:|---|---|
| Real human visits / week | 1400 | analytics export | theirs |
| Bot visits | 21000 (pv) · 1000 (sh) | analytics export | theirs |
| Email list | 0 | `/api/subscribers/count` | **ours** |
| External agent payments | 0 | receipt log, distinct non-owned payers | **ours** |
| Backlinks + mentions | 0 | manual search | manual |
| Watch subscriptions | 0 | manager confirmation | theirs |
| Ebook sales / week | 0 | sales export | theirs |
| B2B briefings | 0 | CRM sheet | manual |

Two KPIs are read straight out of infrastructure in this repo rather than
reported by hand. Those are the two we can defend line by line.

---

## 5. What has to be true before any of this produces a number

Nothing in either funnel is live. In order:

1. **Publish decision.** Posts #1 and #2 are drafted and waiting. Until they go
   out, the top of both funnels is empty and every downstream metric stays at
   zero by construction.
2. **`EXPORT_TOKEN` set on the deployed Worker** — otherwise the weekly CSV
   handover cannot happen. One command: `npx wrangler secret put EXPORT_TOKEN`.
3. **Analytics access or a standing weekly export** for the numbers we cannot
   see ourselves.
4. **Research board loaded** by the manager, so Funnel A has a destination.

Items 1, 3 and 4 are not ours to do. Item 2 is, and takes a minute.
