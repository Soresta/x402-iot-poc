/**
 * rate-limiter.ts — a sliding-window rate limiter that holds under concurrency.
 *
 * WHY THIS REPLACED THE KV LIMITER (open item A6, measured 2026-09-11)
 *
 * The first limiter kept a list of timestamps in Workers KV: read the list,
 * count, append, write it back. Sequentially it worked — request 11 got a 429,
 * and the build logs say so. Under concurrency it did not work at all:
 *
 *   30 simultaneous requests from one payer, against the deployed Worker,
 *   three runs:  30 passed the limiter, 0 got 429 — every time.
 *
 * Every request read the same empty list before any of them wrote. KV has no
 * atomic read-modify-write, and it is eventually consistent on top of that.
 *
 * A Durable Object instance processes its events one at a time, and its storage
 * operations are protected by input gates, so a read-count-write inside one
 * method cannot interleave with another request to the same instance. One
 * instance per bucket key makes the count exact.
 *
 * TWO BUCKETS, AND WHY
 *
 * The old limiter keyed only on the payer address — which it read from the
 * payment header *before* that header had been verified. A client can put any
 * address there, so rotating fake addresses walks straight past a per-payer
 * limit. So there are now two buckets, and a request must fit in both:
 *
 *   payer:<address>  — the documented per-buyer quota (RATE_LIMIT_QUOTA)
 *   ip:<address>     — a flood backstop keyed on CF-Connecting-IP, which
 *                      Cloudflare sets and a client cannot forge
 *                      (IP_RATE_LIMIT_QUOTA, higher, so buyers behind one NAT
 *                      are not throttled as if they were one buyer)
 *
 * WHAT IT PROTECTS
 *
 * Not the resource — the payment gate already refuses everything unpaid. It
 * protects the facilitator, which is called to verify every proof that gets past
 * this point, from being flooded through us.
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";

export interface WindowDecision {
  allowed: boolean;
  /** Seconds until a slot frees up; 0 when allowed. */
  retryAfter: number;
  /** Timestamps to persist, already pruned and, if allowed, including now. */
  kept: number[];
}

/**
 * The window arithmetic, pure so it can be tested without a Durable Object.
 */
export function evaluateWindow(
  timestamps: number[],
  nowMs: number,
  windowMs: number,
  quota: number
): WindowDecision {
  const fresh = timestamps.filter((t) => t > nowMs - windowMs).sort((a, b) => a - b);

  if (fresh.length >= quota) {
    const retryAfter = Math.max(1, Math.ceil((fresh[0] + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfter, kept: fresh };
  }

  fresh.push(nowMs);
  return { allowed: true, retryAfter: 0, kept: fresh };
}

export class RateLimiter extends DurableObject<Env> {
  /**
   * Record one hit against this bucket, or refuse it.
   *
   * Everything between the storage read and the storage write is synchronous,
   * so no other request to this instance can observe the list mid-update.
   */
  async hit(windowMs: number, quota: number): Promise<{ allowed: boolean; retryAfter: number }> {
    const now = Date.now();
    const stored = (await this.ctx.storage.get<number[]>("hits")) ?? [];
    const decision = evaluateWindow(stored, now, windowMs, quota);
    await this.ctx.storage.put("hits", decision.kept);

    // Let an idle bucket clean itself up rather than accumulating forever.
    if (decision.kept.length > 0) {
      await this.ctx.storage.setAlarm(now + windowMs + 1000);
    }
    return { allowed: decision.allowed, retryAfter: decision.retryAfter };
  }

  async alarm(): Promise<void> {
    const stored = (await this.ctx.storage.get<number[]>("hits")) ?? [];
    const windowMs = (Number(this.env.RATE_LIMIT_WINDOW_S) || 60) * 1000;
    const fresh = stored.filter((t) => t > Date.now() - windowMs);
    if (fresh.length === 0) {
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.put("hits", fresh);
    }
  }
}
