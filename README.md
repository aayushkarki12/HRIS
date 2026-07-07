# HRIS / ERP Backend

FastAPI backend for the HRIS → ERP platform: HR, Projects, Finance & Accounting, Inventory, and Budget Planning, built as one multi-tenant service with a shared double-entry ledger underneath.

This repo contains **only the backend**. It serves a REST API consumed by a separate frontend — see the [companion frontend repo](https://github.com/Cantor-Dust-Analytics/HRIS_frontend).

- **Framework:** FastAPI + SQLAlchemy + Alembic
- **Database:** PostgreSQL (targets Supabase-hosted Postgres, but any Postgres works)
- **Auth:** JWT (access + refresh tokens), role-based access (`admin` / `manager` / `employee`)
- **Multi-tenancy:** every table is scoped by `tenant_id`; every request carries an `X-Tenant-ID` header

---

## Table of Contents

- [Architecture](#architecture)
- [Domain Modules](#domain-modules)
- [Key Design Patterns](#key-design-patterns)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)

---

## Architecture

### Request flow

```mermaid
flowchart LR
    Client["Client\n(frontend or any API consumer)"]

    subgraph API["FastAPI App"]
        MW["Middleware\nCORS · Rate limiting"]
        Deps["Dependencies\nget_current_user · get_current_tenant · role guards"]
        Routers["Routers (app/api/v1/*.py)\nthin — HTTP concerns only"]
        Services["Service layer (app/core/*_service.py)\nbusiness rules, ledger posting, costing, workflow"]
        Models["SQLAlchemy Models (app/models/*.py)"]
    end

    DB[("PostgreSQL")]
    FS[("Local file storage\n(uploads: avatars, documents)")]

    Client -- "JSON + JWT + X-Tenant-ID" --> MW --> Deps --> Routers --> Services --> Models --> DB
    Routers -. static file serving .-> FS
```

**Thin routers, fat services:** every file in `app/api/v1/` parses the request, resolves the current user/tenant through FastAPI dependencies, and delegates to `app/core/*_service.py`. Business logic — ledger posting, inventory costing, budget variance, approval workflows — lives in exactly one place per domain, not scattered across endpoint handlers.

### Multi-tenancy & auth

```mermaid
sequenceDiagram
    participant Client
    participant FastAPI
    participant Dependency as get_current_tenant / get_current_user
    participant DB as PostgreSQL

    Client->>FastAPI: Request + Authorization: Bearer <JWT> + X-Tenant-ID
    FastAPI->>Dependency: resolve tenant + user
    Dependency->>DB: SELECT tenant WHERE id = X-Tenant-ID
    Dependency->>DB: decode JWT -> SELECT user WHERE id = sub
    Dependency-->>FastAPI: (user, tenant) or 401/403
    FastAPI->>DB: every query filtered by tenant_id
    DB-->>FastAPI: tenant-scoped rows only
    FastAPI-->>Client: JSON response
```

Every model carries a `tenant_id` foreign key, and every service-layer query filters on it explicitly — there is no implicit global query scope, so a missing filter fails loudly (empty result) instead of silently leaking cross-tenant data.

### Domain module map

```mermaid
flowchart TB
    subgraph HR["HR"]
        Employees --> Attendance
        Employees --> Leave
        Employees --> Documents
    end

    subgraph PM["Project Management"]
        Projects --> Assignments
        Projects --> Resources
        Projects --> Timesheets
    end

    subgraph Finance["Finance & Accounting"]
        Ledger["Chart of Accounts /\nJournal Entries"]
        Vouchers["Vouchers\n(thin envelope over Journal Entries)"]
        Payroll
        Invoices["Invoices & Payments"]
        Expenses["Expense Claims"]
        BankRecon["Bank Reconciliation"]
        Vouchers --> Ledger
        Payroll --> Ledger
        Invoices --> Ledger
        Expenses --> Ledger
    end

    subgraph Inventory["Inventory"]
        Items --> StockMovements["Stock Movements\n(weighted-avg costing)"]
        StockMovements -. optional auto-post .-> Vouchers
    end

    subgraph Planning["Budget Planning"]
        Budgets["Budgets & Periods"]
        Budgets -. reads actuals from .-> Ledger
        Budgets -. reads actuals from .-> Invoices
        Budgets -. reads actuals from .-> Expenses
    end

    subgraph Cross["Cross-cutting"]
        AuditLog["Audit Trail"]
        Notifications
    end

    Employees -.-> AuditLog
    Ledger -.-> AuditLog
    Budgets -.-> AuditLog
```

Budgets deliberately have **no stored "actual" column** — `app/core/budget_service.py` computes actuals on read from whichever ledger already represents ground truth for that scope (posted journal lines for company/cost-center budgets, invoices for project budgets, expense claims for employee budgets), so there's exactly one source of truth for "what was really spent."

---

## Domain Modules

| Module | Key tables | Notes |
|---|---|---|
| HR (Employees, Leave, Attendance, Documents) | `employees`, `leaves`, `attendance`, `documents` | Core HRIS functionality |
| Projects (Projects, Assignments, Resources, Timesheets) | `projects`, `assignments`, `resources`, `timesheets` | Resource allocation across projects |
| Accounting (Chart of Accounts, Journal Entries, Vouchers, Ledger Groups, Cost Centers, Tax) | `accounts`, `journal_entries`, `vouchers`, `ledger_groups`, `cost_centers`, `tax_rates` | Double-entry engine; vouchers are a thin UI/workflow envelope over journal entries |
| Payroll | `salary_structures`, `payroll_runs`, `payslips` | Posts to the same ledger as everything else |
| Invoices & Payments | `invoices`, `invoice_lines`, `payments` | AR side of accounting |
| Expense Claims | `expense_claims`, `expense_claim_lines` | AP side; feeds employee-scoped budgets |
| Bank Reconciliation | `bank_reconciliations` | Matches ledger to bank statements |
| Inventory | `warehouses`, `items`, `stock_movements`, `suppliers` | Weighted-average costing, optional auto-posting to vouchers |
| Budget Planning | `budgets`, `budget_periods` | Company/cost-center/project/employee scopes, actuals computed live, submit→approve/reject workflow |
| Audit Trail | `audit_logs` | IP/user-agent/severity, module-based filtering, CSV export |

---

## Key Design Patterns

- **Thin routers, fat services** — `app/api/v1/*.py` only handles HTTP concerns; business rules live in `app/core/*_service.py`.
- **Ledger is the single source of truth** — Inventory and Budgets never duplicate financial state; they read or post through the existing `JournalEntry`/`Voucher` engine.
- **Vouchers as an envelope, not a parallel ledger** — a `Voucher` wraps a `JournalEntry` for UI/workflow purposes (numbering, status, attachments) without introducing a second accounting model.
- **Weighted-average inventory costing** — `StockMovement` rows are append-only and carry a running quantity/average cost computed at write time, so historical costing never needs to be recomputed.
- **Migration safety guard** — `alembic/env.py` refuses to `--autogenerate` if `Base.metadata` doesn't account for every live table (protects against a broken `app/models/__init__.py` import silently producing a mass `DROP TABLE` migration). Run:
  ```bash
  python -c "import app.models; from app.core.database import Base; print(len(Base.metadata.tables))"
  ```
  before trusting any autogenerated migration.
- **Audit logging as a cross-cutting concern** — `record_audit_log()` is called from services (not routers) for every create/update/approve/reject action, capturing actor, IP, user-agent, and severity.

---

## Project Structure

```
.
├── alembic/
│   ├── env.py                 # migration runner + safety guard
│   └── versions/              # migration history
├── app/
│   ├── api/
│   │   └── v1/                # thin HTTP routers, one file per domain
│   ├── core/                  # service layer, auth, db session, audit
│   │   ├── database.py
│   │   ├── dependencies.py    # get_current_user / get_current_tenant / role guards
│   │   ├── audit.py
│   │   └── *_service.py       # business logic per domain
│   ├── models/                # SQLAlchemy models, one file per domain
│   ├── schemas/                # Pydantic request/response schemas
│   └── main.py                # app assembly, router registration, CORS
├── requirements.txt
└── alembic.ini
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- A PostgreSQL database

### Setup

```bash
python -m venv .venv
./.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

cp .env.example .env            # fill in real values, see below

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Interactive API docs available at `http://localhost:8000/docs` once running.

---

## Environment Variables

`.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SECRET_KEY` | JWT signing key — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | JWT signing algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins — no wildcard in production |
| `RESEND_API_KEY` | Transactional email (password reset links, notifications) via [Resend](https://resend.com) |
| `RESEND_FROM_EMAIL` | From-address for transactional email |
| `FRONTEND_URL` | Base URL of the frontend, used to build links in emails |

---

## Database Migrations

```bash
# generate a migration after changing models
alembic revision --autogenerate -m "describe the change"

# ALWAYS review the generated file before applying —
# the safety guard in alembic/env.py will refuse to run if it detects
# tables in the database that aren't registered on Base.metadata
alembic upgrade head
```
