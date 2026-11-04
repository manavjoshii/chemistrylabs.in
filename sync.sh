#!/bin/sh
# chemistrylabs.in serves the site built in ~/chemistry-labs-site (since 2026-11-04).
# This rebuilds it, copies only what is published, and pushes. Run it after every change.
# identity/, tools/ and DESIGN.md stay private. team/ is the team hub (~/team-hub/public);
# this script never touches it.
set -e
SRC=~/chemistry-labs-site
cd "$(dirname "$0")"
git pull -q --rebase --autostash origin main
python3 "$SRC/tools/build.py" > /dev/null
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name sync.sh ! -name CNAME ! -name README.md ! -name team -exec rm -rf {} +
for d in index.html build-club practicals venture-catalyst calendar css fonts img; do cp -R "$SRC/$d" .; done
mkdir -p js && cp "$SRC/js/v3.js" js/
# The date tables stay on manavjoshi.com, one source of truth, so a date changed there shows here too.
find index.html build-club practicals venture-catalyst calendar -name index.html -exec \
  sed -i '' -E 's#src="/js/(smbc-cities|practicals|city-wheel)\.js#src="https://manavjoshi.com/js/\1.js#g' {} +
touch .nojekyll
git add -A
git commit -qm "${1:-Sync from chemistry-labs-site}" || echo "Nothing changed."
git push -q origin main
echo "Pushed. Live in about a minute."
