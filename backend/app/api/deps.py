"""Request-scoped dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_session

SessionDep = Annotated[Session, Depends(get_session)]


def current_user_id(session: SessionDep) -> int:
    """The demo user.

    There is no auth in this build (see ASSUMPTIONS.md). Every query is still
    scoped by user_id rather than reading the whole table, so adding real
    auth later means changing this one function and nothing else.
    """
    user_id = session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": settings.demo_user_email},
    ).scalar_one_or_none()
    if user_id is None:
        raise HTTPException(
            status_code=503,
            detail="Database has not been seeded. Run: python -m app.seed.run",
        )
    return user_id


UserDep = Annotated[int, Depends(current_user_id)]
