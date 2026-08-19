"""The list endpoint: filters combine, sorting is stable, paging is honest."""

from __future__ import annotations


def items(client, query: str = ""):
    return client.get(f"/api/transactions{query}").json()


def test_lists_every_row_by_default(client):
    body = items(client)
    assert body["meta"]["total"] == 6
    assert body["items"][0]["occurred_at"] > body["items"][-1]["occurred_at"]


def test_filters_combine_rather_than_replace_each_other(client):
    body = items(client, "?category=Travel&status=SUCCESS")

    assert body["meta"]["total"] == 1
    assert body["items"][0]["merchant"] == "IndiGo"
    assert body["items"][0]["status"] == "SUCCESS"


def test_search_matches_merchant_substring_case_insensitively(client):
    assert items(client, "?search=swig")["meta"]["total"] == 2
    assert items(client, "?search=SWIG")["meta"]["total"] == 2
    assert items(client, "?search=nothing-here")["meta"]["total"] == 0


def test_amount_filter_compares_magnitude_so_refunds_are_findable(client):
    """A ₹500 refund should be found by a "₹400 to ₹600" filter."""
    body = items(client, "?min_amount=400&max_amount=600")

    amounts = sorted(row["amount_paise"] for row in body["items"])
    assert amounts == [-50000, 45000]


def test_sorting_by_amount_uses_magnitude(client):
    body = items(client, "?sort=amount&order=desc&page_size=1")
    assert body["items"][0]["amount_paise"] == 1250000


def test_paging_reports_totals_for_the_whole_filtered_set(client):
    body = items(client, "?page_size=2&page=2")

    assert body["meta"] == {
        "page": 2,
        "page_size": 2,
        "total": 6,
        "total_pages": 3,
        "has_next": True,
        "has_previous": True,
    }
    assert len(body["items"]) == 2


def test_detail_includes_the_untouched_source_row(client):
    listed = items(client)["items"][0]
    detail = client.get(f"/api/transactions/{listed['id']}").json()

    assert detail["id"] == listed["id"]
    assert "source_row" in detail


def test_missing_transaction_is_a_404(client):
    response = client.get("/api/transactions/999999")
    assert response.status_code == 404
    assert response.json()["code"] == "TRANSACTION_NOT_FOUND"


def test_analytics_and_table_agree_on_the_same_filters(client):
    """Cross-filtering is only trustworthy if both endpoints filter alike."""
    query = "?category=Travel"
    table = client.get(f"/api/transactions{query}").json()
    analytics = client.get(f"/api/analytics{query}").json()

    assert analytics["kpis"]["transaction_count"] == table["meta"]["total"]
    assert analytics["kpis"]["total_spend_paise"] == table["filtered_total_paise"]
