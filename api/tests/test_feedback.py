import pytest

from api.constants import FB_FIXED, FB_IN_PROGRESS, FB_NEW
from api.tests.conftest import login, needs_mongo

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def clear_rate_limit():
    """Each test starts with a fresh limiter, since it is process-global."""
    from api.feedback import _submissions

    _submissions.clear()
    yield
    _submissions.clear()


def report(**overrides):
    body = {
        "type": "issue",
        "title": "Checkout button does nothing",
        "description": "Clicking Pay produces no response on Firefox.",
    }
    body.update(overrides)
    return body


@needs_mongo
async def test_anyone_can_submit_without_logging_in(client, db):
    res = await client.post("/api/v1/feedback", json=report())
    assert res.status_code == 201, res.text
    ref = res.json()["ref_code"]
    assert ref.startswith("RPT-") and len(ref) == 8

    doc = await db.feedback.find_one({"ref_code": ref})
    assert doc["status"] == FB_NEW
    assert doc["is_public"] is False, "nothing is public until an admin says so"


@needs_mongo
async def test_suggestions_are_accepted_too(client, db):
    res = await client.post(
        "/api/v1/feedback",
        json=report(type="suggestion", title="Add a dark mode toggle"),
    )
    assert res.status_code == 201
    doc = await db.feedback.find_one({"ref_code": res.json()["ref_code"]})
    assert doc["type"] == "suggestion"


@needs_mongo
async def test_unknown_type_is_rejected(client, db):
    res = await client.post("/api/v1/feedback", json=report(type="complaint"))
    assert res.status_code == 422


@needs_mongo
async def test_over_length_fields_are_rejected(client, db):
    assert (
        await client.post("/api/v1/feedback", json=report(title="x" * 121))
    ).status_code == 422
    assert (
        await client.post("/api/v1/feedback", json=report(description="x" * 2001))
    ).status_code == 422


@needs_mongo
async def test_honeypot_looks_accepted_but_stores_nothing(client, db):
    res = await client.post(
        "/api/v1/feedback", json=report(website="http://spam.example")
    )
    assert res.status_code == 201
    assert res.json()["ref_code"].startswith("RPT-")
    assert await db.feedback.count_documents({}) == 0


@needs_mongo
async def test_fourth_submission_within_the_hour_is_rate_limited(client, db):
    for _ in range(3):
        assert (
            await client.post("/api/v1/feedback", json=report())
        ).status_code == 201
    res = await client.post("/api/v1/feedback", json=report())
    assert res.status_code == 429
    assert await db.feedback.count_documents({}) == 3


@needs_mongo
async def test_new_reports_are_absent_from_the_public_log(client, db):
    await client.post("/api/v1/feedback", json=report())
    body = (await client.get("/api/v1/feedback")).json()
    assert body["items"] == []


@needs_mongo
async def test_marking_fixed_publishes_it_to_the_status_page(
    client, db, owner
):
    ref = (
        await client.post("/api/v1/feedback", json=report())
    ).json()["ref_code"]

    await login(client, owner)
    res = await client.patch(
        f"/api/v1/admin/feedback/{ref}",
        json={"status": FB_FIXED, "admin_reply": "Fixed in today's release."},
    )
    assert res.status_code == 200

    body = (await client.get("/api/v1/feedback")).json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["ref_code"] == ref
    assert item["status"] == FB_FIXED
    assert item["admin_reply"] == "Fixed in today's release."
    assert item["resolved_at"] is not None


@needs_mongo
async def test_moving_off_fixed_clears_the_resolved_timestamp(
    client, db, owner
):
    ref = (
        await client.post("/api/v1/feedback", json=report())
    ).json()["ref_code"]
    await login(client, owner)
    await client.patch(f"/api/v1/admin/feedback/{ref}", json={"status": FB_FIXED})
    await client.patch(
        f"/api/v1/admin/feedback/{ref}", json={"status": FB_IN_PROGRESS}
    )

    doc = await db.feedback.find_one({"ref_code": ref})
    assert doc["resolved_at"] is None


@needs_mongo
async def test_public_log_never_leaks_reporter_email_or_internal_notes(
    client, db, owner
):
    ref = (
        await client.post(
            "/api/v1/feedback",
            json=report(reporter_email="reporter@example.com"),
        )
    ).json()["ref_code"]

    await login(client, owner)
    await client.patch(
        f"/api/v1/admin/feedback/{ref}",
        json={"status": FB_FIXED, "internal_note": "caused by a bad deploy"},
    )
    await client.post("/api/v1/auth/logout")

    text = (await client.get("/api/v1/feedback")).text
    assert "reporter@example.com" not in text
    assert "bad deploy" not in text


@needs_mongo
async def test_inbox_defaults_to_new_and_reports_counts(client, db, owner):
    first = (await client.post("/api/v1/feedback", json=report())).json()[
        "ref_code"
    ]
    (await client.post("/api/v1/feedback", json=report(title="Second"))).json()

    await login(client, owner)
    await client.patch(
        f"/api/v1/admin/feedback/{first}", json={"status": FB_FIXED}
    )

    body = (await client.get("/api/v1/admin/feedback")).json()
    assert [i["title"] for i in body["items"]] == ["Second"]
    assert body["counts"][FB_NEW] == 1
    assert body["counts"][FB_FIXED] == 1

    every = (await client.get("/api/v1/admin/feedback?status=all")).json()
    assert len(every["items"]) == 2


@needs_mongo
async def test_admin_sees_the_reporter_email(client, db, owner):
    await client.post(
        "/api/v1/feedback", json=report(reporter_email="reporter@example.com")
    )
    await login(client, owner)
    body = (await client.get("/api/v1/admin/feedback")).json()
    assert body["items"][0]["reporter_email"] == "reporter@example.com"


@needs_mongo
async def test_bulk_marks_several_fixed_at_once(client, db, owner):
    refs = [
        (
            await client.post("/api/v1/feedback", json=report(title=f"R{i}"))
        ).json()["ref_code"]
        for i in range(3)
    ]
    await login(client, owner)
    res = await client.post(
        "/api/v1/admin/feedback/bulk",
        json={"ref_codes": refs, "status": FB_FIXED},
    )
    assert res.json()["updated"] == 3
    assert len((await client.get("/api/v1/feedback")).json()["items"]) == 3


@needs_mongo
async def test_triage_requires_a_session(client, db):
    ref = (
        await client.post("/api/v1/feedback", json=report())
    ).json()["ref_code"]
    assert (await client.get("/api/v1/admin/feedback")).status_code == 401
    assert (
        await client.patch(
            f"/api/v1/admin/feedback/{ref}", json={"status": FB_FIXED}
        )
    ).status_code == 401


@needs_mongo
async def test_unknown_ref_is_404(client, db, owner):
    await login(client, owner)
    res = await client.patch(
        "/api/v1/admin/feedback/RPT-0000", json={"status": FB_FIXED}
    )
    assert res.status_code == 404
