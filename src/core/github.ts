import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface GitHubReference {
  type: 'commit' | 'issue' | 'pr';
  owner: string;
  repo: string;
  number?: number;
  sha?: string;
  url: string;
}

export interface BriefGitHubData {
  references: GitHubReference[];
  issueCreated?: {
    id: number;
    url: string;
  };
}

/**
 * GitHub integration service for Zantara Bridge
 */
export class GitHubService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
  }

  /**
   * Extract GitHub references from text content
   */
  extractReferences(content: string): GitHubReference[] {
    const references: GitHubReference[] = [];
    
    // Match GitHub URLs
    const patterns = [
      // Commit URLs: https://github.com/owner/repo/commit/sha
      {
        pattern: /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]{7,40})/gi,
        type: 'commit' as const,
        extract: (match: RegExpExecArray) => ({
          owner: match[1],
          repo: match[2],
          sha: match[3],
          url: match[0]
        })
      },
      // Issue URLs: https://github.com/owner/repo/issues/123
      {
        pattern: /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/gi,
        type: 'issue' as const,
        extract: (match: RegExpExecArray) => ({
          owner: match[1],
          repo: match[2],
          number: parseInt(match[3]),
          url: match[0]
        })
      },
      // PR URLs: https://github.com/owner/repo/pull/123
      {
        pattern: /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/gi,
        type: 'pr' as const,
        extract: (match: RegExpExecArray) => ({
          owner: match[1],
          repo: match[2],
          number: parseInt(match[3]),
          url: match[0]
        })
      }
    ];

    // Simple issue references: #123 (within same repo)
    const simpleIssuePattern = /#(\d+)/g;
    let match;
    while ((match = simpleIssuePattern.exec(content)) !== null) {
      references.push({
        type: 'issue',
        owner: this.config.owner,
        repo: this.config.repo,
        number: parseInt(match[1]),
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${match[1]}`
      });
    }

    // Extract full URL references
    for (const { pattern, type, extract } of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ref = extract(match);
        references.push({
          type,
          ...ref
        });
      }
    }

    return references;
  }

  /**
   * Enrich brief content with GitHub data
   */
  async enrichBrief(briefContent: string, references: GitHubReference[]): Promise<string> {
    if (references.length === 0) return briefContent;

    let enrichedContent = briefContent + '\n\n## 🔗 GitHub Activity\n\n';

    for (const ref of references) {
      try {
        if (ref.type === 'commit' && ref.sha) {
          const commit = await this.octokit.repos.getCommit({
            owner: ref.owner,
            repo: ref.repo,
            ref: ref.sha
          });

          enrichedContent += `### Commit: ${ref.sha.substring(0, 7)}\n`;
          enrichedContent += `**Message**: ${commit.data.commit.message}\n`;
          enrichedContent += `**Files changed**: ${commit.data.files?.length || 0}\n`;
          enrichedContent += `**Link**: [${ref.url}](${ref.url})\n\n`;

        } else if (ref.type === 'issue' && ref.number) {
          const issue = await this.octokit.issues.get({
            owner: ref.owner,
            repo: ref.repo,
            issue_number: ref.number
          });

          enrichedContent += `### Issue #${ref.number}: ${issue.data.title}\n`;
          enrichedContent += `**State**: ${issue.data.state}\n`;
          enrichedContent += `**Labels**: ${issue.data.labels.map((l: any) => l.name).join(', ')}\n`;
          enrichedContent += `**Link**: [${ref.url}](${ref.url})\n\n`;

        } else if (ref.type === 'pr' && ref.number) {
          const pr = await this.octokit.pulls.get({
            owner: ref.owner,
            repo: ref.repo,
            pull_number: ref.number
          });

          enrichedContent += `### PR #${ref.number}: ${pr.data.title}\n`;
          enrichedContent += `**State**: ${pr.data.state}\n`;
          enrichedContent += `**Base**: ${pr.data.base.ref} ← ${pr.data.head.ref}\n`;
          enrichedContent += `**Link**: [${ref.url}](${ref.url})\n\n`;
        }
      } catch (error) {
        console.warn(`Failed to fetch GitHub data for ${ref.url}:`, error);
        enrichedContent += `### ${ref.type.toUpperCase()}: ${ref.url}\n`;
        enrichedContent += `*Could not fetch additional details*\n\n`;
      }
    }

    return enrichedContent;
  }

  /**
   * Post brief as GitHub issue
   */
  async postBriefAsIssue(briefContent: string, dateKey: string, owner: string): Promise<{ id: number; url: string }> {
    const title = `Daily Brief - ${owner} - ${dateKey}`;
    
    const issue = await this.octokit.issues.create({
      owner: this.config.owner,
      repo: this.config.repo,
      title,
      body: briefContent,
      labels: ['zantara-brief', 'daily-brief', 'ai-ready']
    });

    return {
      id: issue.data.number,
      url: issue.data.html_url
    };
  }

  /**
   * Add comment to existing issue
   */
  async addIssueComment(issueNumber: number, comment: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      body: comment
    });
  }

  /**
   * Update issue with labels or status
   */
  async updateIssue(issueNumber: number, updates: { labels?: string[]; state?: 'open' | 'closed' }): Promise<void> {
    await this.octokit.issues.update({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      ...updates
    });
  }

  /**
   * Test GitHub connection
   */
  async testConnection(): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
      const user = await this.octokit.users.getAuthenticated();
      return { ok: true, user: user.data.login };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}

/**
 * Create GitHub service instance from environment variables
 */
export function createGitHubService(): GitHubService | null {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    console.warn('GitHub integration disabled: missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO');
    return null;
  }

  return new GitHubService({ token, owner, repo });
}