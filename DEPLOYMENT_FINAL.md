# 🚀 ZANTARA Bridge - Final Deployment Checklist

## 📊 Current Status: 98% Complete ✅

All core services are **LIVE and FUNCTIONAL**:
- ✅ **Backend**: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
- ✅ **Dashboard**: https://68c7ac506134462ec82d7384--zantara-dashboard1.netlify.app
- ✅ **Analytics API**: `/api/analytics` 
- ✅ **Compliance API**: `/api/compliance/*`
- ✅ **Drive Upload**: AMBARADAM folder working
- ✅ **Gmail/Calendar**: Domain-wide delegation configured
- ✅ **Knowledge Base**: 3 compliance documents loaded

## ⚠️ Final 2 Issues to Fix

### 1. 🔑 OpenAI API Key (Critical)

**Problem**: Current API key `sk-proj-***EQcA` is expired/invalid
**Impact**: Assistant endpoints return 401 errors

**Fix**:
```bash
# Get new OpenAI API key from platform.openai.com
# Update Cloud Run:
gcloud run services update zantara-bridge-v2-prod \
  --region=asia-southeast2 \
  --project=involuted-box-469105-r0 \
  --update-env-vars=OPENAI_API_KEY=sk-xxxxx-NEW-KEY-HERE
```

**Test**:
```bash
curl -X POST "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/assistant/ask" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "X-BZ-USER: BOSS" \
  -d '{"question":"What is KITAS renewal process?"}'
```

### 2. 📝 Apps Script Deployment (Optional)

**Problem**: APPS_SCRIPT_URL not configured
**Impact**: Drive uploads use slower direct API (still works)

**Fix**:
1. Go to [script.google.com](https://script.google.com)
2. Create new project: "ZANTARA-Bridge-Drive"
3. Copy code from `apps-script-code.gs`
4. Deploy > New deployment > Web app
   - Execute as: **Me**
   - Access: **Anyone**
5. Copy deployment URL
6. Update Cloud Run:
```bash
gcloud run services update zantara-bridge-v2-prod \
  --region=asia-southeast2 \
  --project=involuted-box-469105-r0 \
  --update-env-vars=APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_ID/exec"
```

## 🧪 Health Check Commands

```bash
# Service health
curl https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health

# Analytics
curl -H "x-api-key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
     -H "X-BZ-USER: BOSS" \
     https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/analytics

# Compliance emails
curl -H "x-api-key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
     -H "X-BZ-USER: BOSS" \
     https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/compliance/emails/BOSS
```

## 🔑 Credentials

- **API Key**: `7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3`
- **Service Account**: `zantara@involuted-box-469105-r0.iam.gserviceaccount.com`
- **AMBARADAM Folder**: `1UGbm5er6Go351S57GQKUjmxMxHyT4QZb`
- **IMPERSONATE_USER**: `zero@balizero.com`
- **Project**: `involuted-box-469105-r0`

## 🎯 Expected Result

✅ **With OpenAI API key**: Assistant AI fully operational  
✅ **With Apps Script**: Instant Drive uploads  
✅ **Current state**: All compliance, monitoring, and dashboard features working

## 🚀 Post-Deployment

Once both fixes are applied:
- **ZANTARA Bridge**: 100% production ready
- **All services**: Fully operational
- **Team**: Can proceed with Indonesian compliance automation

---

*Last updated: 2025-09-15*  
*Status: Ready for final deployment*