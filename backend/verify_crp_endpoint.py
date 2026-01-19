import requests
import json

def test_validate_crp_endpoint():
    url = "http://localhost:8000/api/validate-crp"
    
    # Test cases
    test_cases = [
        {"name": "Valid CRP (Isa Letícia)", "crp": "04/44606"},
        {"name": "Invalid Região", "crp": "99/44606"},
        {"name": "Invalid Format", "crp": "invalid-crp"},
        {"name": "Empty CRP", "crp": ""}
    ]
    
    print(f"Testing Endpoint: {url}\n")
    
    for case in test_cases:
        print(f"--- Case: {case['name']} ---")
        payload = {"crp": case["crp"]}
        try:
            response = requests.post(url, json=payload, timeout=5)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        except Exception as e:
            print(f"Error: {e}")
        print("\n")

if __name__ == "__main__":
    # Note: Make sure the server is running on localhost:8000
    test_validate_crp_endpoint()
