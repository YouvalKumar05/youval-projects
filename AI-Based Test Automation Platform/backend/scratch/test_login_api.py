import requests

def test_login():
    url = "http://localhost:8000/api/auth/login"
    payload = {
        "username": "admin@autoqa.local",
        "password": "admin123"
    }
    # OAuth2PasswordRequestForm expects form-data
    response = requests.post(url, data=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")

if __name__ == "__main__":
    test_login()
