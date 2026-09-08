/**
 * negotiate.ts — A2A price negotiation (W8).
 *
 * Until now the price was take-it-or-leave-it: a buyer whose mandate allowed
 * less than the asking price simply got `403 mandate_scope_exceeded` and gave
 * up. Negotiation gives it a second move — say what it *can* pay, and let the
 * seller decide.
 *
 * The rules are deliberately simple, because the interesting part is that a
 * negotiation exists at all, not that it is clever:
 *
 *   Buyer:  if the asking price is above my per-call limit, counter at my limit.
 *   Seller: accept an offer at or above list price. Otherwise decline and
 *           restate the list price. No discounting.
 *
 * A seller that always declines is a correct implementation of this protocol,
 * and ours does — which is worth being honest about rather than dressing up as
 * a haggling engine. What the exchange buys is a *machine-readable no* with the
 * real price attached, instead of a buyer guessing.
 *
 * Nothing here moves money. Negotiation happens before payment, costs nothing,
 * and is not binding: an accepted quote still has to be paid for through the
 * normal 402 flow, and the price is re-checked there.
 */

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

/** The resources that can be negotiated over, and where their price lives. */
const RESOURCES: Record<string, { priceVar: string; path: string }> = {
  readings: { priceVar: "PRICE_PER_READING", path: "/api/readings" },
  inference: { priceVar: "PRICE_PER_INFERENCE", path: "/api/inference" },
};

/** "$0.001" → 0.001 */
function priceToUsdc(price: string): number {
  return parseFloat(String(price).replace(/[^0-9.]/g, ""));
}

export interface NegotiationOutcome {
  resource: string;
  list_price_usdc: number;
  offer_usdc: number;
  accepted: boolean;
  reason?: string;
  counter_usdc?: number;
  resource_url?: string;
  note: string;
}

/**
 * GET /api/negotiate?resource=readings&offer=0.0005
 *
 * Public and free. Returns 200 whether or not the offer is accepted — a
 * declined offer is a successful negotiation, not an error, and returning 4xx
 * here would make a buyer's retry logic treat a normal answer as a fault.
 */
export function negotiateHandler(c: any) {
  const resourceName = String(c.req.query("resource") ?? "readings").toLowerCase();
  const spec = RESOURCES[resourceName];

  if (!spec) {
    return c.json(
      {
        error: "unknown_resource",
        docs_url: DOCS_URL,
        available: Object.keys(RESOURCES),
      },
      404
    );
  }

  const listPrice = priceToUsdc(c.env[spec.priceVar]);
  const rawOffer = c.req.query("offer");

  // No offer means "what do you want for this?" — answer with the price.
  if (rawOffer === undefined) {
    return c.json({
      resource: resourceName,
      list_price_usdc: listPrice,
      offer_usdc: 0,
      accepted: false,
      reason: "no_offer_made",
      counter_usdc: listPrice,
      note: "Send ?offer= to make one. Quotes are not binding; payment is still verified at the resource.",
    } satisfies NegotiationOutcome);
  }

  const offer = Number(rawOffer);
  if (!Number.isFinite(offer) || offer < 0) {
    return c.json({ error: "offer_invalid", docs_url: DOCS_URL }, 400);
  }

  const origin = new URL(c.req.url).origin;

  if (offer >= listPrice) {
    return c.json({
      resource: resourceName,
      list_price_usdc: listPrice,
      offer_usdc: offer,
      accepted: true,
      resource_url: `${origin}${spec.path}`,
      note:
        offer > listPrice
          ? "Accepted. You offered above the asking price; you will be charged the asking price."
          : "Accepted. Pay through the normal 402 flow at resource_url.",
    } satisfies NegotiationOutcome);
  }

  return c.json({
    resource: resourceName,
    list_price_usdc: listPrice,
    offer_usdc: offer,
    accepted: false,
    reason: "offer_below_list_price",
    counter_usdc: listPrice,
    note: "Declined. This seller does not discount; the counter is the list price.",
  } satisfies NegotiationOutcome);
}
