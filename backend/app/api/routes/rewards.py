from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import SessionDep, UserDep
from app.schemas.rewards import (
    BalanceOut,
    ErrorOut,
    RedeemRequest,
    RedeemResponse,
    RedemptionOut,
    RewardOut,
)
from app.services import rewards as service

router = APIRouter(prefix="/api", tags=["rewards"])


@router.get("/wallet/balance", response_model=BalanceOut, summary="Coin balance")
def balance(session: SessionDep, user_id: UserDep) -> BalanceOut:
    """Summed from the append-only ledger on every read."""
    return BalanceOut(**service.get_balance(session, user_id=user_id))


@router.get("/rewards", response_model=list[RewardOut], summary="Rewards catalogue")
def catalogue(session: SessionDep, user_id: UserDep) -> list[RewardOut]:
    return [RewardOut(**reward) for reward in service.list_rewards(session, user_id=user_id)]


@router.get(
    "/rewards/redemptions", response_model=list[RedemptionOut], summary="Redemption history"
)
def history(session: SessionDep, user_id: UserDep) -> list[RedemptionOut]:
    return [RedemptionOut(**row) for row in service.list_history(session, user_id=user_id)]


@router.post(
    "/rewards/redeem",
    response_model=RedeemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Redeem a reward",
    responses={
        404: {"model": ErrorOut, "description": "No such reward"},
        409: {"model": ErrorOut, "description": "Not enough coins, or out of stock"},
    },
)
def redeem(payload: RedeemRequest, session: SessionDep, user_id: UserDep) -> RedeemResponse:
    """Debit coins and issue a voucher.

    Rejects an unknown reward with 404 and an unaffordable one with 409, both
    carrying a machine-readable `code` the UI uses to pick its message. The
    balance check and the ledger write share one locked database transaction,
    so the balance cannot go negative even under concurrent requests.
    """
    result = service.redeem(
        session,
        user_id=user_id,
        reward_slug=payload.reward_slug,
        idempotency_key=payload.idempotency_key,
    )
    return RedeemResponse(**result)
