#!/usr/bin/env bash
# Test script for POST /api/analyze-product
# Usage: ./scripts/test-api.sh [test_name]
# test_name: a | b | c | invalid (default: a)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

case "${1:-a}" in
  a)
    echo "━━━ Test A — Developer API (PDF-to-JSON) ━━━"
    curl -s -X POST "$BASE_URL/api/analyze-product" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "PDFParse",
        "description": "An API that converts PDFs into structured JSON for developers. Handles tables, forms, and text extraction with high accuracy.",
        "url": "https://pdfparse.dev",
        "targetCustomer": "Software developers and engineering teams",
        "pricing": "$29/month",
        "currentUsers": 12,
        "budget": "$100/month",
        "marketingExperience": "Very limited"
      }' | python3 -m json.tool
    ;;
  b)
    echo "━━━ Test B — Wedding SaaS ━━━"
    curl -s -X POST "$BASE_URL/api/analyze-product" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "WedInvite AI",
        "description": "AI-powered wedding invitation generator. Upload your photos and details, get beautifully designed digital and printable wedding invitations in seconds.",
        "targetCustomer": "Engaged couples planning their wedding",
        "pricing": "$19 one-time per invitation set",
        "currentUsers": 45,
        "budget": "$200/month",
        "marketingExperience": "Some social media experience"
      }' | python3 -m json.tool
    ;;
  c)
    echo "━━━ Test C — Generic / Vague SaaS ━━━"
    curl -s -X POST "$BASE_URL/api/analyze-product" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "ProBoost",
        "description": "AI productivity platform"
      }' | python3 -m json.tool
    ;;
  invalid)
    echo "━━━ Test: Invalid request (missing required fields) ━━━"
    curl -s -X POST "$BASE_URL/api/analyze-product" \
      -H "Content-Type: application/json" \
      -d '{
        "url": "https://example.com"
      }' | python3 -m json.tool
    ;;
  *)
    echo "Usage: $0 [a|b|c|invalid]"
    exit 1
    ;;
esac
