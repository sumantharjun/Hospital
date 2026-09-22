#!/usr/bin/env bash
#
# Build all seven panels as static sites for Hostinger and zip each one ready
# to upload through hPanel -> File Manager.
#
#   ./scripts/build-panels.sh https://hospital-api.onrender.com
#   ./scripts/build-panels.sh https://hospital-api.onrender.com Doctor_pannel
#
# NEXT_PUBLIC_API_BASE is inlined into the bundle at build time, so the API URL
# must be passed here — changing it later means rebuilding and re-uploading.

set -euo pipefail

API_BASE="${1:-}"
ONLY="${2:-}"

if [[ -z "$API_BASE" ]]; then
  echo "usage: $0 <api-base-url> [panel-directory]" >&2
  echo "example: $0 https://hospital-api.onrender.com" >&2
  exit 1
fi

if [[ "$API_BASE" == */ ]]; then
  echo "error: drop the trailing slash from the API URL ($API_BASE)" >&2
  exit 1
fi

if [[ "$API_BASE" != https://* && "$API_BASE" != http://localhost* ]]; then
  echo "warning: '$API_BASE' is not https — browsers block mixed content from an https panel" >&2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/dist-upload"

PANELS=(
  Admiin_panel
  Doctor_pannel
  Receptionist_pannel
  nurse
  patient-_pannel
  pharma_pannel
  dis_pannel
)

if [[ -n "$ONLY" ]]; then
  PANELS=("$ONLY")
fi

mkdir -p "$OUT_DIR"
export NEXT_PUBLIC_API_BASE="$API_BASE"
export NEXT_TELEMETRY_DISABLED=1

echo "API base: $API_BASE"
echo "output:   $OUT_DIR"
echo

for panel in "${PANELS[@]}"; do
  echo "=== $panel"
  cd "$ROOT/$panel"

  if [[ ! -d node_modules ]]; then
    echo "    installing dependencies..."
    npm ci --no-audit --no-fund >/dev/null
  fi

  rm -rf .next out
  npm run build >/dev/null
  echo "    built $(find out -name index.html | wc -l | tr -d ' ') pages"

  # .htaccess is a dotfile; -r alone would skip it in some zip builds, so add
  # the directory contents explicitly from inside out/.
  rm -f "$OUT_DIR/$panel.zip"
  (cd out && zip -qr "$OUT_DIR/$panel.zip" . -x '.DS_Store')

  # Capture the listing first: piping into `grep -q` under `set -o pipefail`
  # makes unzip die of SIGPIPE and reports a false failure.
  listing="$(unzip -l "$OUT_DIR/$panel.zip")"
  if ! grep -q '\.htaccess' <<<"$listing"; then
    echo "    ERROR: .htaccess missing from $panel.zip" >&2
    exit 1
  fi
  echo "    packaged $OUT_DIR/$panel.zip ($(du -h "$OUT_DIR/$panel.zip" | awk '{print $1}'))"
done

echo
echo "Done. Upload each zip to its subdomain's document root and extract there."
