from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared rate limiter instance. Imported by main.py (to register with the app)
# and by individual routers (to decorate specific endpoints with @limiter.limit(...)).
limiter = Limiter(key_func=get_remote_address)
