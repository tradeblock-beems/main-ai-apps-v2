#!/bin/bash
# Robust health monitoring for Railway services
# Requires: ALERT_WEBHOOK_URL environment variable
# Run via cron: */5 * * * * /path/to/monitor-railway-health.sh

set -euo pipefail

# Configuration
PUSH_BLASTER_URL="${PUSH_BLASTER_HEALTH_URL:-https://push-blaster-production.up.railway.app/api/health}"
CADENCE_URL="${CADENCE_HEALTH_URL:-https://push-cadence-production.up.railway.app/api/health}"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
LOG_FILE="${RAILWAY_HEALTH_LOG:-$HOME/.railway-health.log}"
MAX_LOG_SIZE=10485760  # 10MB
RETRY_COUNT=3
RETRY_DELAY=5

# Validate required configuration
if [ -z "$ALERT_WEBHOOK" ]; then
  echo "ERROR: ALERT_WEBHOOK_URL environment variable is required"
  echo "Monitoring without alerting defeats the purpose. Configure a webhook."
  exit 1
fi

# Log rotation
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt $MAX_LOG_SIZE ]; then
  mv "$LOG_FILE" "${LOG_FILE}.old"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Log rotated" > "$LOG_FILE"
fi

check_service() {
  local name=$1
  local url=$2
  local attempt=0
  local response=""
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  while [ $attempt -lt $RETRY_COUNT ]; do
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
      echo "[$timestamp] OK: $name is healthy" >> "$LOG_FILE"
      return 0
    fi

    attempt=$((attempt + 1))
    if [ $attempt -lt $RETRY_COUNT ]; then
      sleep $RETRY_DELAY
    fi
  done

  # Service is down after all retries
  local alert_message="🚨 CRITICAL: $name is DOWN (HTTP $response) after $RETRY_COUNT retries. Requires immediate attention!"
  echo "[$timestamp] ALERT: $name is DOWN (HTTP $response) after $RETRY_COUNT retries" >> "$LOG_FILE"

  # Send alert
  curl -s -X POST "$ALERT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$alert_message\"}" > /dev/null 2>&1 || \
    echo "[$timestamp] ERROR: Failed to send alert to webhook" >> "$LOG_FILE"

  return 1
}

# Main execution
echo "$(date '+%Y-%m-%d %H:%M:%S') Starting health check..." >> "$LOG_FILE"

FAILURES=0

check_service "push-blaster" "$PUSH_BLASTER_URL" || FAILURES=$((FAILURES + 1))
check_service "push-cadence-service" "$CADENCE_URL" || FAILURES=$((FAILURES + 1))

if [ $FAILURES -gt 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Health check completed with $FAILURES failure(s)" >> "$LOG_FILE"
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Health check completed: All services healthy" >> "$LOG_FILE"
exit 0
