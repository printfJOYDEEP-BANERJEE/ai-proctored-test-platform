// Judge0 Service — Module 3
// Handles code execution requests to the self-hosted Judge0 instance
// Judge0 API documentation: https://judge0.com/
const fetch = require('node-fetch');

// Language ID mapping for Judge0 (standard IDs from Judge0 documentation)
const LANGUAGE_IDS = {
  python: 71,       // Python 3
  java: 62,         // Java (OpenJDK 13.0.1)
  cpp: 54,          // C++ (GCC 9.2.0)
  c: 50,            // C (GCC 9.2.0)
  javascript: 63,   // JavaScript (Node.js 12.14.0)
  react: 63,        // React uses JavaScript/Node for evaluation
};

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

/**
 * Submit a single code execution to Judge0 and wait for result.
 * @param {string} code - Source code
 * @param {string} language - Language name (python, java, cpp, etc.)
 * @param {string} stdin - Standard input
 * @param {string} expectedOutput - Expected stdout for comparison
 * @returns {Object} Judge0 result object
 */
const executeCode = async (code, language, stdin = '', expectedOutput = '') => {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(JUDGE0_API_KEY && { 'X-Auth-Token': JUDGE0_API_KEY }),
  };

  // Submit to Judge0
  const submitResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language_id: languageId,
      source_code: code,
      stdin: stdin || '',
      expected_output: expectedOutput || undefined,
      cpu_time_limit: 5,        // 5 second CPU limit
      memory_limit: 256 * 1024, // 256 MB
    }),
  });

  if (!submitResponse.ok) {
    const err = await submitResponse.text();
    throw new Error(`Judge0 submission failed: ${submitResponse.status} ${err}`);
  }

  return submitResponse.json();
};

/**
 * Run code against an array of test cases.
 * @param {string} code
 * @param {string} language
 * @param {Array<{input: string, expectedOutput: string}>} testCases
 * @returns {Array} Array of Judge0 result objects
 */
const runAgainstTestCases = async (code, language, testCases) => {
  if (!testCases || testCases.length === 0) {
    return [];
  }

  // Run all test cases in parallel (with concurrency limit for Judge0 stability)
  const CONCURRENCY = 5;
  const results = [];
  for (let i = 0; i < testCases.length; i += CONCURRENCY) {
    const batch = testCases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((tc) => executeCode(code, language, tc.input || '', tc.expectedOutput || ''))
    );
    results.push(...batchResults);
  }
  return results;
};

module.exports = { executeCode, runAgainstTestCases, LANGUAGE_IDS };
