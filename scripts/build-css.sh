#!/usr/bin/env bash
# Compile assets/tailwind.css from the classes used in the site's HTML.
#
# Uses the official standalone Tailwind binary — no npm, no node_modules.
# The binary is cached in .tmp/ (git-ignored) and downloaded on first run.
#
# Run this after adding or changing Tailwind classes, then commit the CSS.
set -euo pipefail

VERSION="v3.4.17"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/.tmp"
BIN="$BIN_DIR/tailwindcss-$VERSION"

case "$(uname -sm)" in
  "Darwin arm64") ASSET="tailwindcss-macos-arm64" ;;
  "Darwin x86_64") ASSET="tailwindcss-macos-x64" ;;
  "Linux x86_64") ASSET="tailwindcss-linux-x64" ;;
  *) echo "unsupported platform: $(uname -sm)" >&2; exit 1 ;;
esac

if [ ! -x "$BIN" ]; then
  mkdir -p "$BIN_DIR"
  echo "downloading tailwindcss $VERSION ($ASSET)"
  curl -sL --max-time 180 -o "$BIN" \
    "https://github.com/tailwindlabs/tailwindcss/releases/download/$VERSION/$ASSET"
  chmod +x "$BIN"
fi

INPUT="$BIN_DIR/tailwind-input.css"
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$INPUT"

cd "$ROOT"
"$BIN" \
  --config scripts/tailwind.config.js \
  --input "$INPUT" \
  --output assets/tailwind.css \
  --minify

echo "built assets/tailwind.css ($(wc -c < assets/tailwind.css) bytes)"
