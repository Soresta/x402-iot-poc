/**
 * budget.mjs — how much has this agent spent recently?
 *
 * This used to count "today" as the current UTC calendar date. That made the
 * daily cap softer than it looked: at 00:00 UTC the counter reset to zero no
 * matter how recently the agent had spent, so an agent running across midnight
 * could spend up to twice its cap inside a single 24-hour period. Found by
 * running the agent for an hour across midnight and reading the ledger
 * (docs/week5/soak-run.log).
 *
 * The cap is now a ROLLING window: everything spent in the last 24 hours counts,
 * whatever the calendar says.
 *
 * Pure function, no filesystem access, so it can be tested directly.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Array<{ts?: string, price?: number}>} entries ledger entries
 * @param {number} nowMs current time in ms
 * @param {number} [windowMs] window length, default 24 h
 * @returns {number} total spent inside (now - window, now]
 */
export function spentInWindow(entries, nowMs, windowMs = DAY_MS) {
  const windowStart = nowMs - windowMs;
  let total = 0;
  for (const entry of entries) {
    if (typeof entry?.price !== "number") continue; // refusals carry no price
    const t = Date.parse(entry.ts ?? "");
    if (Number.isNaN(t)) continue;
    if (t > windowStart && t <= nowMs) total += entry.price;
  }
  return Number(total.toFixed(6));
}
