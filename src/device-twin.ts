/**
 * device-twin.ts — DeviceTwin Durable Object
 *
 * Separation of responsibility (per brief §4):
 *   - This class knows NOTHING about money.
 *   - It only produces and stores simulated telemetry.
 *   - Payment verification, idempotency, and receipts live in the Worker layer.
 *
 * Alarm chain pattern:
 *   - Constructor: set first alarm if none exists (inside blockConcurrencyWhile).
 *   - alarm(): schedule NEXT alarm BEFORE any business logic — one failure cannot
 *     permanently kill the device.
 */

import { DurableObject } from "cloudflare:workers";
import type { Env, SensorReading, DeviceTwinState } from "./types";

const HISTORY_MAX = 50;
const DEFAULT_TICK_MS = 60_000;

export class DeviceTwin extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Set first alarm inside blockConcurrencyWhile to avoid race conditions
    // between concurrent constructor calls (documented Workers pattern).
    ctx.blockConcurrencyWhile(async () => {
      const existing = await ctx.storage.getAlarm();
      if (existing === null) {
        await ctx.storage.setAlarm(Date.now() + this.tickInterval());
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Alarm handler — scheduled telemetry tick
  // ---------------------------------------------------------------------------

  async alarm(): Promise<void> {
    // CRITICAL: schedule next alarm BEFORE business logic so that a failure
    // in the tick body cannot permanently stop the alarm chain.
    await this.ctx.storage.setAlarm(Date.now() + this.tickInterval());

    await this.tick();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private tickInterval(): number {
    const raw = Number(this.env.TICK_INTERVAL_MS);
    return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_TICK_MS;
  }

  private generateReading(seq: number): SensorReading {
    return {
      seq,
      device_id: this.env.DEVICE_ID || "sim-sensor-01",
      temperature_c: Number((18 + Math.random() * 9).toFixed(2)),
      humidity_pct: Number((40 + Math.random() * 40).toFixed(1)),
      ts: new Date().toISOString(),
      note: "TESTNET — no real value",
    };
  }

  private async tick(): Promise<void> {
    // Load current state atomically
    const rawSeq = await this.ctx.storage.get<number>("seq");
    const rawHistory = await this.ctx.storage.get<SensorReading[]>("history");

    const seq = (rawSeq ?? 0) + 1;
    const history: SensorReading[] = rawHistory ?? [];

    const latest = this.generateReading(seq);

    // Ring buffer: newest first, max HISTORY_MAX entries
    history.unshift(latest);
    if (history.length > HISTORY_MAX) {
      history.length = HISTORY_MAX;
    }

    // Single atomic write — never three separate puts
    await this.ctx.storage.put({ latest, seq, history });
  }

  // ---------------------------------------------------------------------------
  // Public RPC methods (called via stub.getLatestReading(), etc.)
  // ---------------------------------------------------------------------------

  /**
   * Returns the most recent SensorReading.
   * If storage is empty (device just created), generates one on demand
   * so the demo never starts blank.
   */
  async getLatestReading(): Promise<SensorReading> {
    const latest = await this.ctx.storage.get<SensorReading>("latest");
    if (latest) return latest;

    // On-demand seed: generate seq=0 reading without persisting a full tick
    const seq = 0;
    const reading = this.generateReading(seq);
    await this.ctx.storage.put({ latest: reading, seq, history: [reading] });
    return reading;
  }

  /**
   * Returns history newest-first, clamped to [1, 50].
   */
  async getHistory(limit: number): Promise<SensorReading[]> {
    const clamped = Math.max(1, Math.min(50, Math.floor(limit)));
    const history = (await this.ctx.storage.get<SensorReading[]>("history")) ?? [];
    return history.slice(0, clamped);
  }

  /**
   * Returns device status including current seq and next alarm time.
   */
  async getStatus(): Promise<{
    device_id: string;
    seq: number;
    nextAlarmAt: string | null;
    tickIntervalMs: number;
  }> {
    const seq = (await this.ctx.storage.get<number>("seq")) ?? 0;
    const alarmTs = await this.ctx.storage.getAlarm();
    return {
      device_id: this.env.DEVICE_ID || "sim-sensor-01",
      seq,
      nextAlarmAt: alarmTs !== null ? new Date(alarmTs).toISOString() : null,
      tickIntervalMs: this.tickInterval(),
    };
  }
}
