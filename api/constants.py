"""Status vocabulary shared by every module. One source of truth."""

OPERATIONAL = "operational"
DEGRADED = "degraded_performance"
PARTIAL = "partial_outage"
MAJOR = "major_outage"
MAINTENANCE = "maintenance"

STATUSES = [OPERATIONAL, DEGRADED, PARTIAL, MAJOR, MAINTENANCE]

# Higher wins when picking the "worst" status. A major outage outranks a
# concurrent maintenance window, so maintenance sits below the real failures.
SEVERITY = {
    OPERATIONAL: 0,
    MAINTENANCE: 1,
    DEGRADED: 2,
    PARTIAL: 3,
    MAJOR: 4,
}

# Fraction of a span that counts as downtime. Maintenance has no entry: it is
# excluded from the denominator rather than weighted.
DOWNTIME_WEIGHT = {
    OPERATIONAL: 0.0,
    DEGRADED: 0.5,
    PARTIAL: 0.75,
    MAJOR: 1.0,
}

BANNER = {
    OPERATIONAL: "All Systems Operational",
    MAINTENANCE: "Scheduled Maintenance in Progress",
    DEGRADED: "Degraded Performance",
    PARTIAL: "Partial System Outage",
    MAJOR: "Major System Outage",
}
