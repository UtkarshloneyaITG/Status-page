"""Response models. These define the contract the frontend renders against."""

from pydantic import BaseModel


class Day(BaseModel):
    date: str
    status: str | None
    uptime: float | None
    # Always None this cycle. Present so the shape does not change when
    # incidents land in the next cycle.
    incident_id: str | None


class Service(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    uptime_percent: float | None
    days: list[Day]


class Group(BaseModel):
    id: str
    name: str
    services: list[Service]


class Indicator(BaseModel):
    level: str
    text: str


class Summary(BaseModel):
    product_name: str
    updated_at: str
    indicator: Indicator
    groups: list[Group]
    ungrouped: list[Service]
