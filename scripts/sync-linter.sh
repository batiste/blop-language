#!/bin/bash
# Sync Blop language files to VSCode linter extension

set -e  # Exit on error

SOURCE="src"
DEST="vscode/blop-linter/server/src"

echo "🔄 Syncing files to VSCode linter..."

# Remove old inference folder to ensure clean sync
rm -rf "$DEST/inference"

# List of files to sync (add new files here as needed)
FILES=(
  "parser.js"
  "grammar.js"
  "tokensDefinition.js"
  "backend.js"
  "builtin.js"
  "constants.js"
  "utils.js"
  "errorMessages.js"
  "selectBestFailure.js"
  "tokenStatistics.json"
)

# Copy individual files
for file in "${FILES[@]}"; do
  cp "$SOURCE/$file" "$DEST/"
done

# Copy directories
cp -r "$SOURCE/backend" "$DEST/"
cp -r "$SOURCE/inference" "$DEST/"

echo "📦 Installing dependencies..."
cd vscode/blop-linter
npm install

echo "🔨 Compiling extension..."
npm run compile

echo "✅ Sync complete!"
