# Railway Deployment Specification: Push Services

**Project:** Push-Blaster & Push-Cadence-Service
**Platform:** Railway.app
**Date:** 2025-01-27
**Status:** Ready for Deployment

---

## Executive Summary

This specification outlines the Railway deployment configuration for two interdependent Next.js services in a monorepo structure:

1. **push-cadence-service** (Port 3002) - Stateless safeguard microservice (background only, no UI)
2. **push-blaster** (Port 3001) - Automation orchestrator UI (depends on cadence service URL)

**Deployment Strategy:** GitHub-first via Railway dashboard (no CLI project creation needed)

**Deployment Order:** Cadence service MUST be deployed first to obtain its Railway URL for push-blaster configuration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Railway Project: push-cadence-production     │
│                                                      │
│  Service: push-cadence-service                       │
│  - Root Dir: apps/push-cadence-service              │
│  - Port: Auto-assigned by Railway                   │
│  - Public URL: https://push-cadence-production      │
│               .up.railway.app                        │
│  - Health: /api/health                              │
└─────────────────────────────────────────────────────┘
                          │
                          │ CADENCE_SERVICE_URL
                          ▼
┌─────────────────────────────────────────────────────┐
│         Railway Project: push-blaster-production     │
│                                                      │
│  Service: push-blaster                              │
│  - Root Dir: apps/push-blaster                      │
│  - Port: Auto-assigned by Railway                   │
│  - Public URL: https://push-blaster-production      │
│               .up.railway.app                        │
│  - Health: /api/health                              │
│  - Depends on: Cadence Service URL                  │
└─────────────────────────────────────────────────────┘
                          │
                          │ Uses
                          ▼
┌─────────────────────────────────────────────────────┐
│         External: Neon PostgreSQL Database          │
│                                                      │
│  - Managed outside Railway                          │
│  - Connection via DATABASE_URL                      │
│  - SSL required (?sslmode=require)                  │
└─────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### Repository State
- [x] Health check endpoints created for both services
- [x] package.json files configured with engines and start:railway script
- [x] .npmrc files created (legacy-peer-deps=true)
- [x] Railway CLI installed (v4.10.0)
- [ ] Git changes committed
- [ ] User authenticated with Railway (`railway login`)

### Environment Variables Prepared
- [ ] DATABASE_URL (Neon PostgreSQL with ?sslmode=require)
- [ ] FIREBASE_SERVICE_ACCOUNT_KEY (entire JSON as string)
- [ ] CADENCE_SERVICE_URL (obtained after deploying cadence service)

---

## Service 1: Push-Cadence-Service

### Service Configuration

**Railway Project Name:** `push-cadence-production`

**Root Directory:** `apps/push-cadence-service`

**Build Configuration:**
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run start:railway`
- **Node Version:** 20.19.5 (pinned via package.json engines)

### Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

**Critical Notes:**
- `DATABASE_URL` MUST include `?sslmode=require` for secure Neon connection
- Railway auto-sets `PORT` environment variable (Next.js respects this automatically)

### Health Check Endpoint

```
GET https://push-cadence-production.up.railway.app/api/health

Expected Response:
{
  "status": "healthy",
  "service": "push-cadence",
  "timestamp": "2025-01-27T...",
  "database": "connected",
  "memoryUsage": {...}
}
```

### Deployment Steps (GitHub-First via Dashboard)

**Create Project:**
1. Go to Railway Dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `main-ai-apps` repository
4. Railway auto-detects and deploys

**Configure Service:**
1. Settings → Service Name: `push-cadence-service`
2. Settings → Root Directory: `apps/push-cadence-service`
3. Settings → Build Command: `npm ci && npm run build`
4. Settings → Start Command: `npm run start:railway`
5. Settings → Deploy → Watch Paths: `apps/push-cadence-service/**`

**Add Environment Variables (via Variables tab):**
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...?sslmode=require`

**Generate Domain:**
- Settings → Domains → Generate Domain
- Save this URL - needed for push-blaster!

Railway automatically deploys on configuration save and on future GitHub pushes.

### Verification

```bash
# Check health endpoint
curl https://push-cadence-production.up.railway.app/api/health | jq

# Monitor logs
railway logs --follow

# Check deployment status
railway status
```

---

## Service 2: Push-Blaster

### Service Configuration

**Railway Project Name:** `push-blaster-production`

**Root Directory:** `apps/push-blaster`

**Build Configuration:**
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run start:railway`
- **Node Version:** 20.19.5 (pinned via package.json engines)

### Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
CADENCE_SERVICE_URL=https://push-cadence-production.up.railway.app
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

**Critical Notes:**
- `CADENCE_SERVICE_URL` must be the Railway URL from push-cadence-service deployment
- `FIREBASE_SERVICE_ACCOUNT_KEY` must be the entire JSON object as a single-line string
- Use single quotes around Firebase key to preserve JSON structure

### Health Check Endpoint

```
GET https://push-blaster-production.up.railway.app/api/health

Expected Response:
{
  "status": "healthy",
  "service": "push-blaster",
  "timestamp": "2025-01-27T...",
  "instanceId": "engine-...",
  "scheduledJobs": 0,
  "activeExecutions": 0,
  "memoryUsage": {...}
}
```

### Deployment Steps (GitHub-First via Dashboard)

**Add Service to Railway Project:**
1. In Railway project, click "+ New" → "GitHub Repo"
2. Select `main-ai-apps` repository
3. Railway deploys second service in same project

**Configure Service:**
1. Settings → Service Name: `push-blaster`
2. Settings → Root Directory: `apps/push-blaster`
3. Settings → Build Command: `npm ci && npm run build`
4. Settings → Start Command: `npm run start:railway`
5. Settings → Deploy → Watch Paths: `apps/push-blaster/**`

**Add Environment Variables (via Variables tab):**
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...?sslmode=require`
- `CADENCE_SERVICE_URL=https://push-cadence-production.up.railway.app`
- `FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}`

**Generate Domain:**
- Settings → Domains → Generate Domain
- This becomes your public push-blaster UI URL

Railway automatically deploys on configuration save and on future GitHub pushes.

### Verification

```bash
# Check health endpoint
curl https://push-blaster-production.up.railway.app/api/health | jq

# Test automation debug endpoint
curl https://push-blaster-production.up.railway.app/api/automation/debug | jq

# Monitor logs
railway logs --follow

# Check deployment status
railway status
```

---

## Inter-Service Communication Testing

### Test 1: Cadence Service Reachability

```bash
# From push-blaster, test cadence filtering
curl -X POST https://push-blaster-production.up.railway.app/api/test-cadence \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["test-uuid"], "layerId": 3}'
```

### Test 2: End-to-End Automation Flow

```bash
# Access push-blaster UI
open https://push-blaster-production.up.railway.app

# Create a test automation
# Verify it can:
# 1. Schedule via AutomationEngine
# 2. Filter audiences via Cadence Service
# 3. Send pushes via Firebase
```

---

## Monorepo-Specific Configuration

### Why Root Directory is Critical

Railway by default builds from repository root. For monorepo apps:

```
main-ai-apps/               ← Railway clones here
├── apps/
│   ├── push-blaster/       ← Need to build from HERE
│   │   ├── package.json
│   │   └── src/
│   └── push-cadence-service/  ← Or HERE
│       ├── package.json
│       └── src/
└── package.json            ← NOT here
```

**Solution:** Set "Root Directory" in Railway Dashboard to point to the correct app directory.

### Build Process

1. Railway clones entire repo
2. Changes to Root Directory (e.g., `apps/push-blaster`)
3. Runs `npm ci` (installs dependencies from that directory's package.json)
4. Runs `npm run build` (Next.js build)
5. Runs `npm run start:railway` (Next.js production server)

---

## Environment Variable Management

### Option 1: Railway CLI (Recommended for Bulk)

```bash
# Set individual variables
railway variables set KEY=value

# View all variables
railway variables

# Delete a variable
railway variables delete KEY
```

### Option 2: Railway Dashboard (Recommended for Secrets)

1. Navigate to project: `railway open`
2. Click "Variables" tab
3. Click "+ New Variable"
4. Enter key-value pairs
5. Railway auto-redeploys on save

### Option 3: Programmatic (Advanced)

```bash
# Using Railway GraphQL API
# Requires authentication token
# See: https://docs.railway.app/reference/public-api
```

---

## Database Connection Configuration

### Neon PostgreSQL Setup

**Connection String Format:**
```
postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech:5432/dbname?sslmode=require
```

**Important:**
- SSL is mandatory (`?sslmode=require`)
- Use pooled connection for runtime (both services)
- Neon auto-manages connection pooling

### Testing Database Connection

```bash
# Via Railway CLI (runs command in Railway environment)
railway run -- node -e "const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL});pool.query('SELECT NOW()',(err,res)=>{console.log(err||res.rows);pool.end()});"
```

---

## Deployment Workflow

### Initial Deployment (GitHub-First)

**Phase 1: Push Code to GitHub**
1. Commit Railway deployment changes
2. Push to `main` branch: `git push origin main`

**Phase 2: Deploy Cadence Service**
1. Railway Dashboard → "New Project" → "Deploy from GitHub repo"
2. Select `main-ai-apps` repository
3. Configure service settings (root directory, build/start commands)
4. Add environment variables via Variables tab
5. Generate domain and **save URL** (needed for push-blaster)
6. Verify health: `curl .../api/health`

**Phase 3: Deploy Push-Blaster**
1. In Railway project → "+ New" → "GitHub Repo"
2. Select `main-ai-apps` repository (adds second service)
3. Configure service settings (root directory, build/start commands)
4. Add environment variables (including CADENCE_SERVICE_URL from Phase 2)
5. Generate domain
6. Verify health: `curl .../api/health`
7. Test automation creation in UI

### Continuous Deployment (Automatic)

GitHub integration is built-in when deploying from GitHub repo.

**Auto-Deploy Flow:**
```
git push origin main
    ↓
Railway detects commit
    ↓
Checks Watch Paths (apps/push-blaster/** or apps/push-cadence-service/**)
    ↓
If matched → Runs build command
    ↓
Runs start command
    ↓
Health check passes
    ↓
New deployment live (~2-3 minutes)
```

**Selective Rebuilds:** Watch Paths ensure only affected services rebuild when monorepo files change.

---

## Troubleshooting

### Issue: Build Fails with Module Not Found

**Cause:** Root directory not configured correctly

**Solution:**
```bash
railway open
# Navigate to Settings → Root Directory
# Set to: apps/push-blaster OR apps/push-cadence-service
```

### Issue: Health Check Returns 502/503

**Cause:** Service not binding to Railway's PORT

**Solution:**
- Verify `start:railway` script uses `next start` (respects PORT automatically)
- Check logs: `railway logs --build`

### Issue: Database Connection Failed

**Cause:** Missing `?sslmode=require` in DATABASE_URL

**Solution:**
```bash
railway variables set DATABASE_URL="postgresql://...?sslmode=require"
```

### Issue: Push-Blaster Can't Reach Cadence Service

**Cause:** Incorrect CADENCE_SERVICE_URL

**Solution:**
```bash
# Get correct URL from cadence deployment
cd /path/to/cadence/project
railway domain

# Update push-blaster environment
cd /path/to/push-blaster/project
railway variables set CADENCE_SERVICE_URL="https://correct-url.up.railway.app"
```

### Issue: Firebase Push Delivery Fails

**Cause:** Invalid FIREBASE_SERVICE_ACCOUNT_KEY format

**Solution:**
```bash
# Ensure entire JSON is properly escaped
railway variables set FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}'
```

---

## Monitoring & Operations

### View Logs

```bash
# Recent logs (last 100 lines)
railway logs

# Follow live logs
railway logs --follow

# Build logs only
railway logs --build

# Export to file
railway logs --json > deployment-logs.json
```

### Check Service Status

```bash
# Project status
railway status

# Deployment history
railway list

# Current environment
railway environment
```

### Restart Service

```bash
# Trigger new deployment
railway up

# Or via dashboard
railway open
# Click "Deployments" → "Redeploy"
```

---

## Cost Estimation

**Railway Pricing (as of 2025):**
- **Free Tier:** $5 credit/month (suitable for hobby projects)
- **Developer Plan:** $5/user/month + usage
- **Team Plan:** $20/user/month + usage

**Usage-Based Costs:**
- CPU: ~$0.000463/vCPU minute
- Memory: ~$0.000231/GB minute
- Egress: ~$0.10/GB

**Estimated Monthly Costs (Light Production):**
- Cadence Service: ~$5-10/month
- Push-Blaster: ~$10-15/month
- Total: ~$15-25/month

**Note:** Neon database costs are separate (Neon has free tier up to 3 GB)

---

## Security Considerations

### Environment Variables
- Never commit `.env` files to Git
- Use Railway Variables for all secrets
- Rotate Firebase service account keys quarterly

### Database Access
- Always use `?sslmode=require`
- Use connection pooling (handled by pg Pool)
- Limit database user permissions to minimum required

### API Security
- Health endpoints are public (non-sensitive data only)
- Automation APIs should implement authentication (TODO)
- Use Railway's built-in HTTPS (automatic)

---

## Rollback Procedure

### Rollback via Railway Dashboard

1. Open Railway: `railway open`
2. Navigate to "Deployments" tab
3. Find last successful deployment
4. Click "Redeploy" on that version

### Rollback via CLI

```bash
# View deployment history
railway list

# Redeploy specific version (if supported)
# Or roll back git commit and redeploy
git revert HEAD
git push origin main
# Railway auto-deploys reverted version
```

---

## Post-Deployment Checklist

### Cadence Service
- [ ] Health endpoint returns 200 OK
- [ ] Database query succeeds (`database: "connected"`)
- [ ] Logs show no errors
- [ ] Railway URL saved for push-blaster config

### Push-Blaster
- [ ] Health endpoint returns 200 OK
- [ ] AutomationEngine initialized (instanceId present)
- [ ] Can reach cadence service (scheduledJobs: 0)
- [ ] UI accessible in browser
- [ ] Test automation can be created

### Integration
- [ ] Create test automation in push-blaster UI
- [ ] Verify cadence filtering works
- [ ] Verify Firebase push delivery (test user)
- [ ] Check logs for inter-service communication

---

## Maintenance

### Weekly
- Check deployment logs for errors
- Monitor Railway resource usage
- Review scheduled automations

### Monthly
- Review and optimize database queries
- Check Railway costs and usage
- Update Node.js/dependencies if needed

### Quarterly
- Rotate Firebase service account keys
- Review and update environment variables
- Performance audit (response times, memory)

---

## Support & Documentation

**Railway Documentation:**
- https://docs.railway.app
- https://docs.railway.app/reference/cli-api

**Push Services Documentation:**
- [Push Notifications Technical Guide](../developer-guides/push-notifications-detailed.md)
- [Main AI Apps Overview](../developer-guides/main-ai-apps-overview.md)

**Railway Community:**
- Discord: https://discord.gg/railway
- GitHub: https://github.com/railwayapp

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-27 | 1.0 | Initial deployment specification created |

---

**Specification Status:** ✅ READY FOR DEPLOYMENT

**Next Action:** Execute deployment following manual steps document
