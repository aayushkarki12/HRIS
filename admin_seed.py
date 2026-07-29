import os
import secrets
import sys
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import get_password_hash
from app.models.user import User
from app.models.employee import Employee
from app.models.tenant import Tenant
from app.core.database import Base

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/hris_db")

# tenant_id is NOT NULL on both User and Employee, so a tenant has to exist
# first - this used to be missing entirely, which meant this script threw an
# IntegrityError against any schema created after the tenant model landed.
TENANT_NAME = os.getenv("ADMIN_SEED_TENANT_NAME", "Cantor Dust")
TENANT_SUBDOMAIN = os.getenv("ADMIN_SEED_TENANT_SUBDOMAIN", "default")
ADMIN_USERNAME = os.getenv("ADMIN_SEED_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_SEED_EMAIL", "admin@default.com")


def create_admin_user():
    """Create the tenant (if needed) plus an admin user and employee profile."""
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        tenant = db.query(Tenant).filter(Tenant.subdomain == TENANT_SUBDOMAIN).first()
        if not tenant:
            tenant = Tenant(
                name=TENANT_NAME,
                subdomain=TENANT_SUBDOMAIN,
                email=ADMIN_EMAIL,
                is_active=True,
            )
            db.add(tenant)
            db.flush()
            print(f"✅ Created tenant '{tenant.name}' (subdomain: {tenant.subdomain})")

        existing_admin = db.query(User).filter(
            User.username == ADMIN_USERNAME, User.tenant_id == tenant.id
        ).first()
        if existing_admin:
            print("Admin user already exists for this tenant!")
            return

        # Never hardcode a known password in a script that can run against a
        # real database - take it from the environment, or generate a random
        # one and print it once so it isn't silently a fixed, guessable value.
        password = os.getenv("ADMIN_SEED_PASSWORD")
        generated = password is None
        if generated:
            password = secrets.token_urlsafe(12)

        hashed_password = get_password_hash(password)
        admin_user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hashed_password,
            first_name="System",
            last_name="Admin",
            role="admin",
            is_active=True,
            tenant_id=tenant.id,
        )

        db.add(admin_user)
        db.flush()  # Get the user ID

        # Create employee profile for admin
        admin_employee = Employee(
            employee_id="ADMIN001",
            first_name="System",
            last_name="Admin",
            email=ADMIN_EMAIL,
            phone="1234567890",
            department="Administration",
            position="System Administrator",
            joining_date=date.today(),
            is_active=True,
            user_id=admin_user.id,
            tenant_id=tenant.id,
        )

        db.add(admin_employee)
        db.commit()
        db.refresh(admin_user)

        print("✅ Admin user created successfully!")
        print(f"📧 Email: {ADMIN_EMAIL}")
        print(f"👤 Username: {ADMIN_USERNAME}")
        print(f"🏢 Tenant subdomain: {TENANT_SUBDOMAIN}")
        if generated:
            print(f"🔑 Password (generated, shown once): {password}")
        else:
            print("🔑 Password: (from ADMIN_SEED_PASSWORD)")

    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()