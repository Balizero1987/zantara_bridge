#!/usr/bin/env python3
"""
Gemini AI Integration for Zantara Bridge
Provides Gemini AI capabilities via Google's GenerativeAI library
"""

import google.generativeai as genai
import os
import sys
import json
import logging
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiService:
    """Service class for Google Gemini AI integration"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini service with API key"""
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-pro")
        
        logger.info("Gemini service initialized successfully")
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """Generate content using Gemini model"""
        try:
            response = self.model.generate_content(prompt, **kwargs)
            return response.text
        except Exception as e:
            logger.error(f"Error generating content with Gemini: {e}")
            raise
    
    def chat(self, messages: list, **kwargs) -> str:
        """Start a chat session with Gemini"""
        try:
            chat = self.model.start_chat(history=messages[:-1] if len(messages) > 1 else [])
            response = chat.send_message(messages[-1] if messages else "Hello")
            return response.text
        except Exception as e:
            logger.error(f"Error in Gemini chat: {e}")
            raise

def main():
    """CLI interface for Gemini service"""
    try:
        # Initialize service
        gemini_service = GeminiService()
        
        # Get prompt from command line or use default
        prompt = sys.argv[1] if len(sys.argv) > 1 else "Ciao Zantara"
        
        # Generate response
        response = gemini_service.generate_content(prompt)
        
        # Output response
        print(response)
        
    except Exception as e:
        logger.error(f"Error in main: {e}")
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()