/**
 * payers.ts — who is actually paying, and which of them are strangers.
 *
 * Week 7's milestone is "at least one external agent settles a testnet
 * payment". That number is worthless unless our own wallets are excluded from
 * it, and easy to fool ourselves with if the exclusion is done by eye afterwards
 * rather than by the code that reports the figure.
 *
 * So the seller is told which addresses we control (`OWN_WALLETS`), and every
 * payer count is reported split: ours, and everyone else's. A payer is
 * "external" only if it is not on that list.
 *
 * This deliberately makes the headline number harder to move. A second wallet we
 * fund ourselves is a useful smoke test of the quickstart; it is not adoption,
 * and adding it to `OWN_WALLETS` is what keeps the two apart.
 */

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

export interface PayerSummary {
  address: string;
  settlements: number;
  volume_usdc: number;
  first_seen: string;
  last_seen: string;
  external: boolean;
}

/** Addresses we control, from config. Lower-cased for comparison. */
export function ownWallets(env: any): Set<string> {
  const raw = String(env.OWN_WALLETS ?? "");
  return new Set(
    raw
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Show enough of an address to be recognisable, not enough to be a directory. */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function summarise(receipts: any[], own: Set<string>): PayerSummary[] {
  const byPayer = new Map<string, PayerSummary>();

  for (const r of receipts) {
    const address = String(r.payer ?? "").toLowerCase();
    if (!address) continue;

    const amount = parseFloat(String(r.amount ?? "").replace(/[^0-9.]/g, "")) || 0;
    const ts = String(r.timestamp ?? "");
    const existing = byPayer.get(address);

    if (existing) {
      existing.settlements += 1;
      existing.volume_usdc = Number((existing.volume_usdc + amount).toFixed(6));
      if (ts && ts < existing.first_seen) existing.first_seen = ts;
      if (ts && ts > existing.last_seen) existing.last_seen = ts;
    } else {
      byPayer.set(address, {
        address,
        settlements: 1,
        volume_usdc: Number(amount.toFixed(6)),
        first_seen: ts,
        last_seen: ts,
        external: !own.has(address),
      });
    }
  }

  return [...byPayer.values()].sort((a, b) => b.last_seen.localeCompare(a.last_seen));
}

/**
 * GET /api/payers
 *
 * Public. Addresses are already public on-chain — every one of these appears in
 * a block explorer — so this exposes nothing new. It is truncated anyway,
 * because a page that renders full wallet addresses invites being read as a
 * directory of them.
 */
export async function payersHandler(c: any) {
  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }

  const rawLog = await c.env.IOT_KV.get("receipt_log");
  const receipts: any[] = rawLog ? JSON.parse(rawLog) : [];
  const own = ownWallets(c.env);
  const payers = summarise(receipts, own);

  const external = payers.filter((p) => p.external);

  return c.json({
    // The Week 7 milestone number, computed rather than asserted.
    external_payers: external.length,
    own_payers: payers.length - external.length,
    milestone_w7_met: external.length >= 1,
    payers: payers.map((p) => ({
      address: shortenAddress(p.address),
      settlements: p.settlements,
      volume_usdc: p.volume_usdc,
      last_seen: p.last_seen,
      external: p.external,
    })),
    note:
      own.size === 0
        ? "OWN_WALLETS is not configured, so every payer is counted as external. That number is not trustworthy until it is set."
        : "A payer is external only if it is not in OWN_WALLETS. Wallets we fund ourselves are a smoke test, not adoption.",
    caveat: "Based on the last 100 receipts held in KV, not the full chain history.",
  });
}
