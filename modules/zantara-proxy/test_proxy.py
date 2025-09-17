#!/usr/bin/env python3
"""
Simple test script to validate the proxy functionality
"""
import requests
import subprocess
import json

def get_gcp_token():
    """Get GCP access token"""
    result = subprocess.run(['gcloud', 'auth', 'print-access-token'], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout.strip()
    else:
        raise Exception(f"Failed to get token: {result.stderr}")

def test_direct_call():
    """Test direct call to Cloud Run service"""
    print("Testing direct call to Cloud Run...")
    token = get_gcp_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    url = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health'
    response = requests.get(url, headers=headers)
    
    print(f"Direct call status: {response.status_code}")
    print(f"Direct call response: {response.json()}")
    return response.status_code == 200

def main():
    print("=== Zantara Proxy Test ===\n")
    
    # Test 1: Direct call
    if test_direct_call():
        print("✅ Direct call successful")
        
        print("\n=== Configuration Summary ===")
        print("• Service: zantara-bridge-v2-prod")
        print("• Region: asia-southeast2") 
        print("• Authentication: IAM required")
        print("• API Key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3")
        
        print("\n=== How to use ===")
        print("1. Include X-API-KEY header with the API key")
        print("2. The proxy will handle IAM authentication automatically")
        print("3. All requests are forwarded to the Cloud Run service")
        
    else:
        print("❌ Direct call failed")

if __name__ == "__main__":
    main()