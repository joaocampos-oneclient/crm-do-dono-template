import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyWppEngineSignature, newIdempotencyKey, newWebhookSecret } from "@/lib/whatsapp/wpp-engine";
import { resolveProviderId } from "@/lib/whatsapp";

describe("whatsapp provider", () => {
  it("padrão é wpp-engine", () => {
    delete process.env.WHATSAPP_PROVIDER;
    expect(resolveProviderId()).toBe("wpp-engine");
  });

  it("aceita waha quando pedido", () => {
    process.env.WHATSAPP_PROVIDER = "waha";
    expect(resolveProviderId()).toBe("waha");
    delete process.env.WHATSAPP_PROVIDER;
  });

  it("valida assinatura HMAC do webhook", () => {
    const secret = "whsec_test";
    const body = '{"id":"evt_1","type":"message.received"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWppEngineSignature(body, sig, secret)).toBe(true);
    expect(verifyWppEngineSignature(body, "00" + sig.slice(2), secret)).toBe(false);
  });

  it("gera idempotency_key no tamanho certo", () => {
    const k = newIdempotencyKey();
    expect(k.length).toBeGreaterThanOrEqual(8);
    expect(k.length).toBeLessThanOrEqual(120);
  });

  it("gera webhook secret", () => {
    expect(newWebhookSecret()).toMatch(/^whsec_/);
  });
});
