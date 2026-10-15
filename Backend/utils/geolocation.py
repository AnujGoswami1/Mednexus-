from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
import math

geolocator = Nominatim(user_agent="medlocator", timeout=10)

geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)
reverse = RateLimiter(geolocator.reverse, min_delay_seconds=1)

cache = {}

def geocode_address(address):
    try:
        if address in cache:
            return cache[address]

        location = geocode(address)
        if location:
            result = {
                'latitude': location.latitude,
                'longitude': location.longitude,
                'address': location.address
            }
            cache[address] = result
            return result
    except Exception as e:
        print("Geocoding error:", e)

    return None


def reverse_geocode(lat, lng):
    try:
        location = reverse((lat, lng))
        if location:
            return location.address
    except Exception as e:
        print("Reverse geocoding error:", e)

    return None


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c