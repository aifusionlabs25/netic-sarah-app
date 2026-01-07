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
        print("✅ Auth Success!")
        return data['access_token'], data['instance_url']
    else:
        print(f"❌ Auth Failed: {response.text}")
        return None, None

def create_test_lead(access_token, instance_url):
    """Create a test Lead"""
    lead_data = {
        'FirstName': 'Test',
        'LastName': 'MorganLead',
        'Company': 'Test Company from Morgan',
        'Email': 'test@example.com',
        'LeadSource': 'Morgan AI Agent',
        'Description': 'This is a test lead created to verify Salesforce integration works.'
    }
    
    response = requests.post(
        f'{instance_url}/services/data/v60.0/sobjects/Lead',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        },
        json=lead_data
    )
    
    if response.status_code == 201:
        result = response.json()
        print(f"✅ Lead Created! ID: {result['id']}")
        return result['id']
    else:
        print(f"❌ Lead Creation Failed: {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    print("Testing Salesforce Lead Creation...")
    token, url = authenticate()
    if token and url:
        create_test_lead(token, url)
