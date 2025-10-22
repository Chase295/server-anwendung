import requests
import time
import warnings
warnings.filterwarnings('ignore')

API_URL = "https://flowise.local.chase295.de/api/v1/prediction/203c3495-cacc-408f-b9ea-8df04d44817c"
headers = {"Authorization": "Bearer dkSjdaLRLVD8d9YUyuppzvDBB3HUujvQloEf5vtdcIc"}

def query(payload):
    print(f"🧪 Sending request to Flowise (EXACT SCRIPT)...")
    start_time = time.time()
    
    try:
        # EXAKT wie im Original-Script - OHNE Timeout!
        response = requests.post(API_URL, headers=headers, json=payload, verify=False)
        duration = (time.time() - start_time) * 1000
        
        print(f"✅ Response received in {duration:.0f}ms")
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'unknown')}")
        print(f"Response: {response.json()}")
        
        return response.json()
    except requests.exceptions.Timeout:
        duration = (time.time() - start_time) * 1000
        print(f"❌ Timeout after {duration:.0f}ms")
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        print(f"❌ Error after {duration:.0f}ms: {e}")
        print(f"Response text (first 200 chars): {response.text[:200] if 'response' in locals() else 'No response'}")

print("🚀 Testing with EXACT script from user...\n")
output = query({"question": "Hey, how are you?"})

