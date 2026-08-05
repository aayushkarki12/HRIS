"""add user phone and phone_verified

Revision ID: bcecc5c2f366
Revises: 6ad47c417fcb
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcecc5c2f366'
down_revision: Union[str, Sequence[str], None] = '6ad47c417fcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    users.phone (E.164, nullable - existing accounts have none) and
    users.phone_verified (see app/core/firebase.py and POST /auth/verify-phone).
    Self-registration was removed in the same change, so the invite-
    acceptance flow is now the only place phone gets collected/verified.

    Every account that already exists as of this migration is backfilled to
    phone_verified=True (grandfathered) - forcing every current user
    (including the seeded admin) to re-verify a phone number they've never
    been asked for would lock them out of a live system with no self-service
    way back in. New column default is False, so only accounts created after
    this migration (via the invite-acceptance flow) are actually required to
    verify - see the login check in app/api/v1/auth.py.
    """
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_index("ix_users_phone", "users", ["phone"])
    op.add_column(
        "users",
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE users SET phone_verified = true")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "phone_verified")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "phone")
