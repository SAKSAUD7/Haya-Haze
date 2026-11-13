FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# WeasyPrint (PDF invoices) needs Pango.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libjpeg62-turbo libwebp7 fonts-dejavu-core curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements/ requirements/
RUN pip install -r requirements/prod.txt

COPY . .

# Static files, built for production (hashed names served by WhiteNoise).
RUN DEBUG=False SECRET_KEY=build-only-not-secret-0000000000000000000000000000 \
    python manage.py collectstatic --noinput

# Demo imagery, drawn once at build time into /app/media. `seed_demo` reuses these files
# at runtime, so the demo survives restarts on hosts without a persistent disk.
# Uploads made later in the admin still need a disk or S3 (see README).
RUN DEBUG=True DATABASE_URL=sqlite:////tmp/build-seed.sqlite3 sh -c \
    "python manage.py migrate --noinput >/dev/null && python manage.py seed_demo --no-orders" \
    && rm -f /tmp/build-seed.sqlite3 && rm -rf media/images

EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py boot && gunicorn config.asgi:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 90"]
