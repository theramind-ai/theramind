import requests
import json

def test_cfp_api():
    url = "https://cadastro.cfp.org.br/api/profissionais/pesquisar"
    payload = {
        "registro": "44606",
        "uf": "04"
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://cadastro.cfp.org.br/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    print(f"Testing URL: {url}")
    print(f"Payload: {payload}")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print("Response Text:")
        print(response.text[:500]) # Print first 500 chars
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("JSON Data received successfully!")
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception as e:
                print(f"Error parsing JSON: {e}")
        else:
            print("Failed to get a successful response.")
    except Exception as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    test_cfp_api()
