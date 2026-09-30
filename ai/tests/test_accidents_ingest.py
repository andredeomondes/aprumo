import io
import zipfile

from aprumo_ai.accidents.ingest import count_month

HEADER = ("Agente  Causador  Acidente;Data Acidente;CBO;CBO;CID-10;CID-10;CNAE2.0 Empregador;"
          "CNAE2.0 Empregador;Emitente CAT;Espécie do benefício;Filiação Segurado;Indica Óbito Acidente;"
          "Munic Empr;Natureza da Lesão;Origem de Cadastramento CAT;Parte Corpo Atingida;Sexo;Tipo do Acidente")


def row(cnae: str, tipo: str, obito: str, date: str = "01/06/2026") -> str:
    return f"Queda;{date};1;1;S62;S62;{cnae};Nome;Empregador;Pa;Empregado;{obito};SP;Lesao;Internet;Mao;M;{tipo}"


def zipped(lines: list[str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("D.SDA.PDA.005.CAT.202606.csv", "\n".join([HEADER, *lines]).encode("latin-1"))
        archive.writestr("D.SDA.PDA.005.CAT.202606.json", b"{}")
    return buffer.getvalue()


def test_conta_por_cnae_tipo_e_obito_lendo_so_o_csv():
    data = zipped([
        row("4120", "Típico              ", "Não"),
        row("4120", "Típico", "Sim"),
        row("4120", "Trajeto", "Não"),
        row("8610", "Doença", "Não"),
        row("{ñ class}", "Típico", "Não"),
        row("4120", "Típico", "Não", date="15/03/2026"),
        row("4120", "Típico", "Não", date="00/00/0000"),
    ])
    by_month = count_month(io.BytesIO(data))
    assert by_month["202606"]["4120"] == {"tipico": 2, "trajeto": 1, "doenca": 0, "obitos": 1}
    assert by_month["202606"]["8610"]["doenca"] == 1
    assert by_month["202603"]["4120"]["tipico"] == 1, "conta pelo mês do acidente, não do arquivo"
    assert "{ñ class}" not in by_month["202606"]
    assert set(by_month) == {"202606", "202603"}
