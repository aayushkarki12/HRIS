import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, inspect
from sqlalchemy import pool

from alembic import context

# Make the `app` package importable when alembic is run from the backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import Base
from app.core.config import settings
import app.models  # noqa: F401 - imports every model so Base.metadata is fully populated

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Use the real database URL from settings/.env instead of alembic.ini.
# configparser treats % as interpolation syntax, so a URL-encoded password
# (e.g. %40 for @) must have its % doubled before being stored as a config value.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _check_metadata_is_complete(connection) -> None:
    """
    Guard against a repeat of a real incident: app/models/__init__.py silently lost
    most of its imports, so Base.metadata only knew about 15 of the app's 39 tables.
    `alembic revision --autogenerate` then read the "missing" 24 tables as "detected
    removed table" and would have generated a migration dropping every one of them -
    tables that in fact existed in the live database with real data. That migration
    was caught by hand before being applied, but autogenerate should never be able to
    produce a mass-drop migration just because an import got lost - so this runs
    automatically before every autogenerate and refuses to proceed if it would.

    Compares the live database's actual tables against everything registered on
    Base.metadata (i.e. everything `import app.models` pulled in). Any DB table not
    present in metadata means a model isn't wired into app/models/__init__.py -
    autogenerate would misread that as "this table should be dropped".
    """
    inspector = inspect(connection)
    db_tables = set(inspector.get_table_names()) - {"alembic_version"}
    known_tables = set(target_metadata.tables.keys())
    missing = db_tables - known_tables

    if missing:
        raise SystemExit(
            "\nRefusing to autogenerate: the live database has tables that aren't "
            "registered on Base.metadata, which means `import app.models` isn't "
            "picking up every model (check app/models/__init__.py for a missing "
            "import).\n\n"
            f"Tables in the database but not in Base.metadata: {sorted(missing)}\n\n"
            "Autogenerate would read every one of those as 'detected removed table' "
            "and write a migration that drops them. Fix the import gap first, then "
            "confirm with:\n"
            "  python -c \"import app.models; from app.core.database import Base; "
            "print(len(Base.metadata.tables))\"\n"
        )


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Only relevant when generating a migration by diffing against metadata -
        # a plain `upgrade`/`downgrade` run doesn't compare against Base.metadata
        # at all, so there's nothing for a missing import to corrupt there.
        if getattr(config.cmd_opts, "autogenerate", False):
            _check_metadata_is_complete(connection)

        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
