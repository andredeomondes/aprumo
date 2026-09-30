from aprumo_ai.evaluation.__main__ import parse_floors, score


def test_score_micro():
    precision, recall, f1 = score([({"NR-10", "NR-12"}, {"NR-10"}), ({"NR-35"}, {"NR-35", "NR-10"})])
    assert (round(precision, 2), round(recall, 2)) == (0.67, 0.67)
    assert round(f1, 2) == 0.67


def test_parse_floors():
    assert parse_floors(["--no-llm", "--min-f1", "bm25+regras=0.80"]) == {"bm25+regras": 0.80}
    assert parse_floors(["--no-llm"]) == {}
