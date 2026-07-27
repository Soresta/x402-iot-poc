import { Hono, type MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

type Env = { PAY_TO: string; FACILITATOR_URL: string };
const app = new Hono<{ Bindings: Env }>();

let payment: MiddlewareHandler | undefined;

app.use(async (c, next) => {
  payment ??= paymentMiddleware(
    {
      "GET /reading": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: "eip155:84532",
          payTo: c.env.PAY_TO as `0x${string}`,
        },
        description: "One simulated IoT sensor reading",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(
      new HTTPFacilitatorClient({ url: c.env.FACILITATOR_URL })
    ).register("eip155:84532", new ExactEvmScheme())
  );
  return payment(c, next);
});

app.get("/reading", (c) =>
  c.json({
    device_id: "sim-sensor-01",
    temperature_c: Number((18 + Math.random() * 6).toFixed(2)),
    ts: new Date().toISOString(),
    note: "TESTNET — no real value",
  })
);

export default app;