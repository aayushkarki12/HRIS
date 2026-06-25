from app.core.security import get_password_hash

# Generate hash for 'password123'
password = "password123"
hashed = get_password_hash(password)
print(f"Password: {password}")
print(f"Hash: {hashed}")