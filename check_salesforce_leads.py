import requests

# Salesforce Configuration
CLIENT_ID = '3MVG97L7PWbPq6Uye2TFy4gSXKYAH95aiMckB29tOVyUijq5ALuyIx1e0yCQ3c3npLrqFExNeGx860Sybs2_I'
CLIENT_SECRET = '0565EDC95067F3F91DC2035B5879212415B15D7D6E3F58CFB6FCB4BE13F1CE14'
LOGIN_URL = 'https://orgfarm-522dd78c93-dev-ed.develop.my.salesforce.com'

def authenticate():
    """Get access token via Client Credentials flow"""
    response = requests.post(
        f'{LOGIN_URL}/services/oauth2/token',
        data={
            'grant_type': 'client_credentials',
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET
        }
    )
    if response.status_code == 200:
        data = response.json()
        return data['access_token'], data['instance_url']
    else:
        print(f"❌ Auth Failed: {response.text}")
        return None, None

def query_recent_leads(access_token, instance_url):
    """Query for Leads created today"""
    query = "SELECT Id, FirstName, LastName, Company, Email, LeadSource, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT 10"
    
    response = requests.get(
        f'{instance_url}/services/data/v60.0/query',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'q': query}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n📋 Found {data['totalSize']} Lead(s):\n")
        for lead in data['records']:
            print(f"  • {lead.get('FirstName', '')} {lead.get('LastName', '')} @ {lead.get('Company', 'N/A')}")
            print(f"    Email: {lead.get('Email', 'N/A')}")
            print(f"    Source: {lead.get('LeadSource', 'N/A')}")
            print(f"    Created: {lead.get('CreatedDate', 'N/A')}")
            print()
        return data['records']
    else:
        print(f"❌ Query Failed: {response.text}")
        return []

if __name__ == "__main__":
    print("🔍 Checking Salesforce for recent Leads...")
    token, url = authenticate()
    if token and url:
        print("✅ Authenticated")
        query_recent_leads(token, url)
