# Kosh — one-command setup.
#
#   make setup   database + schema + data + dependencies, from nothing
#   make dev     run the API and the web app together
#
# Everything below assumes Docker (for PostgreSQL 18), Python 3.11+ and
# Node 20+. Nothing else.

SHELL := /bin/bash
PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip

.PHONY: help setup db seed api web dev test lint clean reset

help:
	@echo ""
	@echo "  make setup   Start Postgres 18, install deps, create the schema, load the data"
	@echo "  make dev     Run the API (:8000) and the web app (:3000)"
	@echo "  make seed    Re-create the schema and reload transactions.json"
	@echo "  make test    Run the backend test suite"
	@echo "  make reset   Tear the database down and rebuild it from scratch"
	@echo ""

## Start PostgreSQL 18 and wait until it is actually accepting connections.
db:
	docker compose up -d
	@echo "waiting for PostgreSQL…"
	@until docker compose exec -T db pg_isready -U kosh -d kosh >/dev/null 2>&1; do sleep 1; done
	@echo "PostgreSQL 18 ready on localhost:5433"

## Full first-time setup.
setup: db
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp .env.example backend/.env
	@test -f frontend/.env.local || cp frontend/.env.local.example frontend/.env.local
	python3 -m venv backend/.venv 2>/dev/null || true
	$(PIP) install -q -e "./backend[dev]"
	cd frontend && npm install
	$(MAKE) seed
	@echo ""
	@echo "Setup complete. Run: make dev"

## Create the schema and load the dataset. Safe to re-run.
seed:
	cd backend && ../$(PY) -m app.seed.run

api:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

## Run both, and stop both when you Ctrl-C.
dev:
	@trap 'kill 0' EXIT; \
	$(MAKE) api & \
	$(MAKE) web & \
	wait

test:
	cd backend && .venv/bin/python -m pytest

lint:
	cd backend && .venv/bin/ruff check app tests
	cd frontend && npm run typecheck && npm run lint

## Destroy the database volume and rebuild everything.
reset:
	docker compose down -v
	$(MAKE) db
	$(MAKE) seed

clean:
	rm -rf backend/.venv frontend/node_modules frontend/.next
