"""Kosh API — FastAPI application factory and error handling."""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analytics, meta, rewards, transactions
from app.core.config import settings
from app.core.errors import DomainError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("kosh")

app = FastAPI(
    title="Kosh API",
    version="1.0.0",
    description=(
        "Transactions, spend analytics and coin rewards for the Kosh demo app.\n\n"
        "Filtering, sorting and pagination are done in PostgreSQL — the client "
        "never receives all 10,000 rows."
    ),
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.vercel\.app",  # preview deployments
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Query-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    """One place that turns a domain error into the API's error shape."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message, "detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "Something went wrong on our side.",
            "detail": {},
        },
    )


app.include_router(meta.router)
app.include_router(transactions.router)
app.include_router(analytics.router)
app.include_router(rewards.router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": "kosh-api", "docs": "/docs", "health": "/api/health"}
