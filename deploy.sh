#!/usr/bin/env bash
# =============================================================================
#  Piano Melody Memory — One-click deploy to GitHub + GitHub Pages
#
#  Before running:
#    1. Fill in GH_TOKEN below with a fresh GitHub Personal Access Token
#       (needs 'repo' + 'workflow' scopes).
#    2. Confirm GH_USER matches your GitHub username.
#
#  Usage:  bash deploy.sh
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
# NOTE: This token will be auto-cleared from this file BEFORE the git commit
#       step below, so it never ends up in the repository's git history.
#       You should still revoke this PAT after deployment as a belt-and-braces
#       safety measure.
GH_TOKEN=""
GH_USER="ravitejagurram1234"
REPO="piano-melody-memory"
REMOTE_URL="https://${GH_TOKEN}@github.com/${GH_USER}/${REPO}.git"
PAGES_URL="https://${GH_USER}.github.io/${REPO}/"

if [ -z "${GH_TOKEN}" ]; then
  echo "❌  GH_TOKEN is empty. Edit deploy.sh and paste a GitHub PAT first."
  exit 1
fi

echo ""
echo "🎹  Piano Melody Memory — GitHub Deploy"
echo "────────────────────────────────────────"

# ── Step 1: Create GitHub repository ─────────────────────────────────────────
echo ""
echo "▶  Step 1/4: Creating GitHub repository..."

HTTP_STATUS=$(curl -s -o /tmp/gh_create_response.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/user/repos \
  -d "{
    \"name\": \"${REPO}\",
    \"description\": \"Piano Melody Memory — Angular 17 Simon-style memory game for piano learners\",
    \"homepage\": \"${PAGES_URL}\",
    \"private\": false,
    \"auto_init\": false
  }")

if [ "$HTTP_STATUS" = "201" ]; then
  echo "   ✅  Repository created: https://github.com/${GH_USER}/${REPO}"
elif [ "$HTTP_STATUS" = "422" ]; then
  echo "   ℹ️   Repository already exists — continuing with push..."
else
  echo "   ❌  Failed to create repository (HTTP $HTTP_STATUS)"
  cat /tmp/gh_create_response.json
  exit 1
fi

# ── Step 2: Initialise git ────────────────────────────────────────────────────
echo ""
echo "▶  Step 2/4: Initialising git..."

git init -b main
git config user.email "deploy@piano-melody-memory"
git config user.name  "Piano Melody Memory Deploy"

# ── Step 3: Commit all source files ──────────────────────────────────────────
echo ""
echo "▶  Step 3/4: Committing source files..."

# Safety: clear the hardcoded token from deploy.sh BEFORE committing, so the
# PAT never enters the repository's git history. The shell variables above
# are already captured in memory, so the remaining API / push calls still work.
echo "   🔒  Clearing token from deploy.sh before commit..."
sed -i.bak 's|^GH_TOKEN="[^"]*"$|GH_TOKEN=""|' deploy.sh
rm -f deploy.sh.bak

git add .
git commit -m "feat: initial Piano Melody Memory — Angular 17 app

- Simon-style melodic memory game for piano learners
- 3 difficulty levels: Beginner (C4–B4 white), Intermediate (C4–B5 white),
  Expert (C4–B5 chromatic)
- Signal-driven state machine: idle → listening → replaying → success/fail
- Wrong-key second-chance retry — one miss allowed per note position
- On-screen 2-octave keyboard with white + black key layout and key-glow
- Web Audio API piano synthesis (8 harmonics, ADSR envelope) with a
  promise-resolving playSequence helper
- Per-level stats (best length, total rounds, sequences completed) + an
  all-time best across every level, persisted to localStorage
- Animated success burst, shake on fail, staggered level-card fade-in
- GitHub Actions CI/CD — auto builds & deploys on every push to main"

# ── Step 4: Push to GitHub ────────────────────────────────────────────────────
echo ""
echo "▶  Step 4/4: Pushing to GitHub..."

git remote add origin "${REMOTE_URL}"
git push -u origin main

# ── Enable GitHub Pages (source: gh-pages branch) ────────────────────────────
echo ""
echo "▶  Enabling GitHub Pages..."

curl -s -o /dev/null -w "   Pages API: %{http_code}\n" \
  -X POST \
  -H "Authorization: token ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/${GH_USER}/${REPO}/pages" \
  -d '{"source":{"branch":"gh-pages","path":"/"}}'

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  ✅  All done!"
echo ""
echo "  📦  Repository : https://github.com/${GH_USER}/${REPO}"
echo "  ⚙️   Actions    : https://github.com/${GH_USER}/${REPO}/actions"
echo "  🌐  Live URL   : ${PAGES_URL}"
echo ""
echo "  GitHub Actions is now building your app."
echo "  The live URL will be ready in ~2 minutes."
echo "════════════════════════════════════════"
echo ""
echo "  ⚠️   Security tip: Revoke your PAT after deployment:"
echo "      github.com → Settings → Developer settings → Personal access tokens"
echo ""
