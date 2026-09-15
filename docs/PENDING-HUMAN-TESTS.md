# Tests that need a person — what is left

**Last updated: 2026-09-15.** Only the checks still open are listed. Each gives the
exact steps and what the evidence must show.

The checks already done by a person are no longer listed: the stranger docs
test, the 30-second demo test, a real `Ctrl+C`, the block-explorer check, Agent
Card signing, the first external payment and the tutorial clean run. Their results
are in [`VERIFICATION.md`](./VERIFICATION.md) and their screenshots in
[`evidence/`](./evidence/). The full step-by-step write-ups are kept at release
v1.2.0:
[docs/PENDING-HUMAN-TESTS.md @ v1.2.0](https://github.com/Soresta/x402-iot-poc/blob/v1.2.0/docs/PENDING-HUMAN-TESTS.md).

| # | Check | Who | State |
|---|---|---|---|
| 1 | Demo Day deck rehearsed twice | intern | 🔴 open (B7) |
| 2 | 90-second fallback video | intern | 🔴 open (B8) |
| 3 | 24-hour unattended run | manager decides | 🔴 partial; acceptance is the manager's call (B6) |
| 4 | Publish wave and interest scores | blocked on the publish decision | 🔴 blocked (E1) |

---

## 1. Demo Day deck rehearsed twice

**Closes:** W9 Demo Day prep ("12–15 slide deck, rehearsed twice")
**Material:** [`week9/demo-day-deck.pptx`](./week9/demo-day-deck.pptx): 15 slides,
speaker notes on every slide. Target 20 minutes plus 10 for questions.

Before each run:

1. Deploy is current, and the demo page opens and shows **Live**.
2. Move `buyer/ledger.jsonl` aside, so the daily cap does not stop the agent mid-demo.
3. Open a Basescan tab on a known-good transaction.

Then:

1. Present in Presenter View, out loud, with a timer.
2. On slides 3–6, run the live demo for real: `node buyer/agent.mjs` against the
   public Worker, next to the demo page.
3. Write down the time and every place you stalled.
4. Fix what stalled, then do the second run the same way.

**Record:** both times, and what changed between them.

---

## 2. 90-second fallback demo video

**Closes:** W5 "90-second demo video" · the video fallback in W9 Demo Day prep
**Material:** [`content/demo-video-script.md`](./content/demo-video-script.md), with
six scenes, captions and a shot list.

1. Same pre-flight as #1. Set the terminal font to at least 16 pt, and use one browser tab.
2. Record with `Win + Alt + R` (Xbox Game Bar) or OBS. No voice-over needed.
3. The explorer shot, with Status Success and the token transfer row, must be held
   for a full two seconds. The whole video exists for that shot.
4. Keep the `TESTNET — NO REAL VALUE` badge visible.
5. Trim and add the captions (Clipchamp is enough), then send the file to the manager.

**Record:** the file name and length, and the date it was sent.

---

## 3. The 24-hour unattended run

**Closes:** W3 buyer DoD, "runs 24 h without exceeding its mandate"

> **State: PARTIAL.** 1 h continuous on 2026-08-14 (111 settlements). On 2026-09-11:
> 8 h 50 m wall clock, about 2 h 37 m of it buying, with the laptop asleep in between.
> 146 purchases; the cap was never exceeded. That run found and fixed a real
> accounting bug. [Write-up](./soak-runs/SOAK-2026-09-11.md).
> **Decision 2026-09-14: not re-run.** It is reported with those numbers, not as
> 24 h, and the manager decides whether that is acceptable.

If it is re-run, it needs a machine that stays awake for a day:

```bash
powercfg /change standby-timeout-ac 0
```

```bash
$env:SOAK_DURATION_MIN="1440"; $env:SELLER_URL="https://x402-iot-poc.akifk-x402-26.workers.dev"; $env:LOOP_INTERVAL_MS="60000"; $env:DAILY_CAP="2.00"; $env:MAX_PER_CALL="0.001"; node buyer/soak.mjs
```

- Set `SELLER_URL`, and do not run other paid scripts from the same wallet while
  the soak runs.
- Restore sleep afterwards: `powercfg /change standby-timeout-ac 30`.
- Report the real elapsed time from the log. If it ran 19 hours, it ran 19 hours.

---

## 4. Publish wave and interest scores

**Closes:** W4 publish wave #1 · W6 coordinated launch
**Blocked on:** the publish decision (E1). All copy is drafted in `docs/content/`.

If and when the posts go out:

1. Post, then stay in the thread and reply to every comment.
2. After 48 h, collect: replies, saves/shares, signups, checkout starts,
   purchases, moderator warnings.
3. Compute `score = 3×replies + 2×saves + 5×signups + 8×checkout starts +
   20×purchases − 10×warnings`.
4. Record the link, timestamp, score and top questions per channel.

Until this runs, every GTM and REV metric in the programme stays at zero by
construction, and the reports say so.
