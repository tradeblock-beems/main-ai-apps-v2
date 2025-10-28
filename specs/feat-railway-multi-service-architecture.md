# Railway Multi-Service Architecture for Main-AI-Apps Monorepo

**Status**: Draft
**Author**: Claude Code
**Date**: 2025-10-28

## Overview

Configure Railway to automatically deploy all 5 applications in the main-ai-apps monorepo as separate services, with dev-hub acting as the main landing page and API gateway/reverse proxy to route traffic to other services.

## Problem Statement

Currently, Railway is deploying only a single service (push-cadence-service) due to explicit root-level `railway.toml` configuration. The user needs:

1. All applications deployed independently as separate Railway services for "quarantined" testing environments
2. Dev-hub to serve as the main entry point and route traffic to other services
3. Simplified deployment process that leverages Railway's automatic monorepo detection

When navigating to the public URL, users currently see the default Next.js page from push-cadence-service instead of the dev-hub landing page with tiles linking to all applications.

## Goals

- Remove root-level Railway configuration to enable automatic monorepo detection
- Configure dev-hub as an API gateway with environment-based service URLs
- Ensure all 5 applications can deploy independently on Railway
- Maintain dev-hub as the main landing page accessible at the root domain
- Keep existing local development workflow intact

## Non-Goals

- Changing the local development environment or PM2 configuration
- Implementing new features beyond deployment configuration
- Creating custom build processes or Docker configurations
- Setting up CI/CD pipelines or automated testing in Railway
- Implementing service mesh or advanced networking beyond simple HTTP proxying
- Performance optimization or caching strategies
- Monitoring, logging, or observability setup
- Database migration or data synchronization between services

## Technical Approach

### Current State

- Root `railway.toml` forces single-app deployment of push-cadence-service
- Root `nixpacks.toml` forces Node.js 20 for all builds
- Dev-hub `next.config.mjs` has rewrites pointing to localhost URLs
- Push-blaster and push-cadence-service have `start:railway` scripts
- Dev-hub and analytics-dashboard lack `start:railway` scripts

### Proposed Architecture

**Railway Auto-Detection**: When root `railway.toml` is removed, Railway automatically detects monorepo structure and creates separate services for each deployable application.

**Service Configuration**:
1. **dev-hub** (Next.js) - Main landing page and API gateway at root domain
2. **push-blaster** (Next.js) - Push notification management UI
3. **push-cadence-service** (Next.js) - Backend API for scheduled pushes
4. **analytics-dashboard** (Next.js) - Analytics visualization UI
5. **email-hub** (Python/Flask) - Email service backend

**Gateway Pattern**: Dev-hub uses Next.js rewrites to proxy requests to other services via Railway's internal networking using environment variables for service URLs.

## Implementation Details

### 1. Remove Root-Level Configuration Files

**Files to delete**:
- `railway.toml` (forces single-service deployment)
- `nixpacks.toml` (forces Node.js version globally)

**Rationale**: Railway's auto-detection creates optimal configurations for each service individually.

### 2. Add Per-App Configuration Files

Each Next.js app needs a `railway.toml` in its directory to specify Node.js 20:

**Create `apps/dev-hub/railway.toml`**:
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:railway"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Create `apps/dev-hub/nixpacks.toml`**:
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]
```

**Create `apps/analytics-dashboard/railway.toml`**:
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:railway"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Create `apps/analytics-dashboard/nixpacks.toml`**:
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]
```

**Note**: push-blaster and push-cadence-service already have proper configuration. Email-hub is Python/Flask and will be auto-detected correctly.

### 3. Add Missing Railway Scripts

**Update `apps/dev-hub/package.json`**:
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:hub": "dotenv -e ../../.env -- next dev",
    "build": "next build",
    "start": "next start",
    "start:railway": "next start",
    "lint": "next lint"
  }
}
```

**Update `apps/analytics-dashboard/package.json`**:
```json
{
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "start:railway": "next start",
    "lint": "eslint"
  }
}
```

### 4. Update Dev-Hub Rewrites with Environment Variables

**Update `apps/dev-hub/next.config.mjs`**:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/email-hub/:path*',
        destination: `${process.env.EMAIL_HUB_URL || 'http://localhost:5001'}/email-hub/:path*`,
      },
      {
        source: '/push-blaster/:path*',
        destination: `${process.env.PUSH_BLASTER_URL || 'http://localhost:3001'}/push-blaster/:path*`,
      },
      {
        source: '/analytics-dashboard/:path*',
        destination: `${process.env.ANALYTICS_DASHBOARD_URL || 'http://localhost:3003'}/analytics-dashboard/:path*`,
      },
      {
        source: '/push-cadence/:path*',
        destination: `${process.env.PUSH_CADENCE_URL || 'http://localhost:3002'}/push-cadence/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

**Rationale**:
- Environment variables allow different URLs for Railway (production) vs. localhost (development)
- Defaults maintain existing local development workflow
- Railway provides service URLs via environment variables or internal networking

### 5. Railway Environment Variables Configuration

For dev-hub service in Railway dashboard, add these environment variables:

```
EMAIL_HUB_URL=https://email-hub-production.up.railway.app
PUSH_BLASTER_URL=https://push-blaster-production.up.railway.app
ANALYTICS_DASHBOARD_URL=https://analytics-dashboard-production.up.railway.app
PUSH_CADENCE_URL=https://push-cadence-production.up.railway.app
```

**Note**: These URLs will be provided by Railway after services are deployed. Update them in the Railway dashboard under the dev-hub service.

### 6. Railway Service URLs and Routing

**Root Domain Assignment**:
- Assign the main Railway domain (e.g., `main-ai-apps-v2-production.up.railway.app`) to the **dev-hub** service
- Dev-hub becomes the entry point for all traffic

**Service-Specific Domains**:
- Each service gets its own Railway-generated URL
- These URLs are used for direct service access (testing) and inter-service communication
- Services are accessible both via their direct URLs and through dev-hub's proxy routes

## Testing Approach

### Manual Testing Steps

1. **Deploy Verification**:
   - Push changes to GitHub main branch
   - Verify Railway auto-detects all 5 services in the dashboard
   - Confirm each service builds successfully
   - Check that all services have healthy status

2. **Dev-Hub Gateway Testing**:
   - Navigate to root domain → verify dev-hub landing page loads with all app tiles
   - Click Email Hub tile → verify routing to `/email-hub`
   - Click Push Blaster tile → verify routing to `/push-blaster`
   - Click Analytics Dashboard tile → verify routing to `/analytics-dashboard`

3. **Direct Service Access**:
   - Access each service's Railway URL directly
   - Verify health check endpoints return healthy status
   - Confirm services are independently functional

4. **Local Development Verification**:
   - Run `npm run dev` in each app directory
   - Verify localhost URLs still work with default fallbacks
   - Confirm no regression in local development workflow

### Success Criteria

- ✅ Railway dashboard shows 5 separate services
- ✅ All services deploy successfully with healthy status
- ✅ Root domain shows dev-hub landing page (not default Next.js page)
- ✅ All proxy routes from dev-hub work correctly
- ✅ Local development still functions with localhost defaults
- ✅ Each service accessible via its own Railway URL

## Open Questions

1. **Railway Service Naming**: Will Railway auto-name services as `dev-hub`, `push-blaster`, etc., or use different names?
   - **Resolution**: Monitor first deployment and rename services in Railway dashboard if needed

2. **Email-Hub Basepath**: Does Flask app serve routes under `/email-hub` basepath or at root?
   - **Resolution**: May need to configure Flask app with basepath or adjust dev-hub rewrite

3. **Inter-Service Dependencies**: Does push-blaster need to communicate directly with push-cadence-service?
   - **Current Assumption**: Yes, push-blaster already has `CADENCE_SERVICE_URL` env var
   - **Action**: Ensure this env var is set in Railway dashboard

4. **Watch Paths**: Should we configure watch paths to prevent unnecessary rebuilds?
   - **Decision**: Not included in initial scope (moved to Future Improvements)

## Future Improvements and Enhancements

**⚠️ Everything below is OUT OF SCOPE for initial implementation**

### Performance Optimizations
- Implement Railway watch paths to prevent cross-service rebuilds
- Add caching layer for frequently accessed routes
- Configure CDN for static assets
- Implement request batching for inter-service communication

### Advanced Networking
- Use Railway's private networking instead of public URLs
- Implement service mesh for advanced routing
- Add load balancing for high-traffic services
- Set up rate limiting per service

### Monitoring and Observability
- Integrate logging service (e.g., LogTail, Datadog)
- Add performance monitoring and alerting
- Implement distributed tracing across services
- Create Railway dashboard for metrics visualization

### Security Enhancements
- Add authentication middleware to dev-hub gateway
- Implement API key rotation for inter-service communication
- Set up WAF (Web Application Firewall) rules
- Add CORS configuration for cross-origin requests

### Development Experience
- Create Railway preview deployments for PR branches
- Add automated testing in Railway build pipeline
- Implement blue-green deployment strategy
- Create scripts for local Railway CLI setup

### Additional Services
- Add dedicated database service on Railway
- Set up Redis cache service
- Create dedicated cron job service for scheduled tasks
- Add message queue service (e.g., BullMQ, RabbitMQ)

### Configuration Management
- Centralize environment variables across services
- Implement Railway CLI configuration scripts
- Add environment variable validation
- Create configuration templates for new services

## References

- [Railway Monorepo Documentation](https://docs.railway.app/guides/monorepo)
- [Next.js Rewrites Documentation](https://nextjs.org/docs/api-reference/next.config.js/rewrites)
- [Railway Service Discovery](https://docs.railway.app/guides/private-networking)
- Previous Investigation: `docs/task-dossiers/railway-multi-app-architecture-review.md` (if exists)
- Existing Deployment Guide: `RAILWAY_DEPLOYMENT_MANUAL_STEPS.md`
