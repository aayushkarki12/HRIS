import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """
    Configure root logging once at app startup. Every module then does
    `logger = logging.getLogger(__name__)` and gets consistent formatting,
    timestamps, and severity levels instead of bare print() statements that
    are unstructured and easy to lose in production.
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )
    # Quiet down noisy third-party loggers unless something's actually wrong.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
