# Week 1 — Ground truth and first shipped value

**Dates:** 13–17 July 2026 · **Status after the programme:** 6 of 7 tasks done

Week 1 left four things behind: a working toolchain, a reading of the company's
public surface, the KPI baselines, and a map of the x402 / AP2 / A2A landscape.
This folder holds what can be published. Two Week 1 deliverables stay private,
and the reason is given below.

## Tasks

| Task | Definition of done | Result | Where |
|---|---|---|---|
| Workstation + accounts setup | Day-1 checklist ticked; hello-world Worker live; repo public | ✅ Done 13–14 July | Checklist below · first commit `7e13f08` · CHANGELOG 0.1.0 |
| Read the public surface | 10 sharp questions for Friday | ✅ Done | Kept private — see note |
| Fresh-eyes friction audit (3 buying journeys) | Ranked top-10 friction report, 3 quick wins | ✅ Delivered to the manager | Kept private — see note |
| Pin the scoreboard baselines ⚑ | All baseline cells filled | ✅ Filled from the manager's metrics sheets | [`../metrics/BASELINE.md`](../metrics/BASELINE.md) |
| Distribution scouting (Gate 0) | Scout notes per channel + value-post angles | ❌ No written record | — |
| x402 / AP2 / A2A landscape scan | 2-page note + 3 candidate IoT use-cases | ✅ Delivered 27 July (late) | [`landscape-note.pdf`](./landscape-note.pdf) · [`research/`](./research/) |
| Friday demo #1 + retro | Agenda walked through | ✅ Held online | — |

## Day-1 checklist

| Item | Status | Note |
|---|---|---|
| PoC repo on GitHub, public, MIT, README stub | Done | `github.com/Soresta/x402-iot-poc` |
| Cloudflare account, Node LTS, wrangler; hello-world Worker | Done | Node v24.11.1, wrangler 4.110.0; Worker live at `x402-iot-poc.akifk-x402-26.workers.dev` |
| Wallet on Base Sepolia, funded from faucets | Done | Network added; test ETH and USDC received |
| Community accounts (dev.to, X, Hacker News, Reddit) | Done | Created on day 1 so they have age by launch week |
| Comms channel + calendar invites | In progress | Invite requested from the manager |
| Bookmark the specs | Done | x402, AP2, A2A, Cloudflare, Base |
| Read the handbook; write down questions | Done | Questions taken to the Friday demo |

### Problems hit on day 1, and how each was solved

| Problem | Fix |
|---|---|
| First commit failed: git identity not set | `git config --global user.name` / `user.email` once |
| Home folder was already a git repo, so the project nested inside it | Gave the project its own independent repository |
| Remote added as `akifk`, but the GitHub user is `Soresta` → "repository not found" | `git remote set-url` to the correct address |
| GitHub no longer accepts password push | GitHub CLI (`gh auth login`) through the browser |
| `workers.dev` subdomain names must be unique | Appended a personal identifier: `akifk-x402-26` |
| Risk of importing a fake USDC token | Checked the network (Base Sepolia, not mainnet) and the contract address before importing |
| Garbled Turkish characters in PowerShell comments | Cosmetic only; runtime output was clean |

## Files

| File | What it is |
|---|---|
| [`landscape-note.pdf`](./landscape-note.pdf) | The W1T6 deliverable: how x402, AP2 and A2A fit together, what is mature and what is rough, and three IoT use-cases with a recommendation |
| [`research/x402-a2a-study-notes.pdf`](./research/x402-a2a-study-notes.pdf) | Study notes behind it: facilitator, mandates (intent vs cart), A2A, with diagrams |
| [`research/x402-facilitator-guide.md`](./research/x402-facilitator-guide.md) | The facilitator section of those notes, as markdown (English) |
| [`research/a2a-x402-rehberi.md`](./research/a2a-x402-rehberi.md) | How A2A and x402 compose (Turkish) |

## Kept out of this public repository

| Item | Why |
|---|---|
| Questions on the company's sites, and the friction audit | Internal feedback on the company's own products. It was delivered to the manager and is not for a public repo |
| Raw scoreboard sheet | The manager's internal metrics. The baseline figures used by this project are in [`../metrics/BASELINE.md`](../metrics/BASELINE.md) |
| Day-1 screenshots of personal accounts | Personal profiles and photo. The checklist above records what they showed |
