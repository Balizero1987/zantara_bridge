/**
 * Gemini AI Service for Zantara Bridge
 * TypeScript wrapper for Python Gemini integration
 */

import { spawn } from 'child_process';
import path from 'path';

export interface GeminiResponse {
  text: string;
  error?: string;
}

export class GeminiService {
  private pythonPath: string;

  constructor() {
    this.pythonPath = path.join(__dirname, 'gemini.py');
  }

  /**
   * Generate content using Gemini AI
   */
  async generateContent(prompt: string): Promise<GeminiResponse> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonPath, prompt]);
      
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          resolve({
            text: '',
            error: errorOutput || `Process exited with code ${code}`
          });
        } else {
          resolve({
            text: output.trim()
          });
        }
      });

      python.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if Gemini service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.generateContent("test");
      return !response.error;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();