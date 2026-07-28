# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/venv

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgl1 \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set work directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8010

# Run the application
# --forwarded-allow-ips is scoped to the loopback address, i.e. only a reverse
# proxy running on the same host is trusted to set X-Forwarded-For/-Proto.
# "*" would let any client forge their source IP, defeating per-IP rate
# limiting and poisoning the audit log's recorded IP - if your reverse proxy
# runs elsewhere, set this to its real IP instead of loopback.
CMD ["uv", "run", "fastapi", "run", "app/main.py", "--workers", "2", "--host", "0.0.0.0", "--port", "8010", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1"]
