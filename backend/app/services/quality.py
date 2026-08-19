"""Reads back the ingestion report the seed loader wrote."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def latest_report(session: Session) -> dict[str, Any] | None:
    run = session.execute(
        text(
            """
            SELECT id, source_file, finished_at, rows_in, rows_loaded,
                   rows_repaired, rows_quarantined, duration_ms
            FROM ingestion_runs
            ORDER BY id DESC
            LIMIT 1
            """
        )
    ).mappings().one_or_none()
    if run is None:
        return None

    issues = session.execute(
        text(
            """
            SELECT code, label, detail, resolution, severity::text AS severity,
                   row_count, samples
            FROM data_quality_issues
            WHERE run_id = :run_id
            ORDER BY row_count DESC
            """
        ),
        {"run_id": run["id"]},
    ).mappings().all()

    return {**dict(run), "issues": [dict(i) for i in issues]}
