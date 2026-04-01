#!/usr/bin/env bash
# Deploy the production build to the gh-pages branch.
# Usage:
#   ./scripts/deploy-github-pages.sh              # uses package.json "name" as /base/
#   ./scripts/deploy-github-pages.sh my-repo      # uses /my-repo/ as Vite base
#
# Prerequisites: git remote, npm install, and (for HTTPS push) credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_NAME="${1:-$(node -p "require('./package.json').name")}"
BASE_PATH="/${BASE_NAME}/"

echo "Building with Vite base: ${BASE_PATH}"
npm run build -- --base="${BASE_PATH}"

echo "Publishing dist/ to branch gh-pages..."
npx gh-pages -d dist -t

echo "Done. If this is a project site, open: https://<user>.github.io${BASE_PATH}"
