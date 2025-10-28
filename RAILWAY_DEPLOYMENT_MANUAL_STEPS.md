# Railway Deployment: GitHub-First Approach

**All code setup is complete.** This document contains the simple Railway dashboard steps to deploy your push services.

---

## Prerequisites Completed ✅

- [x] Health check endpoints created (`/api/health` for both services)
- [x] package.json files configured with Node.js engines and Railway scripts
- [x] .npmrc files created (resolves peer dependency issues)
- [x] Dev-hub landing page has push-blaster link
- [x] Push-cadence-service configured as background service

---

## Deployment Overview

**Architecture:**
- **dev-hub** (main landing page) → Links to push-blaster UI
- **push-blaster** (Port 3001) → User-facing automation UI
- **push-cadence-service** (Port 3002) → Background safeguard service (no UI)

**Deployment Strategy:** GitHub-first (no CLI needed)

---

## Step 1: Push Code to GitHub

```bash
# Add .npmrc files (protected by file-guard)
git add apps/push-blaster/.npmrc apps/push-cadence-service/.npmrc -f

# Commit all Railway deployment changes
git commit -m "feat: Railway deployment setup for push services

- Add health check endpoints for both services
- Configure package.json with Railway scripts and Node.js version pinning
- Add .npmrc files for dependency resolution
- Update deployment documentation

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main
git push origin main
```

---

## Step 2: Deploy Push-Cadence-Service (First)

### Why First?
Push-blaster needs the cadence service URL as an environment variable.

### 2.1: Create Railway Project from GitHub

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose repository: **main-ai-apps**
5. Click **"Deploy Now"**

### 2.2: Configure Service Settings

1. Click on the newly created service
2. Go to **Settings** tab
3. Set **Service Name**: `push-cadence-service`
4. Set **Root Directory**: `apps/push-cadence-service`
5. Set **Build Command**: `npm ci && npm run build`
6. Set **Start Command**: `npm run start:railway`
7. Expand **Deploy** section → Enable **"Watch Paths"** → Add: `apps/push-cadence-service/**`

### 2.3: Add Environment Variables

In the **Variables** tab, add:

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

**Important:** Replace with your actual Neon PostgreSQL URL. The `?sslmode=require` suffix is mandatory.

### 2.4: Get Service URL

1. Go to **Settings** tab
2. Scroll to **Domains** section
3. Click **"Generate Domain"**
4. **Copy this URL!** Example: `https://push-cadence-service-production.up.railway.app`

You'll need this for push-blaster in Step 3.

### 2.5: Verify Deployment

Wait for deployment to complete (~2-3 minutes), then test:

```bash
curl https://your-cadence-url.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "push-cadence",
  "database": "connected",
  "timestamp": "2025-01-27T...",
  "memoryUsage": {...}
}
```

---

## Step 3: Deploy Push-Blaster (Second)

### 3.1: Add Second Service to Railway Project

1. In your Railway project, click **"+ New"** button
2. Select **"GitHub Repo"**
3. Choose the same **main-ai-apps** repository
4. Click **"Deploy Now"**

### 3.2: Configure Service Settings

1. Click on the new service
2. Go to **Settings** tab
3. Set **Service Name**: `push-blaster`
4. Set **Root Directory**: `apps/push-blaster`
5. Set **Build Command**: `npm ci && npm run build`
6. Set **Start Command**: `npm run start:railway`
7. Expand **Deploy** section → Enable **"Watch Paths"** → Add: `apps/push-blaster/**`

### 3.3: Add Environment Variables

In the **Variables** tab, add:

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
CADENCE_SERVICE_URL=https://your-cadence-url-from-step-2.4.up.railway.app
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**Replace the placeholders:**
- `DATABASE_URL` - Your Neon PostgreSQL URL (same as Step 2.3)
- `CADENCE_SERVICE_URL` - The URL you copied from Step 2.4
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Your entire Firebase service account JSON (single line)

### 3.4: Generate Public Domain

1. Go to **Settings** tab
2. Scroll to **Domains** section
3. Click **"Generate Domain"**
4. **Save this URL!** Example: `https://push-blaster-production.up.railway.app`

### 3.5: Verify Deployment

Wait for deployment to complete (~3-5 minutes), then test:

```bash
# Test health endpoint
curl https://your-push-blaster-url.up.railway.app/api/health

# Open UI in browser
open https://your-push-blaster-url.up.railway.app
```

Expected health response:
```json
{
  "status": "healthy",
  "service": "push-blaster",
  "instanceId": "engine-...",
  "scheduledJobs": 0,
  "activeExecutions": 0,
  "timestamp": "2025-01-27T...",
  "memoryUsage": {...}
}
```

---

## Step 4: Enable Auto-Deploy

Both services are now configured with GitHub integration. Any push to `main` branch will automatically trigger redeployment.

**Watch Paths Configuration:**
- `push-cadence-service` only redeploys when files in `apps/push-cadence-service/**` change
- `push-blaster` only redeploys when files in `apps/push-blaster/**` change

This prevents unnecessary rebuilds when you modify other apps in the monorepo.

---

## Step 5: Access Your Services

### Dev-Hub Landing Page
Once you deploy dev-hub (same process), it will serve as your main entry point with links to:
- Email Hub
- Push Blaster

### Direct Access
- **Push Blaster UI**: `https://push-blaster-production.up.railway.app`
- **Cadence Service** (background only): `https://push-cadence-service-production.up.railway.app`

---

## Troubleshooting

### Build Fails with "Module Not Found"

**Cause:** Root directory not set correctly

**Fix:**
1. Go to **Settings** tab
2. Check **Root Directory** is set to correct app path
3. Verify **Watch Paths** is configured

### Health Check Returns 502/503

**Cause:** Service failed to start

**Fix:**
1. Check **Deployments** tab for build logs
2. Look for errors in build or start phase
3. Verify `start:railway` script exists in package.json

### Database Connection Failed

**Cause:** Missing `?sslmode=require` in DATABASE_URL

**Fix:**
1. Go to **Variables** tab
2. Edit `DATABASE_URL` to include `?sslmode=require` suffix
3. Service will auto-redeploy with new variable

### Push-Blaster Can't Reach Cadence Service

**Cause:** Incorrect `CADENCE_SERVICE_URL`

**Fix:**
1. Get correct URL from cadence service **Settings** → **Domains**
2. Update `CADENCE_SERVICE_URL` variable in push-blaster
3. Wait for automatic redeploy

---

## Monitoring

### View Logs
1. Click on service in Railway dashboard
2. Go to **Deployments** tab
3. Click on latest deployment
4. View **Build Logs** or **Deploy Logs**

### Check Service Status
Dashboard shows real-time status:
- 🟢 Green = Healthy
- 🟡 Yellow = Building/Deploying
- 🔴 Red = Failed/Crashed

---

## What You Need to Provide

1. **GitHub Repository Access** - Authorize Railway to access main-ai-apps repo
2. **Neon Database URL** - PostgreSQL connection string with `?sslmode=require`
3. **Firebase Service Account Key** - Entire JSON as a single-line string

That's it! Railway handles everything else automatically.

---

## Cost Estimation

**Railway Pricing (2025):**
- Free tier: $5 credit/month
- Developer plan: $5/user/month + usage

**Estimated Monthly Cost:**
- Cadence service: ~$5-10
- Push-blaster: ~$10-15
- **Total: ~$15-25/month**

---

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Deploy push-cadence-service via Railway dashboard
3. ✅ Deploy push-blaster via Railway dashboard
4. 🎯 Create test automation in push-blaster UI
5. 🎯 Verify push notification delivery
6. 🎯 Deploy dev-hub landing page (optional - same process)
