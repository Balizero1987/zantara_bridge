# 🔗 GitHub Integration for Zantara Bridge

This document describes the GitHub integration features added to Zantara Bridge, enabling AI-powered automation with Claude Code and Codex Pro.

## 🚀 Features

### 1. **Smart Brief Posting**
- Automatically posts daily briefs to GitHub as issues
- Extracts and enriches GitHub references (commits, issues, PRs)
- Labels issues for AI processing

### 2. **GitHub Reference Detection**
- Detects GitHub URLs in notes: commits, issues, PRs
- Simple issue references: `#123`
- Enriches briefs with commit details, issue status, PR info

### 3. **AI Webhook Integration** 
- Claude Code webhook for automated responses
- GitHub Actions workflows for issue processing
- Bidirectional communication between AI tools and GitHub

### 4. **Backward Compatibility**
- All existing functionality (Drive Brief, Notes API) unchanged
- GitHub integration is optional and configurable

## 🔧 Configuration

### Environment Variables

```bash
# Required for GitHub integration
GITHUB_TOKEN=ghp_xxxxxxxxxxxx          # GitHub Personal Access Token
GITHUB_OWNER=your-username             # GitHub username/org
GITHUB_REPO=your-repo                  # Repository name

# Optional
GITHUB_POST_BRIEF=true                 # Auto-post briefs to GitHub (default: false)
```

### GitHub Token Permissions

Your GitHub token needs these scopes:
- `repo` - Full repository access
- `issues` - Read/write issues and comments

## 📡 API Endpoints

### GitHub Brief
```bash
POST /api/github/brief
{
  "dateKey": "2025-09-11",
  "postToGitHub": true  # optional override
}
```

### Analyze GitHub References
```bash
POST /api/github/analyze  
{
  "dateKey": "2025-09-11"
}
```

### GitHub Connection Test
```bash
GET /api/github/_test
```

### Webhooks
```bash
POST /api/webhooks/github           # GitHub webhook handler
POST /api/webhooks/claude-code      # Claude Code integration
POST /api/webhooks/ai-notification  # Generic AI notifications
```

## 🤖 AI Workflow

### 1. **Note Creation**
```
User writes note: "Fixed login bug, see commit https://github.com/user/repo/commit/abc123"
```

### 2. **Brief Generation**
```bash
curl -X POST "$URL/api/github/brief" \\
  -H "X-API-KEY: $KEY" \\
  -H "X-BZ-USER: boss" \\
  -d '{"dateKey":"2025-09-11"}'
```

### 3. **GitHub Issue Created**
```markdown
# Daily Brief - BOSS - 2025-09-11

## Notes
- Fixed login bug: Fixed authentication validation issue

## 🔗 GitHub Activity

### Commit: abc123
**Message**: Fix authentication validation issue  
**Files changed**: 3
**Link**: https://github.com/user/repo/commit/abc123
```

### 4. **AI Processing**
- GitHub Actions workflow triggers
- Claude Code receives webhook notification  
- AI analyzes issue and takes automated actions
- Results posted back as comments

## 🧪 Testing

### Run Integration Tests
```bash
# Local testing
./scripts/test-github-integration.sh

# With custom URL/key
./scripts/test-github-integration.sh "https://your-app.com" "your-api-key"
```

### Manual Testing
```bash
# Test GitHub connection
curl -H "X-API-KEY: $KEY" "$URL/api/github/_test"

# Create note with GitHub reference  
curl -X POST "$URL/api/notes" \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: $KEY" \\
  -d '{
    "title": "Bug fix",
    "content": "Fixed issue #123, see commit https://github.com/user/repo/commit/abc"
  }'

# Generate GitHub brief
curl -X POST "$URL/api/github/brief" \\
  -H "X-API-KEY: $KEY" \\
  -d '{"dateKey":"2025-09-11"}'
```

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Zantara UI    │───▶│ Zantara Bridge  │───▶│   GitHub API    │
│  (Notes Input)  │    │  (Brief Gen)    │    │ (Issues/Comments)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Google Drive    │    │   Firestore     │    │ GitHub Actions  │
│ (DOCX Brief)    │    │ (Notes Storage) │    │  (AI Triggers)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Claude Code   │
                                                │ (AI Processing) │
                                                └─────────────────┘
```

## 🏷 GitHub Labels

The integration automatically manages these labels:

- `zantara-brief` - Issues created by Zantara Bridge
- `daily-brief` - Daily brief issues  
- `ai-ready` - Issues ready for AI processing
- `claude-code-candidate` - Issues suitable for Claude Code
- `development` - Development-related issues
- `github-refs` - Issues with GitHub references

## 🔄 Workflow Examples

### Development Brief Workflow
1. Developer works on code, makes commits
2. Adds notes: "Fixed auth bug, commit abc123, opened PR #456"  
3. End of day: generates brief via Zantara
4. Brief posted to GitHub with enriched commit/PR data
5. GitHub Actions triggers Claude Code
6. Claude Code analyzes, adds comments, potentially creates follow-up PRs

### Issue Tracking Workflow  
1. Note mentions issue: "Working on #123, almost ready"
2. Brief generation links to actual GitHub issue
3. Issue gets commented with brief update
4. Team has visibility on progress
5. AI tools can suggest next steps or offer help

## 🚨 Troubleshooting

### Common Issues

**GitHub connection fails**
```bash
# Check token and permissions
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

**References not detected**  
- Ensure URLs are complete: `https://github.com/owner/repo/commit/sha`
- Simple refs need proper format: `#123` (not `issue #123`)

**Webhooks not triggering**
- Check GitHub webhook configuration
- Verify webhook URL is accessible
- Check logs for webhook payloads

### Debug Mode
Set `DEBUG=true` for verbose logging:
```bash
DEBUG=true npm run dev
```

## 🔐 Security Notes

- GitHub tokens should be stored in Secret Manager (production)
- Webhook endpoints are protected by API key middleware  
- AI processing logs are sanitized (no secrets leaked)
- Issue comments are public - avoid posting sensitive data

## 📈 Future Enhancements

- **Multi-repo support** - Track references across multiple repositories
- **Smart labeling** - AI-powered automatic issue categorization  
- **Metrics dashboard** - Developer productivity insights
- **Slack integration** - Notifications to development channels
- **Code review automation** - AI-assisted PR reviews

---

*Generated with Zantara Bridge GitHub Integration v1.0*