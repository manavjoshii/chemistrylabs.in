#!/bin/sh
# chemistrylabs.in serves the same build as manavjoshi.com/chemistrylab/.
# This copies the COMMITTED build from ~/manavjoshi.com (never uncommitted
# work), moves it from /chemistrylab/ to the site root, and pushes.
# Run it every time you push a new /chemistrylab/ build to manavjoshi.com.
set -e
SRC=~/manavjoshi.com
cd "$(dirname "$0")"
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name sync.sh ! -name CNAME ! -name README.md -exec rm -rf {} +
git -C "$SRC" archive HEAD chemistrylab | tar -x --strip-components=1
# Order matters: absolute links to the old home first, shared site tables
# second (they stay on manavjoshi.com, one source of truth), the base last.
grep -rlE '/chemistrylab/|src="/js/' index.html assets | while read -r f; do
  sed -i '' \
    -e 's#https://manavjoshi\.com/chemistrylab/#https://chemistrylabs.in/#g' \
    -e 's#src="/js/#src="https://manavjoshi.com/js/#g' \
    -e 's#/chemistrylab/#/#g' "$f"
done
touch .nojekyll
git add -A
git commit -qm "Sync from manavjoshi.com $(git -C "$SRC" rev-parse --short HEAD)" || echo "Nothing changed."
git push -q origin main 2>/dev/null || true
