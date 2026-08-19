from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class QualityIssue(BaseModel):
    code: str
    label: str
    detail: str
    resolution: str
    severity: Literal["INFO", "REPAIRED", "QUARANTINED"]
    row_count: int
    samples: list[dict[str, Any]]


class IngestionReport(BaseModel):
    source_file: str
    finished_at: datetime | None
    rows_in: int
    rows_loaded: int
    rows_repaired: int
    rows_quarantined: int
    duration_ms: int | None
    issues: list[QualityIssue]
