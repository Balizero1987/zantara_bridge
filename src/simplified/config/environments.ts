/**
 * 🎛️ UNIFIED CONFIGURATION SYSTEM
 * Mode-based configuration replacing multiple server files
 */

export interface ZantaraConfig {
  mode: 'enterprise' | 'light' | 'minimal';
  auth: 'full' | 'lightweight' | 'apikey';
  features: string[];
  monitoring: 'detailed' | 'basic' | 'none';
  rateLimit: 'enterprise' | 'conservative' | 'strict';
  resources: {
    memory: string;
    cpu: string;
    timeout: number;
  };
}

export function createConfig(): ZantaraConfig {
  const mode = (process.env.ZANTARA_MODE || detectMode()) as ZantaraConfig['mode'];
  
  const configs: Record<ZantaraConfig['mode'], ZantaraConfig> = {
    enterprise: {
      mode: 'enterprise',
      auth: 'full',
      features: ['core', 'ai', 'storage', 'communication', 'admin', 'analytics', 'webhooks'],
      monitoring: 'detailed',
      rateLimit: 'enterprise',
      resources: {
        memory: '2Gi',
        cpu: '2',
        timeout: 300
      }
    },
    
    light: {
      mode: 'light',
      auth: 'lightweight',
      features: ['core', 'ai', 'storage'],
      monitoring: 'basic',
      rateLimit: 'conservative',
      resources: {
        memory: '512Mi',
        cpu: '1',
        timeout: 120
      }
    },
    
    minimal: {
      mode: 'minimal',
      auth: 'apikey',
      features: ['core'],
      monitoring: 'none',
      rateLimit: 'strict',
      resources: {
        memory: '256Mi',
        cpu: '0.5',
        timeout: 60
      }
    }
  };
  
  return configs[mode];
}

function detectMode(): string {
  // Auto-detect mode based on environment
  if (process.env.ZANTARA_LIGHT_BRIDGE) return 'light';
  if (process.env.MINIMAL_MODE) return 'minimal';
  return 'enterprise';
}

export const FEATURE_ENDPOINTS = {
  core: ['/', '/health', '/bridge/status'],
  ai: ['/call', '/api/chat', '/api/assistant', '/api/gemini'],
  storage: ['/actions/drive/*', '/actions/memory/*', '/api/notes'],
  communication: ['/actions/email/*', '/api/calendar/*', '/actions/gmail/*'],
  admin: ['/api/monitoring', '/api/analytics', '/api/users'],
  analytics: ['/api/conversations/stats', '/api/dashboard'],
  webhooks: ['/api/webhooks', '/dispatch/*']
};