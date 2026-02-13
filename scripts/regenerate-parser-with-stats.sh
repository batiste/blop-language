#!/bin/bash
set -e

echo "🔍 Step 1: Analyzing blop code to gather token statistics..."
node src/analyzeTokenStatistics.js

echo ""
echo "⚙️  Step 2: Regenerating parser with enhanced error messages..."
node src/generateParser.js

echo ""
echo "✅ Parser regenerated with statistical error prioritization!"
echo ""
echo "The parser now uses real-world token frequencies to provide better error messages."
echo ""
echo "📦 To update the VSCode extension, run: npm run linter"

