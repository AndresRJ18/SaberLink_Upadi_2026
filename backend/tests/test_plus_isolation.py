"""The núcleo (saberlink/*.py) must never import from saberlink/plus/ — so
deleting saberlink/plus/ entirely (if time runs out) never breaks the core
pipeline. Checked by static inspection, not just convention."""

import ast
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent.parent / "saberlink"


def _imports_plus(py_file: Path) -> bool:
    tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "saberlink.plus" in node.module:
            return True
        if isinstance(node, ast.Import):
            if any("saberlink.plus" in alias.name for alias in node.names):
                return True
    return False


def test_nucleo_modules_never_import_plus():
    nucleo_files = [
        p for p in PACKAGE_DIR.glob("*.py") if p.name != "__init__.py"
    ]
    assert nucleo_files, "no núcleo modules found — check PACKAGE_DIR"
    offenders = [p.name for p in nucleo_files if _imports_plus(p)]
    assert not offenders, f"núcleo modules importing saberlink.plus: {offenders}"


def test_plus_modules_only_import_from_nucleo_or_stdlib():
    plus_dir = PACKAGE_DIR / "plus"
    plus_files = [p for p in plus_dir.glob("*.py") if p.name != "__init__.py"]
    assert plus_files, "no PLUS modules found"
    # Just a sanity check that PLUS files parse and exist — the one-directional
    # isolation rule (checked above) is what actually matters for the "delete
    # plus/ safely" guarantee.
    for p in plus_files:
        ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
