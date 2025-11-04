#!/bin/bash

# Regenerate index.html with fresh law-of-day data
# Run daily at midnight UTC to update the inlined law-of-day data

set -e

cd /root/murphys-laws

# Load NVM and use Node v22
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# Generate index.html with inlined data
node scripts/generate-index-html.mjs > dist/index.html.tmp

# Atomic replacement to avoid serving partial files
mv dist/index.html.tmp dist/index.html

echo "$(date): Successfully regenerated index.html with law-of-day data"
