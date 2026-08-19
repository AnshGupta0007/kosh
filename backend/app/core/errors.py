"""Domain errors.

Services raise these; a single exception handler in main.py turns them into
the JSON error shape the frontend expects. Routes never build error bodies
by hand, so every error response looks the same.
"""

from __future__ import annotations


class DomainError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str, detail: dict | None = None):
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class RewardNotFound(DomainError):
    status_code = 404
    code = "REWARD_NOT_FOUND"


class InsufficientCoins(DomainError):
    # 409, not 400: the request is well-formed, it conflicts with the current
    # balance. A client can retry it verbatim once the balance grows.
    status_code = 409
    code = "INSUFFICIENT_COINS"


class RewardUnavailable(DomainError):
    status_code = 409
    code = "REWARD_UNAVAILABLE"


class TransactionNotFound(DomainError):
    status_code = 404
    code = "TRANSACTION_NOT_FOUND"
