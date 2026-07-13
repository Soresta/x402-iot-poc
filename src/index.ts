/**
 * x402-iot-poc — Gün 1 hello-world Worker.
 *
 * Şimdilik tek amacı: kendi Cloudflare hesabında canlı bir URL'in olması
 * ve dağıtım (deploy) hattının çalıştığını kanıtlaman. Gerçek 402 kapısı W2'de gelecek.
 */
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const body = {
      project: "x402-iot-poc",
      status: "hello-world",
      note: "TESTNET — gerçek değer yok. Gerçek x402 ödeme akışı W2'de gelecek.",
      time: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
} satisfies ExportedHandler<Env>;
