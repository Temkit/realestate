#!/bin/bash
# Register the marketplace QStash cron: monthly GDPR lead purge (spec §3).
# (Appointment reminders are NOT a cron — they are one-shot QStash messages
# scheduled at booking-confirm time by src/lib/marketplace/leads.ts.)
#
# Usage:
#   QSTASH_TOKEN=... APP_URL=https://letz24.lu ./scripts/ops/2026-07-22-register-marketplace-crons.sh
#
# List schedules: curl -s -H "Authorization: Bearer $QSTASH_TOKEN" https://qstash.upstash.io/v2/schedules | jq
# Delete:         curl -s -X DELETE -H "Authorization: Bearer $QSTASH_TOKEN" https://qstash.upstash.io/v2/schedules/<id>

set -euo pipefail

if [ -z "${QSTASH_TOKEN:-}" ]; then
  echo "Error: QSTASH_TOKEN not set"
  exit 1
fi
if [ -z "${APP_URL:-}" ]; then
  echo "Error: APP_URL not set (e.g. https://letz24.lu)"
  exit 1
fi

ENDPOINT="${APP_URL}/api/cron/purge-leads"

echo "Creating QStash schedule..."
echo "  Endpoint: $ENDPOINT"
echo "  Schedule: 0 3 1 * * (monthly, 1st at 03:00 UTC)"

RESPONSE=$(curl -s -X POST "https://qstash.upstash.io/v2/schedules/${ENDPOINT}" \
  -H "Authorization: Bearer ${QSTASH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Upstash-Cron: 0 3 1 * *" \
  -d '{}')

echo "Response: $RESPONSE"
