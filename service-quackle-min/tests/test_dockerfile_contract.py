from pathlib import Path


PINNED_QUACKLE_COMMIT = "d280e6760f06b52dd8b8baf18c9bf152492c230d"


def test_quackle_source_is_pinned_to_a_commit():
    dockerfile = (Path(__file__).parents[1] / "Dockerfile").read_text(encoding="utf-8")

    assert f"ARG QUACKLE_REPO_REF={PINNED_QUACKLE_COMMIT}" in dockerfile
    assert "ARG QUACKLE_REPO_REF=master" not in dockerfile
    assert "git checkout --detach" in dockerfile
    assert "git rev-parse HEAD" in dockerfile
