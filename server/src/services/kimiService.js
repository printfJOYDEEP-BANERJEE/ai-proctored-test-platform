// Kimi Service Adapter — [PENDING - PLACEHOLDER]
// Section 6: Assumes OpenAI-compatible /v1/chat/completions endpoint.
// ALL Kimi-specific logic is isolated here — only this file needs to change if API differs.
// Configured via: KIMI_API_BASE_URL and KIMI_API_KEY env vars (Section 7.2)
const fetch = require('node-fetch');

const KIMI_API_BASE_URL = process.env.KIMI_API_BASE_URL;
const KIMI_API_KEY = process.env.KIMI_API_KEY;

/**
 * Send a candidate message to Kimi and get a reply.
 * Used by AI Test chat interface (FR-6.1, FR-6.2) and Evaluation Worker (FR-9.3).
 *
 * ASSUMPTION: Kimi exposes an OpenAI-compatible POST /v1/chat/completions endpoint.
 * If the actual API differs, only this function needs to change (Section 6 placeholder note).
 *
 * @param {string} systemContext - Question brief / scoring rubric context
 * @param {string} userMessage - Candidate's message or evaluation prompt
 * @param {Array} [conversationHistory] - Prior messages for context
 * @returns {string} AI reply text
 */
const chat = async (systemContext, userMessage, conversationHistory = []) => {
  // [PENDING - PLACEHOLDER] If KIMI_API_BASE_URL is not configured, return a placeholder response
  if (!KIMI_API_BASE_URL) {
    console.warn('[Kimi] KIMI_API_BASE_URL not configured — using placeholder response');
    // ASSUMPTION: Return a placeholder so the rest of the system works without Kimi configured
    return '[AI Assistant is not yet configured. Please set KIMI_API_BASE_URL in .env]';
  }

  const messages = [
    ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${KIMI_API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(KIMI_API_KEY && { Authorization: `Bearer ${KIMI_API_KEY}` }),
    },
    body: JSON.stringify({
      model: 'kimi', // ASSUMPTION: model name; adjust if Kimi API uses different name
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  // ASSUMPTION: OpenAI-compatible response format: data.choices[0].message.content
  return data.choices?.[0]?.message?.content || '';
};

/**
 * Score a candidate's prompt log against a rubric.
 * Used by Evaluation Worker for AI Test scoring (FR-9.3).
 *
 * @param {Array} promptLog - Array of { role, message, timestamp }
 * @param {string} questionBrief - The AI Test project brief
 * @returns {Object} { promptQuality: number (0-10), reasoning: string }
 */
const scorePromptLog = async (promptLog, questionBrief) => {
  const rubric = `
You are an expert evaluator assessing a candidate's ability to use AI effectively.
Score the following conversation history on a scale of 0-10 for "Prompt Quality".
Criteria:
- Clarity: Are the prompts clear and well-specified? (0-3 points)
- Structure: Are prompts logically ordered and build upon prior context? (0-2 points)
- Optimization: Does the candidate iteratively improve based on AI responses? (0-3 points)
- Effectiveness: Did the prompts lead to useful, relevant outputs? (0-2 points)

Question Brief:
${questionBrief}

Conversation:
${promptLog.map((p) => `[${p.role.toUpperCase()}]: ${p.message}`).join('\n')}

Respond with JSON only: { "promptQuality": <number 0-10>, "reasoning": "<brief explanation>" }
`;

  try {
    const reply = await chat('', rubric);
    const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
    return {
      promptQuality: Math.min(10, Math.max(0, parsed.promptQuality || 0)),
      reasoning: parsed.reasoning || '',
    };
  } catch (err) {
    console.error('[Kimi] scorePromptLog parse error:', err);
    return { promptQuality: 0, reasoning: 'Scoring failed' };
  }
};

/**
 * Score code quality using LLM-based judging (FR-9.2).
 * Returns structured score breakdown for complexity/structure/etc.
 *
 * @param {string} code - Candidate's submitted code
 * @param {string} language - Programming language
 * @param {string} problemDescription - Question description for context
 * @returns {Object} Partial scoreBreakdown fields
 */
const scoreCodeQuality = async (code, language, problemDescription) => {
  const rubric = `
You are an expert code quality evaluator. Score the following ${language} code on each criterion (0-10 scale):
- timeComplexity: Analysis of algorithmic time complexity (optimal = 10)
- spaceComplexity: Analysis of memory usage efficiency (optimal = 10)
- codeStructure: Readability, naming, organization (clean = 10)
- problemSolvingApproach: Appropriateness of algorithm/data structure choice (0-10)
- exceptionHandling: Error handling coverage (comprehensive = 10)
- inputValidation: Input edge case handling (thorough = 10)
- codeOptimization: Unnecessary computation, dead code (optimized = 10)
- linesOfCode: Conciseness (appropriate lines for the problem = 10)

Problem:
${problemDescription}

Code (${language}):
\`\`\`
${code}
\`\`\`

Respond with JSON only: {
  "timeComplexity": 0-10,
  "spaceComplexity": 0-10,
  "codeStructure": 0-10,
  "problemSolvingApproach": 0-10,
  "exceptionHandling": 0-10,
  "inputValidation": 0-10,
  "codeOptimization": 0-10,
  "linesOfCode": 0-10,
  "reasoning": "brief explanation"
}
`;

  try {
    const reply = await chat('', rubric);
    const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
    // Ensure all values are in 0-10 range
    const clamp = (v) => Math.min(10, Math.max(0, Number(v) || 0));
    return {
      timeComplexity: clamp(parsed.timeComplexity),
      spaceComplexity: clamp(parsed.spaceComplexity),
      codeStructure: clamp(parsed.codeStructure),
      problemSolvingApproach: clamp(parsed.problemSolvingApproach),
      exceptionHandling: clamp(parsed.exceptionHandling),
      inputValidation: clamp(parsed.inputValidation),
      codeOptimization: clamp(parsed.codeOptimization),
      linesOfCode: clamp(parsed.linesOfCode),
    };
  } catch (err) {
    console.error('[Kimi] scoreCodeQuality parse error:', err);
    // Return default scores on failure
    return {
      timeComplexity: 5,
      spaceComplexity: 5,
      codeStructure: 5,
      problemSolvingApproach: 5,
      exceptionHandling: 5,
      inputValidation: 5,
      codeOptimization: 5,
      linesOfCode: 5,
    };
  }
};

module.exports = { chat, scorePromptLog, scoreCodeQuality };
