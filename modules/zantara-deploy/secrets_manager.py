#!/usr/bin/env python3
"""
Secrets Manager - Gestione unificata di segreti per ambiente locale e cloud
"""
import os
from typing import Optional, Dict, Any
from pathlib import Path

try:
    from dotenv import load_dotenv
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

try:
    from google.cloud import secretmanager
    GOOGLE_SECRETS_AVAILABLE = True
except ImportError:
    GOOGLE_SECRETS_AVAILABLE = False


class SecretsManager:
    """Gestisce segreti da environment variables, .env file, o Google Secret Manager"""
    
    def __init__(self, project_id: Optional[str] = None, env_file: Optional[str] = None):
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        self.env_file = env_file or '.env'
        self._secrets_client = None
        
        # Carica .env se disponibile e in ambiente locale
        if DOTENV_AVAILABLE and Path(self.env_file).exists():
            load_dotenv(self.env_file)
    
    @property
    def secrets_client(self):
        """Lazy init del client Google Secret Manager"""
        if self._secrets_client is None and GOOGLE_SECRETS_AVAILABLE and self.project_id:
            self._secrets_client = secretmanager.SecretManagerServiceClient()
        return self._secrets_client
    
    def get_secret(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Recupera un segreto con fallback hierarchy:
        1. Environment variable
        2. Google Secret Manager (se configurato)
        3. Default value
        """
        # 1. Prova environment variable
        value = os.getenv(key)
        if value:
            return value
        
        # 2. Prova Google Secret Manager
        if self.secrets_client and self.project_id:
            try:
                secret_name = f"projects/{self.project_id}/secrets/{key.lower().replace('_', '-')}/versions/latest"
                response = self.secrets_client.access_secret_version(request={"name": secret_name})
                return response.payload.data.decode("UTF-8")
            except Exception:
                pass  # Fallback al default
        
        # 3. Default
        return default
    
    def get_config(self) -> Dict[str, Any]:
        """Carica tutta la configurazione necessaria"""
        return {
            'X_API_KEY': self.get_secret('X_API_KEY'),
            'X_BZ_USER': self.get_secret('X_BZ_USER', 'BOSS'),
            'MONTHLY_LIMIT': int(self.get_secret('MONTHLY_LIMIT', '100')),
            'BASE_URL': self.get_secret('BASE_URL', 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'),
            'GOOGLE_CLOUD_PROJECT': self.get_secret('GOOGLE_CLOUD_PROJECT'),
        }
    
    def validate_config(self) -> bool:
        """Verifica che i segreti essenziali siano presenti"""
        config = self.get_config()
        required = ['X_API_KEY']
        
        missing = [key for key in required if not config.get(key)]
        if missing:
            print(f"❌ Missing required secrets: {', '.join(missing)}")
            return False
        
        print("✅ All required secrets loaded")
        return True


def get_zantara_headers() -> Dict[str, str]:
    """Utility rapida per ottenere headers per API Zantara"""
    secrets = SecretsManager()
    config = secrets.get_config()
    
    headers = {}
    if config['X_API_KEY']:
        headers['X-API-KEY'] = config['X_API_KEY']
    if config['X_BZ_USER']:
        headers['X-BZ-USER'] = config['X_BZ_USER']
    
    return headers


if __name__ == "__main__":
    secrets = SecretsManager()
    
    print("🔑 Secrets Manager Test")
    print("-" * 30)
    
    if secrets.validate_config():
        config = secrets.get_config()
        print(f"Base URL: {config['BASE_URL']}")
        print(f"User: {config['X_BZ_USER']}")
        print(f"Monthly limit: {config['MONTHLY_LIMIT']}")
        print(f"API Key: {'✓ Set' if config['X_API_KEY'] else '✗ Missing'}")
        
        print("\nHeaders for API calls:")
        headers = get_zantara_headers()
        for key, value in headers.items():
            print(f"  {key}: {'***' if 'KEY' in key else value}")
    else:
        print("❌ Configuration incomplete")