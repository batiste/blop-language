const fs = require('fs');
const path = require('path');
const glob = require('glob');
const parser = require('./parser');
const { tokensDefinition } = require('./tokensDefinition');

// Statistics storage
const ruleTokenStats = {}; // rule_name -> { token_type -> count }
const rulePositionStats = {}; // rule_name:sub_rule_index:token_index -> { token_type -> count }

function traverseAST(node, stream) {
  if (!node || typeof node !== 'object') return;

  // If this is a parse node with children
  if (node.name && node.sub_rule_index !== undefined && node.children) {
    const ruleName = node.name;
    const subRule = node.sub_rule_index;
    
    // Initialize stats for this rule if needed
    if (!ruleTokenStats[ruleName]) {
      ruleTokenStats[ruleName] = {};
    }
    
    // Traverse children and track what appears at each position
    for (let tokenIndex = 0; tokenIndex < node.children.length; tokenIndex++) {
      const child = node.children[tokenIndex];
      
      // Get the type of this child (either token type or rule name)
      let childType = null;
      if (child && child.type) {
        // This is a token
        childType = child.type;
      } else if (child && child.name) {
        // This is a rule
        childType = child.name;
      }
      
      if (childType) {
        // Track overall frequency for this rule
        if (!ruleTokenStats[ruleName][childType]) {
          ruleTokenStats[ruleName][childType] = 0;
        }
        ruleTokenStats[ruleName][childType]++;
        
        // Track frequency at specific sub_rule and token_index position
        // This matches how record_failure reports: rule_name, sub_rule_index, sub_rule_token_index
        const posKey = `${ruleName}:${subRule}:${tokenIndex}`;
        if (!rulePositionStats[posKey]) {
          rulePositionStats[posKey] = {};
        }
        if (!rulePositionStats[posKey][childType]) {
          rulePositionStats[posKey][childType] = 0;
        }
        rulePositionStats[posKey][childType]++;
      }
      
      // Recursively traverse child rule nodes (but not tokens)
      if (child && child.name && child.children) {
        traverseAST(child, stream);
      }
    }
  }
  
  // Traverse named properties
  if (node.named) {
    Object.values(node.named).forEach(child => {
      traverseAST(child, stream);
    });
  }
}

function analyzeBlopFile(filePath) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    const stream = parser.tokenize(tokensDefinition, source);
    const tree = parser.parse(stream);
    
    if (tree.success) {
      traverseAST(tree, stream);
      return { success: true, file: filePath };
    } else {
      return { success: false, file: filePath, error: 'Parse failed' };
    }
  } catch (error) {
    return { success: false, file: filePath, error: error.message };
  }
}

function analyzeAllBlopFiles(rootDir) {
  const blopFiles = glob.sync('**/*.blop', { 
    cwd: rootDir,
    ignore: ['node_modules/**', '**/node_modules/**']
  });
  
  console.log(`Found ${blopFiles.length} blop files to analyze`);
  
  const results = {
    total: blopFiles.length,
    successful: 0,
    failed: 0,
    failedFiles: []
  };
  
  blopFiles.forEach(file => {
    const fullPath = path.join(rootDir, file);
    const result = analyzeBlopFile(fullPath);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.failedFiles.push({ file, error: result.error });
    }
  });
  
  return results;
}

function generateStatisticsFile(outputPath) {
  // Calculate probabilities for specific positions
  // This tells us: at position "rule_name:sub_rule:token_index", what tokens appear and how often
  const positionProbabilities = {};
  
  for (const [posKey, tokenCounts] of Object.entries(rulePositionStats)) {
    const total = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
    positionProbabilities[posKey] = {};
    
    for (const [tokenType, count] of Object.entries(tokenCounts)) {
      positionProbabilities[posKey][tokenType] = count / total;
    }
  }
  
  const statistics = {
    positionProbabilities,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(statistics, null, 2));
  console.log(`Statistics written to ${outputPath}`);
  
  return statistics;
}

function printTopStatistics(limit = 10) {
  console.log('\n=== Top Token Frequencies by Rule ===\n');
  
  for (const [ruleName, tokenCounts] of Object.entries(ruleTokenStats)) {
    const total = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(tokenCounts)
      .map(([token, count]) => ({ token, count, percentage: (count / total * 100).toFixed(2) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    if (sorted.length > 0) {
      console.log(`${ruleName}:`);
      sorted.forEach(({ token, count, percentage }) => {
        console.log(`  ${token}: ${count} (${percentage}%)`);
      });
      console.log('');
    }
  }
}

// Main execution
if (require.main === module) {
  const rootDir = path.join(__dirname, '..');
  const outputPath = path.join(__dirname, 'tokenStatistics.json');
  
  console.log('Analyzing blop files...\n');
  const results = analyzeAllBlopFiles(rootDir);
  
  console.log(`\nAnalysis complete:`);
  console.log(`  Total files: ${results.total}`);
  console.log(`  Successfully parsed: ${results.successful}`);
  console.log(`  Failed: ${results.failed}`);
  
  if (results.failedFiles.length > 0) {
    console.log('\nFailed files:');
    results.failedFiles.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
  
  console.log('\nGenerating statistics...');
  const stats = generateStatisticsFile(outputPath);
  
  printTopStatistics(5);
  
  console.log(`\nTotal unique rules tracked: ${Object.keys(ruleTokenStats).length}`);
  console.log(`Total unique positions tracked: ${Object.keys(rulePositionStats).length}`);
  console.log(`\nRun 'npm run linter' to copy statistics to VSCode extension`);
}

module.exports = {
  analyzeBlopFile,
  analyzeAllBlopFiles,
  generateStatisticsFile,
  ruleTokenStats,
  rulePositionStats
};
