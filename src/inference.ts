/**
 * inference.ts — the second priced resource: pay-per-inference.
 *
 * Week 3 sold sensor readings: a device with data to offer. This sells compute:
 * a model run, priced per call, behind the same payment gate. Two resource
 * *kinds* on one rail is the point — the seller does not care whether it is
 * selling data or work, and the buyer discovers both from the same Agent Card.
 *
 * Inference is priced higher than a reading because it costs more to produce.
 * That difference is what makes the buyer's `max_per_call` mandate limit
 * meaningful: an agent authorized for cheap readings is not automatically
 * authorized to buy compute.
 *
 * Model: a small sentiment classifier on Workers AI. Deliberately modest —
 * the interesting part is the payment rail, not the model.
 */

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

/** Small, fast, and free-tier friendly. */
export const INFERENCE_MODEL = "@cf/huggingface/distilbert-sst-2-int8";

export const MAX_INPUT_CHARS = 512;

export interface InferenceResult {
  model: string;
  input: string;
  label: string;
  score: number;
  ts: string;
  note: string;
}

/**
 * Pick the most confident class from a classifier response.
 *
 * The model returns one entry per class, e.g.
 *   [{label:"NEGATIVE",score:0.0002},{label:"POSITIVE",score:0.9998}]
 * in a FIXED order, not sorted by confidence. Reading `output[0]` therefore
 * reports the LEAST likely class — which is exactly the bug this function was
 * extracted to prevent, and it looked plausible because the shape was right.
 *
 * Exported so a test can assert on it directly, without paying for an inference.
 */
export function pickTopClass(output: unknown): { label: string; score: number } {
  const classes: any[] = Array.isArray(output) ? output : output ? [output as any] : [];
  const top = classes.reduce(
    (best: any, cur: any) => ((cur?.score ?? -1) > (best?.score ?? -1) ? cur : best),
    null
  );
  return {
    label: top?.label ?? "UNKNOWN",
    score: typeof top?.score === "number" ? Number(top.score.toFixed(4)) : 0,
  };
}

/**
 * GET /api/inference?text=...
 *
 * Runs only after the payment gate has already settled, so by the time this
 * executes the buyer has paid. Input validation therefore has to happen before
 * the gate would be better — but a 400 here after payment would mean charging
 * for nothing, so the text is defaulted rather than rejected.
 */
export async function inferenceHandler(c: any) {
  const raw = (c.req.query("text") ?? "").toString().trim();

  // No text is not an error the buyer should pay for and receive nothing from.
  // Fall back to a sample so the response is always worth the price.
  const input = (raw || "This machine paid for its own compute.").slice(0, MAX_INPUT_CHARS);

  if (!c.env.AI) {
    return c.json({ error: "inference_unavailable", docs_url: DOCS_URL }, 503, {
      "Retry-After": "30",
    });
  }

  try {
    const output = await c.env.AI.run(INFERENCE_MODEL, { text: input });

    const { label, score } = pickTopClass(output);

    const result: InferenceResult = {
      model: INFERENCE_MODEL,
      input,
      label,
      score,
      ts: new Date().toISOString(),
      note: "TESTNET — no real value",
    };
    return c.json(result);
  } catch {
    // Fail closed in shape, not in silence: the buyer has already paid, so say
    // plainly that the work could not be done rather than returning a stack.
    return c.json({ error: "inference_failed", docs_url: DOCS_URL }, 503, {
      "Retry-After": "10",
    });
  }
}
