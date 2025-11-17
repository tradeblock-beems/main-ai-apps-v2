#!/bin/bash
# Prevent Railway start commands missing --port $PORT
# Install: ln -s ../../scripts/pre-commit-railway-check.sh .git/hooks/pre-commit

echo "🔍 Checking Railway configuration..."

# Find all start:railway scripts that are missing --port $PORT
ERRORS=0

for pkg in apps/*/package.json; do
  if [ -f "$pkg" ]; then
    # Check if file has start:railway script
    if grep -q '"start:railway"' "$pkg"; then
      # Check if it includes $PORT (either quoted or unquoted)
      if ! grep -E '"start:railway".*\$PORT' "$pkg" > /dev/null 2>&1; then
        echo "❌ ERROR: $pkg has start:railway without \$PORT"
        echo "   Railway requires services to bind to PORT environment variable"
        echo "   Fix: Change to \"start:railway\": \"next start --port \$PORT\""
        ERRORS=$((ERRORS + 1))
      fi
    fi
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "🚫 Pre-commit check failed: $ERRORS Railway configuration error(s) found"
  exit 1
fi

echo "✅ Railway configuration check passed"
exit 0
