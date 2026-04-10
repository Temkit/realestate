#!/bin/bash
# Register QStash schedule to warm cache daily at 4am Luxembourg time (2am UTC)
#
# Usage:
#   QSTASH_TOKEN=... APP_URL=https://your-app.vercel.app ./scripts/setup-qstash-cron.sh
#
# To list schedules: curl -s -H "Authorization: Bearer $QSTASH_TOKEN" https://qstash.upstash.io/v2/schedules | jq
# To delete:         curl -s -X DELETE -H "Authorization: Bearer $QSTASH_TOKEN" https://qstash.upstash.io/v2/schedules/<id>

set -e

if [ -z "$QSTASH_TOKEN" ]; then
  echo "Error: QSTASH_TOKEN not set"
  exit 1
fi

if [ -z "$APP_URL" ]; then
  echo "Error: APP_URL not set (e.g. https://your-app.vercel.app)"
  exit 1
fi

ENDPOINT="${APP_URL}/api/cron/warm-cache"

echo "Creating QStash schedule..."
echo "  Endpoint: $ENDPOINT"
echo "  Schedule: 0 2 * * * (daily at 4am Luxembourg / 2am UTC)"

RESPONSE=$(curl -s -X POST "https://qstash.upstash.io/v2/schedules/${ENDPOINT}" \
  -H "Authorization: Bearer ${QSTASH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Upstash-Cron: 0 2 * * *" \
  -H "Upstash-Retries: 3" \
  -H "Upstash-Timeout: 300")

echo "Response: $RESPONSE"
echo ""
echo "Done. QStash will call ${ENDPOINT} daily at 4am Luxembourg time."
echo "Verify: curl -s -H 'Authorization: Bearer $QSTASH_TOKEN' https://qstash.upstash.io/v2/schedules | jq"
