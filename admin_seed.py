import os
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
from app.core.database import Base

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/hris_db")

def create_admin_user():
    """Create an admin user and employee profile."""
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("Admin user already exists!")
            return
        
        # Create admin user
        hashed_password = get_password_hash("password123")
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=hashed_password,
            first_name="Admin",
            last_name="User",
            role="admin",
            is_active=True
        )
        
        db.add(admin_user)
        db.flush()  # Get the user ID
        
        # Create employee profile for admin
        admin_employee = Employee(
            employee_id="ADMIN001",
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            phone="1234567890",
            department="Administration",
            position="System Administrator",
            joining_date=date.today(),
            is_active=True,
            user_id=admin_user.id
        )
        
        db.add(admin_employee)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully!")
        print(f"📧 Email: admin@example.com")
        print(f"🔑 Password: password123")
        print(f"👤 Username: admin")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()