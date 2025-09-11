import type { Router, Request, Response } from 'express';
import { createGitHubService } from '../../core/github';

interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    labels: Array<{ name: string }>;
    state: string;
  };
  comment?: {
    body: string;
    user: {
      login: string;
    };
  };
  repository?: {
    name: string;
    full_name: string;
  };
}

/**
 * Webhook handlers for GitHub integration and Claude Code automation
 */
export default function registerWebhooks(r: Router) {
  
  /**
   * GitHub webhook handler
   * Triggers when issues are created, commented, or labeled with 'ai-ready'
   */
  r.post('/api/webhooks/github', async (req: Request, res: Response) => {
    try {
      const payload: GitHubWebhookPayload = req.body;
      const eventType = req.headers['x-github-event'] as string;

      console.log(`GitHub webhook received: ${eventType}`, {
        action: payload.action,
        issue: payload.issue?.number,
        repository: payload.repository?.name
      });

      // Only process specific events
      if (!['issues', 'issue_comment'].includes(eventType)) {
        return res.status(200).json({ ok: true, message: 'Event ignored' });
      }

      const github = createGitHubService();
      if (!github) {
        return res.status(500).json({ ok: false, error: 'github_not_configured' });
      }

      // Handle different GitHub events
      switch (eventType) {
        case 'issues':
          await handleIssueEvent(payload, github);
          break;
        
        case 'issue_comment':
          await handleCommentEvent(payload, github);
          break;
      }

      return res.status(200).json({ ok: true, processed: true });

    } catch (error: any) {
      console.error('GitHub webhook error:', error);
      return res.status(500).json({
        ok: false,
        error: 'webhook_failed',
        detail: error?.message || String(error)
      });
    }
  });

  /**
   * Claude Code webhook endpoint
   * This endpoint can be called by Claude Code to notify about automated actions
   */
  r.post('/api/webhooks/claude-code', async (req: Request, res: Response) => {
    try {
      const { action, issueNumber, result, error } = req.body;

      console.log(`Claude Code webhook:`, { action, issueNumber, result: !!result, error: !!error });

      const github = createGitHubService();
      if (!github || !issueNumber) {
        return res.status(400).json({ ok: false, error: 'invalid_request' });
      }

      // Generate response comment based on Claude Code result
      let comment = '';
      
      if (error) {
        comment = `🤖 **Claude Code Update**\n\n❌ **Failed to process**: ${error}\n\nPlease review manually.`;
      } else if (result) {
        comment = `🤖 **Claude Code Update**\n\n✅ **Processing completed**\n\n${result}\n\n*Automated by Zantara Bridge*`;
      }

      if (comment) {
        await github.addIssueComment(issueNumber, comment);
      }

      return res.status(200).json({ ok: true, commentAdded: !!comment });

    } catch (error: any) {
      console.error('Claude Code webhook error:', error);
      return res.status(500).json({
        ok: false,
        error: 'webhook_failed',
        detail: error?.message || String(error)
      });
    }
  });

  /**
   * Generic AI webhook for other integrations
   */
  r.post('/api/webhooks/ai-notification', async (req: Request, res: Response) => {
    try {
      const { source, issueNumber, message, type = 'info' } = req.body;

      const github = createGitHubService();
      if (!github || !issueNumber || !message) {
        return res.status(400).json({ ok: false, error: 'invalid_request' });
      }

      const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
      const comment = `${emoji} **${source || 'AI'} Update**\n\n${message}`;

      await github.addIssueComment(issueNumber, comment);

      return res.status(200).json({ ok: true, commentAdded: true });

    } catch (error: any) {
      console.error('AI notification webhook error:', error);
      return res.status(500).json({
        ok: false,
        error: 'webhook_failed',
        detail: error?.message || String(error)
      });
    }
  });
}

/**
 * Handle GitHub issue events (created, labeled, etc.)
 */
async function handleIssueEvent(payload: GitHubWebhookPayload, github: any) {
  if (!payload.issue || !payload.action) return;

  const { issue, action } = payload;
  const hasAILabel = issue.labels.some(label => 
    ['ai-ready', 'claude-code-candidate', 'zantara-brief'].includes(label.name)
  );

  console.log(`Issue ${issue.number} ${action}, has AI label: ${hasAILabel}`);

  // If issue is labeled for AI processing, add a comment indicating it's queued
  if ((action === 'opened' || action === 'labeled') && hasAILabel) {
    const comment = `🤖 **Zantara Bridge Notification**\n\nThis issue has been flagged for AI processing.\n\n` +
                   `**Issue**: #${issue.number} - ${issue.title}\n` +
                   `**Labels**: ${issue.labels.map(l => l.name).join(', ')}\n\n` +
                   `Claude Code and other AI tools have been notified.`;

    await github.addIssueComment(issue.number, comment);
  }
}

/**
 * Handle GitHub comment events
 */
async function handleCommentEvent(payload: GitHubWebhookPayload, github: any) {
  if (!payload.comment || !payload.issue) return;

  const { comment, issue } = payload;
  
  // Check if comment is from Zantara (avoid infinite loops)
  if (comment.user.login.includes('zantara') || comment.user.login.includes('bot')) {
    return;
  }

  // Check if comment contains AI trigger keywords
  const triggerKeywords = ['@claude-code', '@zantara', '/ai-help'];
  const containsTrigger = triggerKeywords.some(keyword => 
    comment.body.toLowerCase().includes(keyword.toLowerCase())
  );

  if (containsTrigger) {
    const response = `🤖 **AI Assistance Requested**\n\n` +
                    `I've noted your request for AI assistance on issue #${issue.number}.\n` +
                    `Claude Code and other tools will be notified.\n\n` +
                    `*Comment: "${comment.body.substring(0, 100)}${comment.body.length > 100 ? '...' : ''}"*`;

    await github.addIssueComment(issue.number, response);
  }
}