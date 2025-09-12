import type { Router, Request, Response } from 'express';
import { db } from '../../core/firestore';
import { createGitHubService, GitHubReference, BriefGitHubData } from '../../core/github';

/**
 * Registra le rotte legate ai "brief" GitHub.
 */
export default function registerGitHubBrief(r: Router) {
  /**
   * Test GitHub connection
   */
  r.get('/api/github/_test', async (_req: Request, res: Response) => {
    try {
      const github = createGitHubService();
      if (!github) {
        return res.status(500).json({
          ok: false,
          error: 'github_not_configured',
          message: 'Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO'
        });
      }

      const result = await github.testConnection();
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: 'github_test_failed',
        message: error?.message || String(error)
      });
    }
  });

  /**
   * Post brief to GitHub as issue
   */
  r.post('/api/github/brief', async (req: Request, res: Response) => {
    try {
      const github = createGitHubService();
      if (!github) {
        return res.status(500).json({
          ok: false,
          error: 'github_not_configured',
          message: 'Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO'
        });
      }

      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const dateKey = String(req.body?.dateKey || new Date().toISOString().slice(0, 10));

      // Leggi note da Firestore
      const snap = await db.collection('notes').get();
      const items: any[] = [];
      snap.forEach((doc) => items.push(doc.data()));

      // Build text content and extract GitHub references
      let briefContent = `# Daily Brief - ${owner} - ${dateKey}\n\n`;
      let allGitHubRefs: GitHubReference[] = [];
      
      if (items.length === 0) {
        briefContent += '*No notes found for this date.*\n';
      } else {
        briefContent += '## Notes\n\n';
        for (const item of items) {
          const itemText = `- **${item.title ?? 'Untitled'}**: ${item.content ?? ''}`;
          briefContent += itemText + '\n';
          
          // Extract GitHub references from note content
          const refs = github.extractReferences(item.content || '');
          allGitHubRefs.push(...refs);
        }
      }

      // Enrich with GitHub data if available
      if (allGitHubRefs.length > 0) {
        briefContent = await github.enrichBrief(briefContent, allGitHubRefs);
      }

      // Post to GitHub
      const githubIssue = await github.postBriefAsIssue(briefContent, dateKey, owner);
      
      const githubData: BriefGitHubData = {
        references: allGitHubRefs,
        issueCreated: githubIssue
      };

      return res.status(200).json({
        ok: true,
        owner,
        dateKey,
        notesCount: items.length,
        github: githubData
      });

    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: 'github_brief_failed',
        detail: error?.message || String(error),
      });
    }
  });

  /**
   * Analyze notes for GitHub references without posting
   */
  r.post('/api/github/analyze', async (req: Request, res: Response) => {
    try {
      const github = createGitHubService();
      if (!github) {
        return res.status(500).json({
          ok: false,
          error: 'github_not_configured',
          message: 'Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO'
        });
      }

      const dateKey = String(req.body?.dateKey || new Date().toISOString().slice(0, 10));

      // Leggi note da Firestore
      const snap = await db.collection('notes').get();
      const items: any[] = [];
      snap.forEach((doc) => items.push(doc.data()));

      // Extract GitHub references from all notes
      let allGitHubRefs: GitHubReference[] = [];
      const notesWithRefs: Array<{ note: any, refs: GitHubReference[] }> = [];
      
      for (const item of items) {
        const refs = github.extractReferences(item.content || '');
        if (refs.length > 0) {
          allGitHubRefs.push(...refs);
          notesWithRefs.push({ note: item, refs });
        }
      }

      // Get enriched data for references
      let enrichedContent = '';
      if (allGitHubRefs.length > 0) {
        enrichedContent = await github.enrichBrief('', allGitHubRefs);
      }

      return res.status(200).json({
        ok: true,
        dateKey,
        totalNotes: items.length,
        notesWithGitHubRefs: notesWithRefs.length,
        totalReferences: allGitHubRefs.length,
        references: allGitHubRefs,
        enrichedData: enrichedContent
      });

    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: 'github_analyze_failed',
        detail: error?.message || String(error),
      });
    }
  });

  /**
   * Add comment to existing GitHub issue
   */
  r.post('/api/github/comment', async (req: Request, res: Response) => {
    try {
      const github = createGitHubService();
      if (!github) {
        return res.status(500).json({
          ok: false,
          error: 'github_not_configured'
        });
      }

      const { issueNumber, comment } = req.body;
      
      if (!issueNumber || !comment) {
        return res.status(400).json({
          ok: false,
          error: 'missing_parameters',
          message: 'issueNumber and comment are required'
        });
      }

      await github.addIssueComment(issueNumber, comment);

      return res.status(200).json({
        ok: true,
        issueNumber,
        commentAdded: true
      });

    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: 'github_comment_failed',
        detail: error?.message || String(error),
      });
    }
  });
}