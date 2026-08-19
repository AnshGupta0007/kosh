# Kosh API.
#
# Build from the REPOSITORY ROOT so the dataset is inside the build context:
#   docker build -f backend/Dockerfile -t kosh-api .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first, so a code change does not reinstall the world.
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .

COPY backend/app ./app
# The dataset ships with the image, so the hosted database can be seeded with
# a one-off `python -m app.seed.run` from the platform's shell.
COPY data /data

EXPOSE 8000

# $PORT is what Render, Railway and Fly all inject.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
