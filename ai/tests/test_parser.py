from aprumo_ai.ingestion.parser import parse_norm

LINES = [
    "Este texto não substitui o publicado no DOU",
    "35.1 Objetivo e Campo de Aplicação",
    "35.1.1 Esta Norma estabelece os requisitos mínimos e as medidas de proteção",
    "para o trabalho em altura.",
    "35.3.1 O empregador deve promover programa para capacitação. (Revogado pela Portaria SEPRT n.º 915)",
    "10.2.1 item de outra norma citado no texto",
    "ANEXO I",
    "35.1.1 Item repetido dentro do anexo.",
]


def test_extrai_itens_e_junta_continuacao():
    reqs = parse_norm(35, LINES)
    first = next(r for r in reqs if r.item == "35.1.1" and r.annex is None)
    assert first.text.endswith("para o trabalho em altura.")
    assert first.norm == "NR-35"


def test_ignora_ruido_e_numero_de_outra_norma():
    reqs = parse_norm(35, LINES)
    assert all(not r.item.startswith("10.") for r in reqs)
    assert all("não substitui" not in r.text for r in reqs)


def test_marca_revogado():
    reqs = parse_norm(35, LINES)
    assert next(r for r in reqs if r.item == "35.3.1").revoked


def test_item_de_anexo_tem_ref_propria():
    refs = [r.ref for r in parse_norm(35, LINES)]
    assert "NR-35 anexo I item 35.1.1" in refs
    assert len(refs) == len(set(refs))


def test_norma_de_um_digito_usa_zero_a_esquerda():
    reqs = parse_norm(6, ["6.1 Para os fins desta Norma, considera-se EPI todo dispositivo."])
    assert reqs[0].ref == "NR-06 item 6.1"


def test_sumario_com_anexos_antes_do_texto_nao_rotula_itens_principais():
    lines = [
        "SUMÁRIO",
        "ANEXO I - Andaimes",
        "ANEXO II - Plataformas",
        "18.1 Objetivo",
        "18.1.1 Esta Norma estabelece diretrizes.",
    ]
    reqs = parse_norm(18, lines)
    assert [r.ref for r in reqs] == ["NR-18 item 18.1", "NR-18 item 18.1.1"]
