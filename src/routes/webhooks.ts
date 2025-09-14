import { Request, Response, Router } from 'express';
import crypto from 'crypto';

const router = Router();

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created: Date;
  lastTriggered?: Date;
  failureCount: number;
}

// In-memory webhook store
const webhooks = new Map<string, Webhook>();

// Event queue for retries
const eventQueue: Array<{
  webhookId: string;
  event: any;
  attempt: number;
}> = [];

// Webhook events
export enum WebhookEvent {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  CHAT_MESSAGE = 'chat.message',
  DOCUMENT_UPLOADED = 'document.uploaded',
  DOCUMENT_PROCESSED = 'document.processed',
  SYSTEM_ALERT = 'system.alert',
  ANALYTICS_MILESTONE = 'analytics.milestone'
}

// POST /api/webhooks - Create new webhook
router.post('/', (req: Request, res: Response) => {
  try {
    const { url, events } = req.body;
    
    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ 
        error: 'URL and events array are required' 
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate events
    const validEvents = Object.values(WebhookEvent);
    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid events',
        invalidEvents 
      });
    }

    const webhook: Webhook = {
      id: crypto.randomUUID(),
      url,
      events,
      secret: crypto.randomBytes(32).toString('hex'),
      active: true,
      created: new Date(),
      failureCount: 0
    };

    webhooks.set(webhook.id, webhook);

    res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      active: webhook.active,
      created: webhook.created
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to create webhook',
      details: error.message 
    });
  }
});

// GET /api/webhooks - List all webhooks
router.get('/', (req: Request, res: Response) => {
  try {
    const webhookList = Array.from(webhooks.values()).map(webhook => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      created: webhook.created,
      lastTriggered: webhook.lastTriggered,
      failureCount: webhook.failureCount
    }));

    res.json({
      webhooks: webhookList,
      total: webhookList.length
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to list webhooks',
      details: error.message 
    });
  }
});

// GET /api/webhooks/:id - Get specific webhook
router.get('/:id', (req: Request, res: Response) => {
  try {
    const webhook = webhooks.get(req.params.id);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      created: webhook.created,
      lastTriggered: webhook.lastTriggered,
      failureCount: webhook.failureCount
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get webhook',
      details: error.message 
    });
  }
});

// PUT /api/webhooks/:id - Update webhook
router.put('/:id', (req: Request, res: Response) => {
  try {
    const webhook = webhooks.get(req.params.id);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const { url, events, active } = req.body;

    if (url) {
      try {
        new URL(url);
        webhook.url = url;
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    if (events) {
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Events must be an array' });
      }
      
      const validEvents = Object.values(WebhookEvent);
      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid events',
          invalidEvents 
        });
      }
      
      webhook.events = events;
    }

    if (typeof active === 'boolean') {
      webhook.active = active;
    }

    webhooks.set(webhook.id, webhook);

    res.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      updated: true
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update webhook',
      details: error.message 
    });
  }
});

// DELETE /api/webhooks/:id - Delete webhook
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = webhooks.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted successfully' });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to delete webhook',
      details: error.message 
    });
  }
});

// POST /api/webhooks/:id/test - Test webhook
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const webhook = webhooks.get(req.params.id);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Zantara Bridge',
        webhookId: webhook.id
      }
    };

    const result = await triggerWebhook(webhook, testPayload);

    res.json({
      success: result.success,
      status: result.status,
      message: result.success ? 'Test webhook sent successfully' : 'Test webhook failed',
      details: result.error || 'Webhook triggered'
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to test webhook',
      details: error.message 
    });
  }
});

// Function to trigger webhook
async function triggerWebhook(webhook: Webhook, payload: any): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  try {
    if (!webhook.active) {
      return { success: false, error: 'Webhook is disabled' };
    }

    // Create signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zantara-Signature': `sha256=${signature}`,
        'X-Zantara-Event': payload.event,
        'User-Agent': 'Zantara-Bridge-Webhook/1.0'
      },
      body: JSON.stringify(payload)
    });

    webhook.lastTriggered = new Date();

    if (response.ok) {
      webhook.failureCount = 0;
      webhooks.set(webhook.id, webhook);
      return { success: true, status: response.status };
    } else {
      webhook.failureCount++;
      webhooks.set(webhook.id, webhook);
      return { 
        success: false, 
        status: response.status, 
        error: `HTTP ${response.status}` 
      };
    }

  } catch (error: any) {
    webhook.failureCount++;
    webhooks.set(webhook.id, webhook);
    return { success: false, error: error.message };
  }
}

// Function to broadcast event to all matching webhooks
export async function broadcastWebhookEvent(eventType: WebhookEvent, data: any): Promise<void> {
  const matchingWebhooks = Array.from(webhooks.values()).filter(
    webhook => webhook.active && webhook.events.includes(eventType)
  );

  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data
  };

  // Trigger webhooks in parallel
  const promises = matchingWebhooks.map(webhook => 
    triggerWebhook(webhook, payload).catch(error => {
      console.error(`Webhook ${webhook.id} failed:`, error);
      return { success: false, error: error.message };
    })
  );

  await Promise.all(promises);
}

// GET /api/webhooks/events - List available events
router.get('/events/list', (req: Request, res: Response) => {
  res.json({
    events: Object.values(WebhookEvent).map(event => ({
      name: event,
      description: getEventDescription(event)
    }))
  });
});

function getEventDescription(event: WebhookEvent): string {
  const descriptions = {
    [WebhookEvent.USER_CREATED]: 'Triggered when a new user is created',
    [WebhookEvent.USER_UPDATED]: 'Triggered when user information is updated',
    [WebhookEvent.USER_DELETED]: 'Triggered when a user is deleted',
    [WebhookEvent.CHAT_MESSAGE]: 'Triggered when a chat message is processed',
    [WebhookEvent.DOCUMENT_UPLOADED]: 'Triggered when a document is uploaded',
    [WebhookEvent.DOCUMENT_PROCESSED]: 'Triggered when document processing completes',
    [WebhookEvent.SYSTEM_ALERT]: 'Triggered for system alerts and errors',
    [WebhookEvent.ANALYTICS_MILESTONE]: 'Triggered when analytics milestones are reached'
  };
  
  return descriptions[event] || 'No description available';
}

export { router as webhooksRouter, WebhookEvent };