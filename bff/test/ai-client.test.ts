import { afterEach, describe, expect, it, vi } from "vitest";
import { AiServiceError, HttpAiClient } from "../src/ai-client.js";

const ok = { status: "sem_base", message: "x", norms: [], requirements: [], questions: [] };

afterEach(() => vi.unstubAllGlobals());

describe("HttpAiClient", () => {
  it("envia token interno e valida a resposta", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new HttpAiClient("http://ai", "segredo").analyze("trabalho em altura");
    expect(result.status).toBe("sem_base");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("segredo");
  });

  it("timeout vira 504 com mensagem amigável", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timeout", "TimeoutError"); }));
    const error = await new HttpAiClient("http://ai", "t").analyze("x").catch((e) => e);
    expect(error).toBeInstanceOf(AiServiceError);
    expect(error.status).toBe(504);
  });

  it("erro 5xx do serviço vira 502 com o detail dele", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "indisponível" }), { status: 500 })));
    const error = await new HttpAiClient("http://ai", "t").analyze("x").catch((e) => e);
    expect(error.status).toBe(502);
    expect(error.message).toBe("indisponível");
  });

  it("resposta fora do contrato é rejeitada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "talvez" }), { status: 200 })));
    await expect(new HttpAiClient("http://ai", "t").analyze("x")).rejects.toMatchObject({
      status: 502,
      message: "O serviço de análise devolveu uma resposta incompleta. Tente novamente.",
    });
  });

  it("não aceita análise concluída com menos de dez perguntas", async () => {
    const incomplete = {
      status: "ok",
      message: "Vou fazer 4 perguntas.",
      norms: [],
      requirements: [],
      questions: Array.from({ length: 4 }, (_, index) => ({
        id: `q${index + 1}`,
        text: `Pergunta ${index + 1}`,
        refs: [],
        section: "controles",
      })),
      risk_context: [],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(incomplete), { status: 200 })));

    await expect(new HttpAiClient("http://ai", "t").analyze("atividade válida")).rejects.toMatchObject({ status: 502 });
  });
});
