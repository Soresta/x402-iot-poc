# 90-second demo video — script and shot list

**W5 GTM ⚑ GATE** · DoD: file to manager for review
**Status: script and shot list ready. Not recorded.** Recording needs a screen
and a person; this document is what that person follows.

## House rules applied

- **No prices on screen.** Our own pricing never appears. The $0.001 in the demo
  is the *testnet resource price inside the PoC*, which is the subject of the
  video, not an offer — but to stay clearly inside the rule, the amount column is
  cropped out of every browser shot. Amounts still appear in the terminal, where
  they are unambiguously part of the demonstration.
- **Brand wordmark watermark** bottom-right for the full 90 seconds.
- **If the domain is spoken, say "pragma dot vision".** The script below has no
  voiceover; if one is added, that pronunciation applies.
- No hype adjectives. No guarantees. No claims beyond what is on screen.

## Before recording

1. Deploy is current and the demo page is live.
2. `buyer/ledger.jsonl` moved aside so the daily cap does not stop the agent
   mid-take.
3. Terminal at a large font — 16pt minimum. It will be watched on a phone.
4. Browser at 1280×720, bookmarks bar hidden, one tab.
5. Do a full dry run. The chain takes a few seconds per settlement and the
   timings below assume it behaves.

---

## The 90 seconds

### 0:00–0:05 · The problem

**On screen:** black card, one line of text, no motion.

> Most of the traffic hitting your API is not human.
> None of it can pay you.

**Cut on:** the word "pay".

---

### 0:05–0:20 · Two agents find each other

**On screen:** split view — terminal left, browser right showing the Agent Card
JSON.

**Action:** run the buyer. It fetches `/.well-known/agent-card.json`. Let the
viewer see the card's two skills scroll past.

**Caption (lower third):**
> The buyer has never seen this seller before.
> It reads a card at a well-known URL: what is for sale, and on what terms.

**What must be legible:** `sell-iot-reading` and `sell-inference` in the card.

---

### 0:20–0:40 · The payment settles on-chain

**On screen:** terminal full width, then explorer.

**Action:**
1. The buyer requests the resource with no payment → `402 Payment Required`
   flashes in the terminal.
2. It signs and retries. `✅ Purchased` appears with a transaction hash.
3. Cut to the block explorer, already open on that transaction. Hold on
   **Status: Success** and the **ERC-20 token transfer** row for a full 2 seconds.

**Caption:**
> No account. No API key. No human approved this.
> The settlement is public and checkable.

**This is the shot the whole video exists for.** If only one thing is in focus,
it is the explorer page showing a real transfer.

---

### 0:40–0:60 · Data delivered, counter ticks

**On screen:** browser on the live demo page, terminal small in the corner.

**Action:** the buyer keeps running. Settlement cards arrive in the live feed
without a refresh. Let two or three land. The settlements counter increments on
camera.

**Caption:**
> The reading is delivered. The feed is live — nothing here is a mock-up.

**Also visible, deliberately:** the `TESTNET — no real value` badge. Do not crop
it out.

---

### 0:60–0:75 · It sells two different things

**On screen:** the receipts table, Resource column visible.

**Action:** scroll slowly so both `Sensor reading` and `Inference` rows pass.

**Caption:**
> The same rail sells stored data and live compute.
> The seller does not care which; the buyer's mandate does.

---

### 0:75–0:90 · Where to try it, end card

**On screen:** end card, static.

> **x402-iot-poc**
> Open source · MIT · Base Sepolia testnet
> github.com/Soresta/x402-iot-poc
>
> *Testnet only. No real value.*

Wordmark watermark stays. Hold 4 seconds — long enough to read the URL, or to
pause and type it.

---

## Shot list (recording order, not screen order)

Record out of order and cut together; the chain will not perform on cue.

| # | Shot | Source | Notes |
|---|---|---|---|
| 1 | Agent Card JSON | browser | pretty-printed, both skills visible |
| 2 | Buyer terminal, full run | terminal | capture 4–5 purchases, pick the cleanest |
| 3 | 402 response | terminal | may need `curl -i` for a clean frame |
| 4 | Explorer transaction | browser | **must show Status Success + token transfer** |
| 5 | Live feed receiving events | browser | no refresh — that is the point |
| 6 | Receipts table with Resource column | browser | crop the amount column |
| 7 | End card | static | |

## Fallback

If a live settlement fails during recording, use a previously captured take
rather than editing around it. Do not re-time footage to imply a settlement was
faster than it was.

## Review checklist before hand-in

- [ ] No price of ours anywhere on screen
- [ ] Watermark present for all 90 seconds
- [ ] TESTNET badge visible in at least one browser shot
- [ ] Explorer shot legible when played at phone size
- [ ] Total runtime 90 seconds ±3
- [ ] No claim in a caption that the footage does not show
