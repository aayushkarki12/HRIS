import math
from typing import Tuple, Optional, List

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points in meters using Haversine formula.
    """
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def get_location_status(
    latitude: float,
    longitude: float,
    tenant,
    work_locations: Optional[List] = None,
) -> Tuple[str, str, Optional[int], Optional[str]]:
    """
    Determine where the employee is clocking in from: the office, a named
    work location (e.g. a warehouse), or working from home.

    Checks the tenant's office first, then each active WorkLocation, and
    picks whichever is closest if the employee is within range of more than
    one. Returns (status, label, work_location_id, location_name) where
    status is 'office', 'site', or 'wfh'.
    """
    candidates = []

    if tenant.office_latitude and tenant.office_longitude:
        distance = calculate_distance(latitude, longitude, tenant.office_latitude, tenant.office_longitude)
        candidates.append({
            "status": "office",
            "name": "Office",
            "id": None,
            "distance": distance,
            "radius": tenant.office_radius or 100,
        })

    for loc in (work_locations or []):
        distance = calculate_distance(latitude, longitude, loc.latitude, loc.longitude)
        candidates.append({
            "status": "site",
            "name": loc.name,
            "id": loc.id,
            "distance": distance,
            "radius": loc.radius or 100,
        })

    in_range = [c for c in candidates if c["distance"] <= c["radius"]]

    if in_range:
        closest = min(in_range, key=lambda c: c["distance"])
        label = f"At {closest['name']} ({closest['distance']:.0f}m away)"
        return closest["status"], label, closest["id"], closest["name"]

    if not candidates:
        return "unknown", "Office location not configured", None, None

    nearest = min(candidates, key=lambda c: c["distance"])
    return "wfh", f"Working from Home ({nearest['distance']:.0f}m from {nearest['name']})", None, None