#!/usr/bin/env bash
# Checks whether card payments are live on iamhumanfdn.org.
# Run after setting STRIPE_SECRET_KEY in Vercel and redeploying:
#   ./check-payments.sh
SITE="${1:-https://iamhumanfdn.org}"
echo "Checking $SITE"
echo

probe() {
  local label="$1" payload="$2"
  local body code
  body=$(curl -s -w $'\n%{http_code}' -X POST "$SITE/api/checkout" \
         -H 'Content-Type: application/json' -d "$payload" --max-time 25)
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')
  case "$code" in
    200)
      if printf '%s' "$body" | grep -q 'checkout.stripe.com'; then
        echo "  OK    $label  -> Stripe checkout created"
      else
        echo "  ??    $label  -> 200 but no Stripe URL: $body"
      fi ;;
    501) echo "  WAIT  $label  -> key not set yet (or not redeployed)" ;;
    502) echo "  FAIL  $label  -> Stripe rejected it. Check currency is enabled: $body" ;;
    *)   echo "  FAIL  $label  -> HTTP $code $body" ;;
  esac
}

probe "Donation, EUR 25    " '{"item":"donation","amount":25}'
probe "Founding Partner    " '{"item":"tier-founding"}'
probe "Friend of Second Ch." '{"item":"friend","amount":100}'

echo
echo "OK on all three means payments are live."
echo "WAIT means the key is not set, or the project has not been redeployed since."
