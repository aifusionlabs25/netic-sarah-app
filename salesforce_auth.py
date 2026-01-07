import requests
import os

# -------------------------
# 🔧 Configuration Section
# -------------------------

# Your Connected App credentials (AI_Agent_Integration External Client App)
CLIENT_ID = os.environ.get('SF_CLIENT_ID', '3MVG97L7PWbPq6Uye2TFy4gSXKYAH95aiMckB29tOVyUijq5ALuyIx1e0yCQ3c3npLrqFExNeGx860Sybs2_I')
CLIENT_SECRET = os.environ.get('SF_CLIENT_SECRET', '0565EDC95067F3F91DC2035B5879212415B15D7D6E3F58CFB6FCB4BE13F1CE14')

# API user credentials
USERNAME = 'aifusionlabs487@agentforce.com'
PASSWORD = 'D3cZv2@z7rfX1u'
SECURITY_TOKEN = 'Qu86450fPWsDf8sVQ3svyUgKa'

# Salesforce login URL (use org-specific My Domain for dev orgs)
LOGIN_URL = 'https://orgfarm-522dd78c93-dev-ed.develop.my.salesforce.com/services/oauth2/token'

# -------------------------
# 🔐 Authentication Request
# -------------------------

def authenticate():
    # Use Client Credentials flow for External Client Apps
    c_id = CLIENT_ID if CLIENT_ID != 'placeholder' else input("Enter Client ID: ")
    c_secret = CLIENT_SECRET if CLIENT_SECRET != 'placeholder' else input("Enter Client Secret: ")

    payload = {
        'grant_type': 'client_credentials',
        'client_id': c_id,
        'client_secret': c_secret
    }

    print("Authenticating with Salesforce...")
    try:
        response = requests.post(LOGIN_URL, data=payload)
        
        if response.status_code == 200:
            auth_response = response.json()
            access_token = auth_response['access_token']
            instance_url = auth_response['instance_url']
            print("✅ Auth Success!")
            print(f"Access Token: {access_token[:15]}...")
            print(f"Instance URL: {instance_url}")
            return access_token, instance_url
        else:
            print("❌ Auth Failed!")
            print(f"Status Code: {response.status_code}")
            print(response.text)
            return None, None
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return None, None

# -------------------------
# 📡 Example REST API Call
# -------------------------

def get_salesforce_data(access_token, instance_url):
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    # Sample: Query Accounts
    query_url = f"{instance_url}/services/data/v60.0/query" # Updated to v60.0
    params = {'q': 'SELECT Id, Name FROM Account LIMIT 5'}
    
    try:
        response = requests.get(query_url, headers=headers, params=params)

        if response.status_code == 200:
            print("✅ Query Success!")
            print(response.json())
        else:
            print("❌ Query Failed!")
            print(response.status_code)
            print(response.text)
    except Exception as e:
        print(f"❌ Query Error: {e}")

# -------------------------
# 🚀 Execute
# -------------------------

if __name__ == "__main__":
    token, url = authenticate()
    if token and url:
        get_salesforce_data(token, url)
