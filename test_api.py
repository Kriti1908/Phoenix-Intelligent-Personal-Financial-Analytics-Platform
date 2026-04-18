
import requests

BASE_URL = "https://localhost"
# We need to skip SSL verification because the cert is self-signed
# We'll use a dummy token or just try to get a 401/404 to see routing
# Better: use the token from the logs if possible, or just check the 307/301 behavior

def test_endpoint(path):
    url = f"{BASE_URL}{path}"
    print(f"Testing {url}...")
    try:
        r = requests.get(url, verify=False, allow_redirects=False)
        print(f"Status: {r.status_code}")
        print(f"Headers: {r.headers}")
        if r.status_code == 200:
            print(f"Body: {r.text[:200]}...")
    except Exception as e:
        print(f"Error: {e}")

test_endpoint("/api/v1/transactions")
test_endpoint("/api/v1/transactions/")
test_endpoint("/api/v1/alerts")
test_endpoint("/api/v1/alerts/")
test_endpoint("/api/v1/dashboard/overview")
