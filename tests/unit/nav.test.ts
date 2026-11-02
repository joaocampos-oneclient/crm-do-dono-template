import { describe, expect, it } from "vitest";
import { lerRota, TELA_PADRAO } from "@/components/crm/provider";
import {
  NAV_DESKTOP,
  NAV_MOBILE_PRIMARY,
  NAV_MOBILE_PRIMARY_IDS,
  telaNoMais,
} from "@/lib/nav";

describe("nav Desktop v2 / Mobile 2", () => {
  it("home padrão é Hoje", () => {
    expect(TELA_PADRAO).toBe("hoje");
    expect(lerRota("").tela).toBe("hoje");
    expect(lerRota("#/").tela).toBe("hoje");
  });

  it("sidebar tem exatamente 3 grupos", () => {
    const grupos = [...new Set(NAV_DESKTOP.map((t) => t.grupo))];
    expect(grupos).toEqual(["Operação", "Gestão", "Configuração"]);
  });

  it("mobile tem Hoje · Funil · Conversas · Leads · Mais", () => {
    expect(NAV_MOBILE_PRIMARY.map((t) => t.label)).toEqual([
      "Hoje",
      "Funil",
      "Conversas",
      "Leads",
      "Mais",
    ]);
  });

  it("telas secundárias caem no Mais", () => {
    expect(telaNoMais("agentes")).toBe(true);
    expect(telaNoMais("integracoes")).toBe(true);
    expect(telaNoMais("hoje")).toBe(false);
    expect(NAV_MOBILE_PRIMARY_IDS).toContain("contatos");
  });
});
