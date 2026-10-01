import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("gateway HTTP", () => {
  it("aquece BFF e IA pela rota que atravessa os dois serviços", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);

    api.warmUp();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/metrics");
  });

  it("consulta o histórico e registra retroalimentação no relatório selecionado", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "feedback-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.history();
    await api.sendFeedback("registro 1", {
      target_type: "requisito",
      target_ref: "NR-35 item 35.4.1",
      verdict: "incompleto",
      comment: "Faltou evidência.",
      correction: "Anexar a AR.",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/api/history?archived=false");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:3000/api/history/registro%201/feedback", expect.objectContaining({ method: "POST" }));
  });

  it("usa os métodos corretos para versionar, arquivar e excluir", async () => {
    const record = { id: "registro-1" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.reviseHistory("registro-1", {
      activity: "Atividade revisada em campo",
      change_note: "Evidência atualizada",
      answers: [],
      findings: [{ ref: "NR-35 item 35.5.1", status: "atendido", justification: "Evidência conferida." }],
    });
    await api.archiveHistory("registro-1", true);
    await api.deleteHistory("registro-1", "EXCLUIR");

    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });
});
