# Main AI Apps - AI Assistant Context

## Project Files Note

**IMPORTANT: Sensitive Environment Variables**
- `.env` file contains production database credentials, Firebase keys, and API secrets
- NEVER commit `.env` to version control
- NEVER expose credentials in logs or error messages
- Reference `.env.example` for required variable structure

**Draft Files and Workspaces**
- `projects/` - Active analysis workspaces, DO NOT DELETE
- `generated_csvs/` - Python script outputs, managed by automation system
- `apps/push-blaster/.automations/` - Active automation configurations
- `apps/push-blaster/.script-outputs/` - Automation execution artifacts
- `.claude/` - Custom slash commands and agent configurations

## Project Overview

Monorepo containing a sophisticated **push notification automation platform** with supporting analytics and tooling services. The core system orchestrates scheduled, multi-step push campaigns with audience generation, cadence protection, and emergency safeguards. All services share a central PostgreSQL database and can deploy independently.

## The Push Notification Automation System

The platform's core innovation is **timeline-driven automation** with built-in safety mechanisms.

### Five-Phase Execution Timeline

1. **T-30 Minutes: Audience Generation** - Python scripts query database, generate CSV files
2. **T-25 Minutes: Test Sending** - Test audience receives full sequence for validation
3. **T-25 to T-0: Cancellation Window** - Emergency stop monitoring with countdown logging
4. **T-0: Live Execution** - Real audience filtered by cadence rules, sent via Firebase
5. **T+5 Minutes: Cleanup** - Test automations removed, execution state cleared

### Key Safety Mechanisms

**Cadence Protection (Fail-Open Design)**
- Layer 5 Cooldown: 96 hours between New User Series pushes
- Layer 3 Cooldown: 72 hours between high-value content notifications
- Combined L2/L3 Limit: Maximum count within time window
- Layer 1 Bypass: Critical notifications skip all rules
- Error handling: Service failures return full audience (never blocks)

**Emergency Controls**
- 25-minute cancellation window before live execution
- Emergency stop button aborts active executions
- AbortController pattern for clean process termination
- Atomic singleton prevents duplicate executions

### Example Automation

**Scenario**: Daily engagement push at 9:00 AM

```
08:30 - Cron triggers, executes Python script
08:30 - Script generates CSV: 50,000 user IDs
08:35 - Test push sent to 3 configured test users
08:35-09:00 - Cancellation window (emergency stop available)
09:00 - Cadence filters 50,000 → 42,000 eligible users
09:00 - Firebase sends push to 42,000 users
09:00 - Cadence service records 42,000 delivery events
09:05 - Execution complete, next scheduled for tomorrow
```

## Technical Stack

**Frontend**: Next.js 15.3.5-15.5.0, React 19.0.0-19.1.0, TypeScript 5.x, Tailwind CSS 4.x
**Backend**: Next.js API Routes, Node.js 20.19.5, PostgreSQL (Neon.tech)
**Push Delivery**: Firebase Admin SDK
**Scheduling**: node-cron
**Process Management**: PM2
**Data Processing**: Python 3.x, D3.js (analytics)
**Dev Tools**: Concurrently, dotenv-cli, ESLint 9.x
**Production**: Railway (auto-deploy), Neon PostgreSQL, PM2 monitoring

## Project Structure

```
main-ai-apps/
├── apps/                              # Deployable microservices
│   ├── push-blaster/                 # Main automation engine (Port 3001)
│   │   ├── src/lib/                  # Core business logic
│   │   │   ├── automationEngine.ts   # Cron scheduler & orchestrator
│   │   │   ├── automationStorage.ts  # JSON config persistence
│   │   │   ├── scriptExecutor.ts     # Python subprocess execution
│   │   │   ├── sequenceExecutor.ts   # Multi-push timing
│   │   │   └── automationIntegration.ts # Cadence/Firebase integration
│   │   ├── src/app/api/              # Next.js API routes
│   │   ├── .automations/             # Automation JSON configs
│   │   ├── .script-outputs/          # Python execution results
│   │   └── ecosystem.config.js       # PM2 configuration
│   ├── push-cadence-service/         # Cadence enforcement (Port 3002)
│   │   ├── src/lib/cadence.ts        # Filtering business logic
│   │   └── src/app/api/              # Filter & tracking endpoints
│   ├── analytics-dashboard/          # Data visualization (Port 3003)
│   │   ├── src/components/charts/    # D3.js visualizations
│   │   └── app/api/analytics/        # Analytics endpoints
│   ├── dev-hub/                      # Tool entry point (Port 3004)
│   └── email-hub/                    # Email campaigns (Flask)
├── basic_capabilities/               # Shared Python modules
│   └── internal_db_queries_toolbox/  # Database utilities
│       ├── sql_utils.py              # Direct SQL helpers
│       ├── graphql_utils.py          # Hasura queries
│       ├── posthog_utils.py          # Analytics queries
│       └── push_csv_queries.py       # Audience generation
├── developer-guides/                 # Technical documentation
├── .claude/                          # Custom commands & agents
├── .env                              # Shared environment variables
└── package.json                      # Root workspace config
```

## Database Schema

**PostgreSQL (Neon.tech) - Shared by all services**

### Core Tables

**user_notifications** - Delivery history for cadence tracking
- `id`, `user_id`, `layer_id` (1-5), `push_title`, `push_body`, `audience_description`, `deep_link`, `sent_at`
- Indexes: `(user_id)`, `(layer_id, sent_at)`, `(user_id, layer_id, sent_at)`

**cadence_rules** - Cooldown configurations
- `id`, `name` (unique), `value_in_hours`, `value_count`, `is_active`
- Examples: `layer_5_cooldown_hours`: 96, `layer_3_cooldown_hours`: 72, `combined_l2_l3_limit_hours`: 168 (count: 3)

**notification_layers** - Push type classifications
- 1: Critical, 2: Standard, 3: High Value, 4: Promotional, 5: New User Series

**automation_executions** - Execution history for monitoring and analysis
- `id` (UUID): Primary key
- `automation_id` (UUID): Foreign key to automation config
- `automation_name` (varchar 255): Automation name for easy querying
- `started_at` (timestamptz): Execution start time
- `completed_at` (timestamptz): Execution end time (null if running)
- `duration_ms` (integer): Total execution time in milliseconds
- `status` (varchar 50): Enum: 'running', 'completed', 'failed', 'aborted'
- `current_phase` (varchar 50): Last execution phase
- `audience_size` (integer): Number of users in audience
- `pushes_sent` (integer): Successfully sent push count
- `pushes_failed` (integer): Failed push count
- `error_message` (text): Error message if failed
- `error_stack` (text): Error stack trace for debugging
- `instance_id` (varchar 100): AutomationEngine instance ID
- `execution_mode` (varchar 50): Enum: 'test-live-send', 'live-send', 'real-dry-run'
- Indexes: `(automation_id)`, `(started_at DESC)`, `(status)`, `(automation_id, started_at DESC)`

**automation_last_executions** (view) - Most recent execution per automation
- Columns: automation_id, automation_name, started_at, completed_at, status, audience_size, pushes_sent, error_message
- Use for: Quick "last executed" queries without filtering all executions

**Query Examples**:
```sql
-- Get all executions for an automation
SELECT * FROM automation_executions
WHERE automation_id = 'UUID_HERE'
ORDER BY started_at DESC LIMIT 10;

-- Get last execution per automation
SELECT * FROM automation_last_executions;

-- Find failed executions in last 24 hours
SELECT * FROM automation_executions
WHERE status = 'failed'
AND started_at >= NOW() - INTERVAL '24 hours';

-- Calculate success rate per automation
SELECT
  automation_name,
  COUNT(*) FILTER (WHERE status = 'completed') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failure_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate_pct
FROM automation_executions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY automation_name;
```

**Environment Connection**:
- `DATABASE_URL` - Pooled connection for runtime
- `DIRECT_URL` - Direct connection for migrations
- Both require `sslmode=require`

## API Architecture

**Validation**: TypeScript type checking, runtime parameter validation
**Error Format**: `{ error: "message", details: "context" }`
**Status Codes**: 200 (OK), 201 (created), 400 (validation), 404 (not found), 409 (conflict), 500 (server error)
**Timeouts**: Cadence service 30s, Python scripts 5min (configurable)

### Error Handling Pattern

```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.userIds || !Array.isArray(body.userIds)) {
      return Response.json({ error: 'userIds array required' }, { status: 400 });
    }
    const result = await processRequest(body);
    return Response.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
```

## API Endpoints

### Push-Blaster APIs (Port 3001)

**Automation Management**
- **POST `/api/automation/sequences`** - Create automation
- **GET `/api/automation/sequences`** - List all automations
- **GET `/api/automation/sequences/[id]`** - Get automation details
- **PUT `/api/automation/sequences/[id]`** - Update automation
- **DELETE `/api/automation/sequences/[id]`** - Delete automation

**Execution Control**
- **POST `/api/automation/control`** - Emergency stop. Body: `{ automationId, action: "emergency_stop" }`
- **GET `/api/automation/debug`** - Engine status
- **GET `/api/automation/monitor`** - Active executions
- **POST `/api/automation/restore`** - Restore automations from .automations/ directory
  - Request: Empty POST
  - Response:
    ```json
    {
      "success": true,
      "data": {
        "expectedCount": number,
        "beforeRestore": {
          "scheduledJobsCount": number,
          "instanceId": "string"
        },
        "afterRestore": {
          "scheduledJobsCount": number,
          "instanceId": "string",
          "scheduledJobs": []
        },
        "validation": {
          "restorationSuccess": boolean,
          "divergence": number,
          "message": "string"
        }
      },
      "timestamp": "ISO string"
    }
    ```
  - Use when: Health check shows divergence > 0
  - See: [Automation Restoration Runbook](docs/runbooks/automation-restoration.md)

**Testing**
- **GET `/api/automation/test/[id]?mode={test-live-send|live-send|real-dry-run}`** - Execute automation
- **POST `/api/automation/test/[id]/kill`** - Terminate running test
- **POST `/api/send-push`** - Manual push delivery

**Health & Debug**
- **GET `/api/health`** - Service health check with automation metrics
  - Returns:
    ```json
    {
      "status": "healthy|degraded|critical",
      "service": "push-blaster",
      "timestamp": "ISO string",
      "uptime": number,
      "automationEngine": {
        "scheduledJobsCount": number,
        "expectedJobsCount": number,
        "divergence": number,
        "lastRestorationAttempt": "ISO string | null",
        "restorationSuccess": boolean,
        "activeExecutionsCount": number,
        "instanceId": "string"
      },
      "dependencies": {
        "database": "connected|degraded|not_configured",
        "cadence": "healthy|degraded|unreachable|not_configured"
      },
      "memoryUsage": {},
      "responseTimeMs": "string"
    }
    ```
  - Status Meanings:
    - `healthy`: All systems operational
    - `degraded`: Service running but dependency issues
    - `critical`: Automation scheduling broken (divergence > 0)
  - Always returns HTTP 200 for Railway compatibility

### Push-Cadence-Service APIs (Port 3002)

- **POST `/api/filter-audience`** - Filter users by cooldown rules. Layer 1 bypasses all rules, errors fail-open
- **POST `/api/track-notification`** - Record delivery to `user_notifications` table
- **POST `/api/restore-historical-data`** - Backfill historical deliveries from CSV
- **GET `/api/health`** - Service health check

### Analytics Dashboard APIs (Port 3003)

- **GET `/api/analytics/new-users`** - New user signups over time
- **GET `/api/analytics/cohort-analysis`** - User cohort analysis
- **GET `/api/analytics/offers/daily`** - Daily offer creation metrics
- **GET `/api/analytics/new-transactions`** - Transaction analytics

## Core Data Models

### UniversalAutomation Configuration

```typescript
interface UniversalAutomation {
  id: string;  // uuid-v4
  name: string;
  status: 'active' | 'scheduled' | 'paused' | 'completed';
  isActive: boolean;

  schedule: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    executionTime: string;  // HH:MM
    timezone: string;
    leadTimeMinutes: number;  // Default: 30
    startDate?: string;  // YYYY-MM-DD
  };

  audienceCriteria: {
    customScript?: {
      scriptId: string;
      parameters: Record<string, any>;
    };
    testMode: boolean;
  };

  pushSequence: PushMessage[];

  settings: {
    dryRunFirst: boolean;
    cancellationWindowMinutes: number;  // Default: 25
    testAudience: string[];
    isTest?: boolean;
    emergencyStopRequested?: boolean;
  };
}

interface PushMessage {
  title: string;
  body: string;
  layerId: 1 | 2 | 3 | 4 | 5;
  deepLink?: string;
  delayMinutes: number;
}
```

### Execution Constants

```typescript
const TIMELINE_CONSTANTS = {
  LEAD_TIME_MINUTES: 30,
  TEST_DELAY_MINUTES: 5,
  CANCELLATION_WINDOW_MINUTES: 25,
  CLEANUP_DELAY_MINUTES: 5,
  EMERGENCY_STOP_CHECK_INTERVAL: 30000
};

const PYTHON_EXECUTION = {
  DEFAULT_TIMEOUT: 300000,  // 5 minutes
  SCRIPT_DIRECTORY: 'apps/push-blaster/scripts',
  OUTPUT_DIRECTORY: 'apps/push-blaster/.script-outputs'
};
```

## Development

### Setup

```bash
# 1. Clone and install
git clone <repository-url> && cd main-ai-apps
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with: DATABASE_URL, DIRECT_URL, FIREBASE_SERVICE_ACCOUNT_KEY, CADENCE_SERVICE_URL, PYTHON_PATH

# 3. Install service dependencies
cd apps/push-blaster && npm install
cd ../push-cadence-service && npm install
cd ../analytics-dashboard && npm install

# 4. Install Python dependencies
pip3 install -r requirements.txt
```

### Running Services

**Development (Concurrent)**
```bash
cd apps/push-blaster && npm run dev
# Starts push-blaster (3001) and push-cadence-service (3002)
```

**Production-like (PM2)**
```bash
cd apps/push-blaster && npm run pm2:start
pm2 status && pm2 logs
```

**Port Assignments**: 3001 (Push-Blaster), 3002 (Push-Cadence), 3003 (Analytics), 3004 (Dev Hub), 5000 (Email Hub)

### Build Commands

```bash
# Single service
cd apps/push-blaster && npm run build && npm start

# Multiple services
cd apps/push-blaster && npm run build:prod && npm run start:prod
```

## Production (Railway)

**Deployment**: Auto-deploys from `main` branch

**Required Environment Variables**:
```
DATABASE_URL=postgresql://...?sslmode=require
DIRECT_URL=postgresql://...?sslmode=require
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
CADENCE_SERVICE_URL=https://push-cadence-production.up.railway.app
NODE_ENV=production
```

**Build Process**: Detects `package.json` → `npm ci` → `npm run build` → `npm start`

**Database Migrations**:
```bash
railway login && railway link
railway run npm run db:migrate
```

**Monitoring**:
```bash
railway logs --tail
railway status
```

### Railway Deployment Patterns & Gotchas

#### CRITICAL: Startup Validation - Degraded Mode Pattern

**Problem**: Calling `process.exit(1)` on missing env vars causes crash loops. Railway auto-restarts, creating infinite loop that exhausts resources and floods logs.

**Solution**: Warn but don't exit. All services use this pattern:

```typescript
// apps/*/src/lib/startupValidation.ts
export function validateStartupEnvironment(): void {
  if (validationComplete || process.env.NODE_ENV !== 'production') return;

  // Skip during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('[service] Validation skipped: Build phase');
    return;
  }

  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('='.repeat(80));
    console.error(`[service] CRITICAL WARNING: Missing: ${missing.join(', ')}`);
    console.error('Service will start in DEGRADED MODE');
    console.error('='.repeat(80));
    return;  // DON'T exit!
  }
  console.log('[service] Startup validation passed');
}
```

**Integration**: Import in `app/layout.tsx`: `import '@/lib/startupValidation';`

**Key Files**:
- `apps/push-blaster/src/lib/startupValidation.ts`
- `apps/push-cadence-service/src/lib/startupValidation.ts`
- `apps/analytics-dashboard/src/lib/startupValidation.ts`

#### Port Binding

Railway provides dynamic `$PORT`. Missing `--port $PORT` causes silent failures.

```json
// package.json
{
  "scripts": {
    "start:railway": "next start --port $PORT"
  }
}
```

**Safeguards**:
- Pre-commit hook: `scripts/pre-commit-railway-check.sh`
- GitHub Actions: `.github/workflows/railway-config-check.yml`
- Health monitoring: `scripts/monitor-railway-health.sh`

#### Common Failure Patterns

1. **Silent Downtime**: Service "Active" but unreachable → Missing `--port $PORT`
2. **Build Failures**: Validation runs during build → Add `NEXT_PHASE` check
3. **Crash Loops**: `process.exit(1)` on missing vars → Use degraded mode pattern
4. **Configuration Drift**: Works locally, fails on Railway → Sync env vars with Railway CLI

## AutomationEngine Deep Dive

### Atomic Singleton Pattern

Prevents duplicate instances causing duplicate executions. Production uses module-level singleton, development uses global caching for hot-reload resistance.

```typescript
const productionInstance: AutomationEngine | null =
  process.env.NODE_ENV === 'production' ? new AutomationEngine() : null;

export function getAutomationEngineInstance(): AutomationEngine {
  if (process.env.NODE_ENV === 'production') return productionInstance!;
  if (!global._automationEngineInstance) {
    global._automationEngineInstance = new AutomationEngine();
  }
  return global._automationEngineInstance;
}
```

**Location**: `automationEngine.ts:1009-1039`

### Process Cleanup Handlers

Gracefully shutdown cron jobs on `SIGTERM`, `SIGINT`, `exit`, and `uncaughtException`. Stops and destroys all cron jobs, clears maps.

**Location**: `automationEngine.ts:93-128`

### Execution Workflow

Five phases: Audience Generation (T-30) → Test Sending (T-25) → Cancellation Window (T-25 to T-0) → Live Execution (T-0) → Cleanup (T+5). Uses AbortController for emergency stop.

**Location**: `automationEngine.ts:278-328`

## Cadence Service Deep Dive

### Fail-Open Design

Critical principle: Push delivery must never be blocked by cadence service failures. On any error, returns full audience.

```typescript
export async function filterByCadence(userIds: string[], layerId: number) {
  try {
    if (!userIds || userIds.length === 0) return { eligibleUserIds: [], excludedCount: 0 };
    if (layerId === 1) return { eligibleUserIds: userIds, excludedCount: 0 };  // Bypass

    const rules = await loadCadenceRules();
    if (!rules || rules.length === 0) {
      console.error('[CADENCE] Rules not found. Failing open.');
      return { eligibleUserIds: userIds, excludedCount: 0 };
    }
    // Apply filtering logic...
  } catch (error) {
    console.error('[CADENCE] Filter error. Failing open:', error);
    return { eligibleUserIds: userIds, excludedCount: 0 };
  }
}
```

**Location**: `cadence.ts:52-54`

### Filtering Queries

Uses batch processing with `ANY($1::uuid[])` and composite indexes on `(user_id, layer_id, sent_at)`:

- Layer 5: `sent_at >= NOW() - INTERVAL '96 hours'`
- Layer 3: `sent_at >= NOW() - INTERVAL '72 hours'`
- Combined L2/L3: `sent_at >= NOW() - INTERVAL '168 hours' GROUP BY user_id HAVING COUNT(*) >= 3`

## Python Integration

### Script Execution Flow

1. Validate script exists in `apps/push-blaster/scripts/`
2. Create output directory in `.script-outputs/`
3. Spawn Python subprocess with env vars: `OUTPUT_DIRECTORY`, `EXECUTION_ID`, custom parameters
4. Capture stdout/stderr
5. Parse CSV files from output directory
6. Return execution result

**Location**: `scriptExecutor.ts`

### Shared Python Modules

**Location**: `basic_capabilities/internal_db_queries_toolbox/`

- `sql_utils.py` - PostgreSQL direct queries, connection pooling
- `graphql_utils.py` - Hasura GraphQL client
- `posthog_utils.py` - PostHog analytics
- `push_csv_queries.py` - Audience generation patterns

**Usage**:
```python
import sys
sys.path.append('../../../basic_capabilities')
from internal_db_queries_toolbox.push_csv_queries import get_active_users

# Generate audience and write to CSV
user_ids = get_active_users(conn, days=7)
output_file = os.path.join(os.getenv('OUTPUT_DIRECTORY'), 'audience.csv')
# Write CSV with 'user_id' column
```

## Code Patterns

**Singleton Access**:
```typescript
import { getAutomationEngineInstance } from '@/lib/automationEngine';
const engine = getAutomationEngineInstance();
```

**Database Query**:
```typescript
import pool from '@/lib/db';
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**Firebase Delivery**:
```typescript
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
const admin = getFirebaseAdmin();
await admin.messaging().send({ token, notification: { title, body }, data: { deepLink } });
```

## Common Tasks

**Create Automation**: POST `/api/automation/sequences` → Engine schedules cron → JSON saved to `.automations/`

**Add Python Script**: Create `apps/push-blaster/scripts/my_script.py` → Import from `basic_capabilities` → Write CSV to `OUTPUT_DIRECTORY` → Reference as `scriptId`

**Modify Cadence Rules**: `UPDATE cadence_rules SET value_in_hours = X WHERE name = 'rule_name'` → Changes apply immediately

**Debug Zombie Process**: `curl localhost:3001/api/automation/debug` → Verify `instanceId` and `scheduledJobsCount` → Clean restart if duplicates

**Deploy Service**: Add to Railway → Configure env vars → Push to `main` → Monitor `railway logs`

## Slash Commands

### Git Operations
- `/git:commit`, `/git:status`, `/git:push`, `/git:checkout <branch>`

### Code Quality
- `/code-review [target]`, `/validate-and-fix`

### Project Management
- `/spec:create <feature>`, `/spec:validate <path>`, `/spec:execute <path>`, `/preflight-discovery <task>`

### Development
- `/create-dev-guide <area>`, `/create-command [name]`, `/create-subagent`, `/create-e2e-test-plan <feature>`

### Utilities
- `/research <question>`, `/checkpoint:create`, `/checkpoint:list`, `/checkpoint:restore <number>`, `/dev:cleanup`

## Troubleshooting

### Automation Not Executing
**Symptom**: Cron scheduled but not running
**Solutions**: Verify `isActive: true`, execution time not in past, timezone matches server, reschedule via `/api/automation/debug/reschedule`

### Port Already in Use
**Symptom**: `EADDRINUSE :::3001`
**Solution**: `lsof -ti:3001,3002 | xargs kill -9 && pm2 restart all`

### Zombie AutomationEngine
**Symptom**: Duplicate executions/logs
**Solution**: `pm2 delete all && lsof -ti:3001,3002 | xargs kill -9 && rm -rf apps/push-blaster/.next && npm run pm2:start`

### Pushes Not Sending
**Checks**: Audience CSV exists, cadence filtering not blocking all, Firebase credentials valid, users have FCM tokens, `testMode: false`

### Database Pool Exhausted
**Symptom**: "too many clients already"
**Solution**: Verify `pool.query()` usage, use `try-finally` with `client.release()` for transactions

### Python Script Failures
**Checks**: `PYTHON_PATH` correct, dependencies installed, `OUTPUT_DIRECTORY` set, CSV has `user_id` column, write permissions granted

### PM2 Restart Loops
**Cause**: `autorestart: true` + Next.js hot reload
**Solution**: `ecosystem.config.js`: `autorestart: process.env.NODE_ENV === 'production'`, `watch: false`

## Key Files Reference

**Core Automation**:
- `apps/push-blaster/src/lib/automationEngine.ts`, `automationStorage.ts`, `scriptExecutor.ts`, `sequenceExecutor.ts`, `automationIntegration.ts`

**Cadence Service**:
- `apps/push-cadence-service/src/lib/cadence.ts`, `db.ts`

**API Routes**:
- `apps/push-blaster/src/app/api/automation/{sequences,control,debug,test}/route.ts`
- `apps/push-cadence-service/src/app/api/{filter-audience,track-notification}/route.ts`

**Configuration**:
- `apps/push-blaster/ecosystem.config.js`, `.env`, `package.json`

**Documentation**:
- `developer-guides/main-ai-apps-overview.md`, `push-notifications-detailed.md`, `railway-deployment-guide.md`

**Python Utilities**:
- `basic_capabilities/internal_db_queries_toolbox/{sql_utils,graphql_utils,posthog_utils,push_csv_queries}.py`

**Railway Safeguards**:
- `scripts/{pre-commit-railway-check,monitor-railway-health}.sh`
- `.github/workflows/railway-config-check.yml`
- `apps/*/src/lib/startupValidation.ts`

## Performance Considerations

**Database**: Composite indexes on `(user_id, layer_id, sent_at)`, batch with `ANY($1::uuid[])`, connection pooling (max 20), 30s timeout

**Scheduling**: Stagger automation times, use odd minutes, monitor `activeExecutionsCount`

**CSV Processing**: Keep under 100K users, stream large datasets, clean `.script-outputs/` periodically

**Firebase**: Batch sends, monitor quotas, exponential backoff on failures

**Memory**: PM2 `max_memory_restart` 1G (push-blaster) / 500M (cadence), clear execution maps, auto-cleanup test automations

## Security Considerations

**Environment**: Never commit `.env`, use Railway dashboard for secrets, rotate Firebase keys, audit DB access

**Database**: SSL required (`sslmode=require`), pooled for runtime, direct for migrations only, parameterized queries

**API**: No auth (internal only), input validation, rate limiting needed for production, same-origin CORS

**Process**: Dedicated ports, environment-specific configs, cleanup on termination, AbortController for cancellation

---

**Last Updated**: 2025-11-17
**Version**: 1.1
