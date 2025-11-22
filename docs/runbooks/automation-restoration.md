# Automation Restoration Runbook

## Symptoms of Silent Automation Failure

- No push notifications delivered in 24+ hours
- Health endpoint shows `divergence > 0`
- Railway logs missing cron execution logs
- Database query shows no recent `user_notifications` records

## Diagnosis Steps

### Step 1: Check Health Endpoint

```bash
curl -s https://push-blaster-production.up.railway.app/api/health | jq '.automationEngine'
```

**Healthy Response:**
```json
{
  "scheduledJobsCount": 2,
  "expectedJobsCount": 2,
  "divergence": 0,
  "lastRestorationAttempt": "2025-11-22T...",
  "restorationSuccess": true,
  "activeExecutionsCount": 0,
  "instanceId": "engine-..."
}
```

**Unhealthy Response:**
```json
{
  "scheduledJobsCount": 0,  // ⚠️  ZERO JOBS!
  "expectedJobsCount": 2,
  "divergence": 2,  // ⚠️  DIVERGENCE!
  "restorationSuccess": false
}
```

### Step 2: Check Railway Startup Logs

```bash
railway logs --service push-blaster --tail 100 | grep STARTUP
```

Look for restoration banner:
```
[STARTUP] ✅ Restoration SUCCESS
[STARTUP] Scheduled Jobs: 2
```

Or failure indicator:
```
[STARTUP] ❌ Restoration FAILED
[STARTUP] Error: ...
```

### Step 3: Verify Automation Configs Exist

```bash
ls -la apps/push-blaster/.automations/*.json
```

Should show:
```
358676a1-8aa8-405d-9332-580b49e30421.json  # Layer 3 Pushes
d3343732-48d8-4ef8-a688-51caba1c7438.json  # New User Waterfall
```

## Restoration Procedures

### Procedure A: Manual Restoration (Recommended)

**When to use:** Health check shows divergence > 0

**Steps:**

1. **Trigger restoration:**
   ```bash
   curl -X POST https://push-blaster-production.up.railway.app/api/automation/restore | jq '.'
   ```

2. **Verify response:**
   ```json
   {
     "success": true,
     "data": {
       "validation": {
         "restorationSuccess": true,
         "divergence": 0,
         "message": "All active automations successfully scheduled"
       }
     }
   }
   ```

3. **Confirm via health check:**
   ```bash
   curl -s https://push-blaster-production.up.railway.app/api/health | jq '.automationEngine.divergence'
   # Should return: 0
   ```

4. **Monitor Railway logs:**
   ```bash
   railway logs --service push-blaster --tail 50
   # Look for: [RESTORE] ✅ SUCCESS: All 2 automations scheduled
   ```

### Procedure B: Service Restart (If Restoration Fails)

**When to use:** Manual restoration returns error or divergence remains > 0

**Steps:**

1. **Restart push-blaster service:**
   ```bash
   railway service restart --service push-blaster
   ```

2. **Wait 2 minutes for startup**

3. **Check startup logs:**
   ```bash
   railway logs --service push-blaster --tail 100 | grep STARTUP
   ```

4. **Verify health endpoint:**
   ```bash
   curl -s https://push-blaster-production.up.railway.app/api/health | jq '.automationEngine'
   ```

### Procedure C: Emergency Escalation

**When to use:** Both procedures A and B fail

**Escalation contacts:**
- Primary: [DevOps Team]
- Secondary: [Engineering Lead]

**Information to provide:**
- Health endpoint response (full JSON)
- Railway startup logs (last 100 lines)
- Restoration API response
- Time of incident discovery
- Recent deployments or changes

## Health Check Interpretation

### Status Meanings

- **status: "healthy"** - All systems operational
- **status: "degraded"** - Service running but dependency issues
- **status: "critical"** - Automation scheduling broken (divergence > 0)

### Common Divergence Causes

1. **Automation config validation failure**
   - Check logs for: "Invalid automation config"
   - Fix: Review .automations/*.json files for errors

2. **Cron expression calculation error**
   - Check logs for: "Failed to calculate cron expression"
   - Fix: Verify schedule.timezone and schedule.executionTime

3. **Missing environment variables**
   - Check logs for: "Missing required environment variables"
   - Fix: Add missing vars to Railway dashboard

4. **Database connectivity issues**
   - Check logs for: "Database connection failed"
   - Fix: Verify DATABASE_URL in Railway

## Verification After Restoration

### 1. Scheduled Job Count
```bash
curl -s https://push-blaster-production.up.railway.app/api/automation/debug | jq '.data.scheduledJobsCount'
# Should return: 2
```

### 2. Automation Details
```bash
curl -s https://push-blaster-production.up.railway.app/api/automation/debug | jq '.data.scheduledJobs[] | {automationId, isRunning}'
```

### 3. Next Execution Times
Check Railway logs around scheduled times:
- Layer 3 Pushes: 12:30 PM CST (T-30 before 1:00 PM execution)
- New User Waterfall: 2:00 PM CST (T-30 before 2:30 PM execution)

### 4. Database Execution Tracking
```bash
railway run --service push-cadence-service -- \
  psql $DATABASE_URL -c "SELECT * FROM automation_last_executions;"
```

## Alert Response Workflow

### Slack Alert: "X automation(s) not scheduled"

1. Acknowledge alert in Slack thread
2. Run diagnosis Step 1 (health check)
3. Execute Procedure A (manual restoration)
4. Reply in Slack thread with outcome
5. If failed, escalate via Procedure C

### Expected Response Time

- **During business hours:** 15 minutes
- **After hours:** 1 hour (non-critical)
- **Critical alerts:** Immediate (if pushes are time-sensitive)

## Prevention Checklist

- [ ] GitHub Actions workflow running every 5 minutes
- [ ] Slack webhook URL configured in GitHub Secrets
- [ ] Railway health checks enabled for both services
- [ ] Startup validation logging enabled
- [ ] Database execution tracking migration deployed
- [ ] Operator runbook reviewed by team

## Troubleshooting Reference

### No Logs in Railway
**Problem:** Railway logs command returns empty
**Solution:** Check Railway dashboard directly, may be UI issue

### Webhook Alerts Not Received
**Problem:** Divergence detected but no Slack alert
**Solution:** Verify SLACK_WEBHOOK_URL in GitHub Secrets, check Actions logs

### Database Query Fails
**Problem:** psql commands return permission denied
**Solution:** Verify DATABASE_URL includes correct credentials, check grants

## Related Documentation

- [AutomationEngine Architecture](../developer-guides/automation-engine.md)
- [Railway Deployment Guide](../railway-deployment-guide.md)
- [Health Endpoint Specification](../CLAUDE.md#health--debug)
