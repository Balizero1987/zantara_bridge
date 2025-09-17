import functions_framework
import requests
from google.auth import default
from google.auth.transport.requests import Request

credentials, _ = default()

@functions_framework.http
def zantara_proxy(request):
    # Verifica API key
    api_key = request.headers.get('X-API-KEY')
    if api_key != '7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3':
        return {'error': 'Invalid API key'}, 403
    
    # Token IAM
    credentials.refresh(Request())
    
    # Proxy a Cloud Run
    base_url = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'
    path = request.path or '/health'
    headers = {'Authorization': f'Bearer {credentials.token}'}
    
    if request.method == 'POST':
        resp = requests.post(f'{base_url}{path}', headers=headers, json=request.json)
    else:
        resp = requests.get(f'{base_url}{path}', headers=headers)
    
    return resp.json(), resp.status_code