/**
 * buyer-key.mjs — read BUYER_PRIVATE_KEY the way a first-time user pastes it.
 *
 * MetaMask shows an exported private key as 64 hex characters, without the "0x"
 * that viem requires, and a copy from a web page often brings spaces or quotes
 * with it. A new user then gets a stack trace about hex strings on step 4. That
 * is a documentation problem, and here it is solved in code.
 *
 * Never prints the key or any part of it — error messages describe its shape only.
 */

export function readBuyerPrivateKey(prefix = "") {
  const raw = process.env.BUYER_PRIVATE_KEY;
  if (!raw || !raw.trim()) {
    console.error(`${prefix}FATAL: BUYER_PRIVATE_KEY is not set. Put it in .env — see QUICKSTART.md step 1.`);
    process.exit(1);
  }

  const cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();
  const key = /^[0-9a-fA-F]{64}$/.test(cleaned) ? `0x${cleaned}` : cleaned;

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.error(
      `${prefix}FATAL: BUYER_PRIVATE_KEY does not look like a private key ` +
        `(expected 64 hex characters, optionally starting with 0x; got ${cleaned.length} characters). ` +
        `An address (0x + 40 characters) is not a private key.`
    );
    process.exit(1);
  }
  return key;
}
