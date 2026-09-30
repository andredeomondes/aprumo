from aprumo_ai.domain import Requirement


def test_ref_sem_anexo():
    r = Requirement(norm="NR-35", item="35.4.5.1", annex=None, text="x", revoked=False)
    assert r.ref == "NR-35 item 35.4.5.1"


def test_ref_com_anexo():
    r = Requirement(norm="NR-12", item="12.1", annex="I", text="x", revoked=False)
    assert r.ref == "NR-12 anexo I item 12.1"


def test_ref_sai_no_json():
    r = Requirement(norm="NR-35", item="35.1", text="x")
    assert r.model_dump()["ref"] == "NR-35 item 35.1"
