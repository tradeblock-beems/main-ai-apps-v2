#!/bin/bash
# Automation health monitoring for push-blaster service
# Requires: ALERT_WEBHOOK_URL environment variable
# Run via GitHub Actions: every 5 minutes

set -euo pipefail

# Configuration
PUSH_BLASTER_URL="${PUSH_BLASTER_HEALTH_URL:-https://push-blaster-production.up.railway.app/api/health}"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
LOG_FILE="${AUTOMATION_HEALTH_LOG:-$HOME/.automation-health.log}"
MAX_LOG_SIZE=10485760  # 10MB
RETRY_COUNT=3
RETRY_DELAY=5

# Validate required configuration
if [ -z "$ALERT_WEBHOOK" ]; then
  echo "ERROR: ALERT_WEBHOOK_URL environment variable is required"
  echo "Configure a Slack/Teams webhook for automation health alerts."
  exit 1
fi

# Log rotation
if [ -f "$LOG_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    # macOS
    LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo "0")
  else
    # Linux
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo "0")
  fi

  if [ "$LOG_SIZE" -gt "$MAX_LOG_SIZE" ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    echo "$(date '+%Y-%m-%d %H:%M:%S') Log rotated" > "$LOG_FILE"
  fi
fi

check_automation_health() {
  local attempt=0
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  while [ $attempt -lt $RETRY_COUNT ]; do
    # Fetch health endpoint
    response=$(curl -s --max-time 10 "$PUSH_BLASTER_URL" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
      attempt=$((attempt + 1))
      if [ $attempt -lt $RETRY_COUNT ]; then
        sleep $RETRY_DELAY
      fi
      continue
    fi

    # Parse JSON response using jq
    scheduled_count=$(echo "$response" | jq -r '.automationEngine.scheduledJobsCount // 0')
    expected_count=$(echo "$response" | jq -r '.automationEngine.expectedJobsCount // 0')
    divergence=$(echo "$response" | jq -r '.automationEngine.divergence // 0')
    instance_id=$(echo "$response" | jq -r '.automationEngine.instanceId // "unknown"')

    # Check for divergence
    if [ "$divergence" -ne 0 ]; then
      local alert_message="🚨 AUTOMATION HEALTH ALERT: ${divergence} automation(s) not scheduled!\n\nExpected: ${expected_count}\nScheduled: ${scheduled_count}\nInstance: ${instance_id}\n\nImmediate action required: Run manual restoration via POST /api/automation/restore"

      echo "[$timestamp] ALERT: Divergence detected - ${divergence} jobs missing" >> "$LOG_FILE"

      # Send alert
      curl -s -X POST "$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"$alert_message\"}" > /dev/null 2>&1 || \
        echo "[$timestamp] ERROR: Failed to send alert to webhook" >> "$LOG_FILE"

      return 1
    fi

    # Success
    echo "[$timestamp] OK: All ${scheduled_count} automations scheduled correctly" >> "$LOG_FILE"
    return 0
  done

  # Failed after all retries
  local alert_message="🚨 CRITICAL: Cannot reach push-blaster health endpoint after ${RETRY_COUNT} retries. Service may be down!"
  echo "[$timestamp] CRITICAL: Health endpoint unreachable" >> "$LOG_FILE"

  curl -s -X POST "$ALERT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$alert_message\"}" > /dev/null 2>&1 || \
    echo "[$timestamp] ERROR: Failed to send alert to webhook" >> "$LOG_FILE"

  return 1
}

# Main execution
echo "$(date '+%Y-%m-%d %H:%M:%S') Starting automation health check..." >> "$LOG_FILE"

if check_automation_health; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Health check completed: All automations healthy" >> "$LOG_FILE"
  exit 0
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') Health check completed with failures" >> "$LOG_FILE"
  exit 1
fi
