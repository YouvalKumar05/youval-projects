from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hash_in_db = "$2b$12$R9h/LIPzHsGCETv7yY3.L.9sCInZ6s.tP/O8aWfIOf8O23Z1Zf1Zq"
password_to_test = "admin123"

is_correct = pwd_context.verify(password_to_test, hash_in_db)
print(f"Password 'admin123' is correct: {is_correct}")
