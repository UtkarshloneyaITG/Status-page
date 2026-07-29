"""Derive per-day uptime from status-change events.

status_history stores changes, not daily rows. A day's figure is the weighted
downtime across the spans overlapping that day. Maintenance is excluded from
the denominator so a planned window neither inflates nor penalizes the number.

The bar color is the worst status seen in the day, independent of the
percentage: a two-minute major outage colors the day red even though the day is
99.9% up. The bar signals that something happened; the percentage quantifies it.
"""

from datetime import datetime, timedelta

from api.constants import DOWNTIME_WEIGHT, MAINTENANCE, SEVERITY

DAY = timedelta(days=1)


def _spans(events, floor: datetime, ceiling: datetime):
    """Event list to (status, start, end) tuples clipped to [floor, ceiling)."""
    out = []
    for i, event in enumerate(events):
        start = event["created_at"]
        end = events[i + 1]["created_at"] if i + 1 < len(events) else ceiling
        start = max(start, floor)
        end = min(end, ceiling)
        if end > start:
            out.append((event["status"], start, end))
    return out


def compute_days(events, created_at: datetime, now: datetime, days: int = 90):
    """Return `days` day-stat dicts, oldest first, ending on now's date.

    ponytail: re-walks the event list per day, so O(days x events). At 90 days
    and a handful of events that is nothing. If history grows past a few
    thousand events per service, precompute spans once and bucket them by day.
    """
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    first = today - DAY * days

    out = []
    for offset in range(days):
        day_start = first + DAY * offset
        day_end = day_start + DAY
        floor = max(day_start, created_at)
        ceiling = min(day_end, now)

        stat = {
            "date": day_start.date().isoformat(),
            "status": None,
            "uptime": None,
            "incident_id": None,
        }

        if ceiling > floor:
            spans = _spans(events, floor, ceiling)
            if spans:
                stat["status"] = max(
                    (s for s, _, _ in spans), key=lambda s: SEVERITY[s]
                )
                measured = 0.0
                downtime = 0.0
                for status, start, end in spans:
                    if status == MAINTENANCE:
                        continue
                    seconds = (end - start).total_seconds()
                    measured += seconds
                    downtime += seconds * DOWNTIME_WEIGHT[status]
                if measured > 0:
                    stat["uptime"] = round(
                        100.0 * (1.0 - downtime / measured), 4)

        out.append(stat)
    return out


def overall_percent(day_stats):
    """Mean of the days that have data. None when nothing is measurable."""
    measured = [d["uptime"] for d in day_stats if d["uptime"] is not None]
    if not measured:
        return None
    return round(sum(measured) / len(measured), 4)
