const fs = require('fs');
const path = require('path');

let tokenStatistics = null;

// Lazy load statistics (only if they exist)
function loadStatistics() {
  if (tokenStatistics !== null) return tokenStatistics;
  
  // Look for tokenStatistics.json in the same directory
  const statsPath = path.join(__dirname, 'tokenStatistics.json');
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      tokenStatistics = stats.positionProbabilities || {};
    } catch (e) {
      tokenStatistics = {};
    }
  } else {
    tokenStatistics = {};
  }
  
  return tokenStatistics;
}

/**
 * Select the best failure from an array of failures using statistical analysis.
 * 
 * For each failure, we look at what tokens/rules commonly appear at that grammar position.
 * We prefer failures at positions where there's a clear expectation (high probability).
 * 
 * Example: In "def fct(a", at position func_call_params, we'd see ")" appears 88% 
 * and "," appears 12%, so we show the ")" error rather than something less likely.
 * 
 * @param {Array} failureArray - Array of failure objects from the parser
 * @param {Object} defaultFailure - The default failure to return if no better candidate is found
 * @returns {Object} The selected best failure
 */
function selectBestFailure(failureArray, defaultFailure) {
  if (!failureArray || failureArray.length === 0) {
    return defaultFailure;
  }
  
  if (failureArray.length === 1) {
    return failureArray[0];
  }
  
  const stats = loadStatistics();
  
  // No statistics available, return the default (first) failure
  if (!stats || Object.keys(stats).length === 0) {
    return defaultFailure || failureArray[0];
  }
  
  let bestFailure = null;
  let bestScore = -1;
  
  for (const failure of failureArray) {
    // Build the position key: rule_name:sub_rule_index:token_index
    const posKey = `${failure.rule_name}:${failure.sub_rule_index}:${failure.sub_rule_token_index}`;
    const posStats = stats[posKey];
    
    if (!posStats) {
      // No statistics for this position, skip it
      continue;
    }
    
    // Find the most common token at this position
    const entries = Object.entries(posStats);
    if (entries.length === 0) continue;
    
    // The highest probability indicates what's most expected at this position
    entries.sort((a, b) => b[1] - a[1]);
    const score = entries[0][1]; // Probability of the most common token
    
    if (score > bestScore) {
      bestScore = score;
      bestFailure = failure;
    }
  }
  
  // If we found a better candidate, return it; otherwise return default
  return bestFailure || defaultFailure || failureArray[0];
}

module.exports = {
  selectBestFailure,
  loadStatistics,
};
