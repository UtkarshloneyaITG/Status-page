from datetime import datetime, timedelta, timezone

from api.constants import DEGRADED, MAINTENANCE, MAJOR, OPERATIONAL, PARTIAL
from api.uptime import compute_days, overall_percent

DAY = timedelta(days=1)
BIRTH = datetime(2026, 1, 1, tzinfo=timezone.utc)
NOW = datetime(2026, 1, 4, tzinfo=timezone.utc)


def at(day: int, hour: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, tzinfo=timezone.utc)


def test_full_operational_day_is_100_percent():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["date"] == "2026-01-01"
    assert days[0]["status"] == OPERATIONAL
    assert days[0]["uptime"] == 100.0


def test_half_day_major_outage_is_50_percent():
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 50.0
    assert days[0]["status"] == MAJOR


def test_half_day_degraded_is_75_percent():
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": DEGRADED, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 75.0
    assert days[0]["status"] == DEGRADED


def test_full_day_partial_outage_is_25_percent():
    events = [
        {"status": PARTIAL, "created_at": BIRTH},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 25.0


def test_maintenance_is_excluded_from_the_denominator():
    events = [{"status": MAINTENANCE, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["status"] == MAINTENANCE
    assert days[0]["uptime"] is None


def test_maintenance_does_not_dilute_a_real_outage():
    # Half the day is maintenance, the other half is a major outage.
    # The denominator is only the non-maintenance half, so uptime is 0%.
    events = [
        {"status": MAINTENANCE, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 0.0
    assert days[0]["status"] == MAJOR


def test_days_before_creation_have_no_data():
    born = at(2)
    events = [{"status": OPERATIONAL, "created_at": born}]
    days = compute_days(events, born, NOW, days=3)
    assert days[0]["date"] == "2026-01-01"
    assert days[0]["status"] is None
    assert days[0]["uptime"] is None


def test_worst_status_wins_the_day_even_when_brief():
    # Six minutes of major outage still colors the day red.
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": datetime(
            2026, 1, 1, 12, 6, tzinfo=timezone.utc)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["status"] == MAJOR
    assert days[0]["uptime"] > 99.0


def test_returns_the_requested_number_of_days_ending_today():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert [d["date"] for d in days] == [
        "2026-01-01", "2026-01-02", "2026-01-03"]


def test_incident_id_is_present_but_null_this_cycle():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["incident_id"] is None


def test_no_events_at_all_is_all_no_data():
    days = compute_days([], BIRTH, NOW, days=3)
    assert all(d["status"] is None and d["uptime"] is None for d in days)


def test_overall_percent_ignores_no_data_days():
    stats = [
        {"uptime": 100.0},
        {"uptime": None},
        {"uptime": 50.0},
    ]
    assert overall_percent(stats) == 75.0


def test_overall_percent_is_none_when_nothing_measurable():
    assert overall_percent([{"uptime": None}]) is None
