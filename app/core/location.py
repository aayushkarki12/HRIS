import math
from typing import Tuple, Optional

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

def get_location_status(latitude: float, longitude: float, tenant) -> Tuple[str, str]:
    """
    Determine if location is office or WFH based on tenant settings.
    Returns (status, location_type) where status is 'office' or 'wfh'
    """
    if not tenant.office_latitude or not tenant.office_longitude:
        return "unknown", "Office location not configured"
    
    distance = calculate_distance(
        latitude, longitude,
        tenant.office_latitude, tenant.office_longitude
    )
    
    if distance <= (tenant.office_radius or 100):
        return "office", f"At Office ({distance:.0f}m from office)"
    else:
        return "wfh", f"Working from Home ({distance:.0f}m from office)"