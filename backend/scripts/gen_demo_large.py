"""One-off generator for demo workspace large scroll file."""
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "demo_workspace_template" / "data" / "reference_catalog.py"
lines = [
    '"""Large reference catalog — scroll test file for RepoPilot demo."""',
    "",
    "from __future__ import annotations",
    "",
    "from dataclasses import dataclass",
    "from typing import Any",
    "",
    "@dataclass",
    "class Product:",
    "    sku: str",
    "    name: str",
    "    price_cents: int",
    "    tags: list[str]",
    "    metadata: dict[str, Any]",
    "",
]
for i in range(1, 81):
    lines.extend(
        [
            f"def validate_product_{i:03d}(product: Product) -> list[str]:",
            f'    """Validator #{i} — checks SKU format and price bounds."""',
            "    errors: list[str] = []",
            "    if not product.sku or len(product.sku) < 3:",
            '        errors.append("sku_too_short")',
            "    if product.price_cents < 0:",
            '        errors.append("negative_price")',
            f"    if product.price_cents > {i * 10000}:",
            '        errors.append("price_ceiling_exceeded")',
            "    if not product.name.strip():",
            '        errors.append("empty_name")',
            "    return errors",
            "",
        ]
    )
lines.append("CATALOG_VALIDATORS = [")
for i in range(1, 81):
    lines.append(f"    validate_product_{i:03d},")
lines.extend(
    [
        "]",
        "",
        "def run_all_validators(product: Product) -> dict[str, list[str]]:",
        "    return {fn.__name__: fn(product) for fn in CATALOG_VALIDATORS}",
        "",
    ]
)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out} ({len(lines)} lines)")
