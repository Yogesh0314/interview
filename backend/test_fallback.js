import { GoogleGenAI } from '@google/genai';
import * as aiService from './services/aiService.js';
import assert from 'assert';

// We need to set dummy env vars for fallback to be enabled
process.env.GEMINI_API_KEY = 'dummy-gemini-key';
process.env.OPENROUTER_API_KEY = 'dummy-openrouter-key';
process.env.AI_FALLBACK_ENABLED = 'true';
process.env.OPENROUTER_MODEL = 'openrouter/free';

const originalFetch = globalThis.fetch;
let mockGeminiBehavior = null;
let mockOpenRouterBehavior = null;
let openRouterCallCount = 0;
let geminiCallCount = 0;

// Monkeypatch GoogleGenAI prototype to intercept model calls
Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (params) => {
        geminiCallCount++;
        if (mockGeminiBehavior) {
          return mockGeminiBehavior(params);
        }
        return { text: JSON.stringify({ aiResponse: 'Default Gemini Success Response' }) };
      }
    };
  },
  set(val) {
    // Allow assignment in constructor
  },
  configurable: true
});

// Monkeypatch global fetch to intercept OpenRouter calls
globalThis.fetch = async (url, options) => {
  if (url.includes('openrouter.ai')) {
    openRouterCallCount++;
    if (mockOpenRouterBehavior) {
      return mockOpenRouterBehavior(url, options);
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ aiResponse: 'Default OpenRouter Success Response' })
          }
        }]
      })
    };
  }
  if (originalFetch) {
    return originalFetch(url, options);
  }
  throw new Error(`Unexpected network call: ${url}`);
};

function resetMocks() {
  mockGeminiBehavior = null;
  mockOpenRouterBehavior = null;
  openRouterCallCount = 0;
  geminiCallCount = 0;
}

async function runTests() {
  console.log('=== Running AI Fallback Mechanism Test Suite ===\n');

  // Test Case 1: Gemini succeeds -> OpenRouter is NOT called
  {
    resetMocks();
    console.log('Test Case 1: Gemini succeeds');
    const result = await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
    assert.strictEqual(result.aiResponse, 'Default Gemini Success Response');
    assert.strictEqual(geminiCallCount, 1);
    assert.strictEqual(openRouterCallCount, 0);
    console.log('  -> PASS');
  }

  // Test Case 2: Gemini returns 429/resource exhausted -> OpenRouter is called
  {
    resetMocks();
    console.log('Test Case 2: Gemini 429 -> OpenRouter fallback');
    mockGeminiBehavior = () => {
      const err = new Error('Resource Exceeded');
      err.status = 429;
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({ aiResponse: 'OpenRouter Fallback Response on 429' })
            }
          }]
        })
      };
    };

    const result = await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
    assert.strictEqual(result.aiResponse, 'OpenRouter Fallback Response on 429');
    assert.strictEqual(geminiCallCount, 2); // 1 for 3.6-flash, 1 for 2.5-flash fallback
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  // Test Case 3: Gemini returns 503 -> fallback occurs
  {
    resetMocks();
    console.log('Test Case 3: Gemini 503 -> OpenRouter fallback');
    mockGeminiBehavior = () => {
      const err = new Error('Service Unavailable');
      err.status = 503;
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({ aiResponse: 'OpenRouter Fallback Response on 503' })
            }
          }]
        })
      };
    };

    const result = await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
    assert.strictEqual(result.aiResponse, 'OpenRouter Fallback Response on 503');
    assert.strictEqual(geminiCallCount, 1);
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  // Test Case 4: Gemini times out -> fallback occurs
  {
    resetMocks();
    console.log('Test Case 4: Gemini timeout -> OpenRouter fallback');
    mockGeminiBehavior = () => {
      const err = new Error('Connection timed out');
      err.code = 'ETIMEDOUT';
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({ aiResponse: 'OpenRouter Fallback Response on Timeout' })
            }
          }]
        })
      };
    };

    const result = await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
    assert.strictEqual(result.aiResponse, 'OpenRouter Fallback Response on Timeout');
    assert.strictEqual(geminiCallCount, 1);
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  // Test Case 5: Gemini returns an authentication error -> OpenRouter should NOT hide it
  {
    resetMocks();
    console.log('Test Case 5: Gemini API key invalid (401) -> No fallback');
    mockGeminiBehavior = () => {
      const err = new Error('API key invalid');
      err.status = 401;
      throw err;
    };

    await assert.rejects(
      async () => {
        await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
      },
      (err) => {
        return err.message.includes('API key invalid') || err.message.includes('401');
      }
    );
    assert.strictEqual(geminiCallCount, 1);
    assert.strictEqual(openRouterCallCount, 0); // OpenRouter should not be called
    console.log('  -> PASS');
  }

  // Test Case 6: OpenRouter succeeds -> normalized response is returned
  {
    resetMocks();
    console.log('Test Case 6: OpenRouter succeeds with incomplete schema -> normalization');
    mockGeminiBehavior = () => {
      const err = new Error('Resource Exceeded');
      err.status = 429;
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              // Missing some properties like followUpOnSameTopic, isInterviewComplete, etc.
              content: JSON.stringify({
                aiResponse: 'Normalized OpenRouter Response',
                nextPhase: 'projects'
              })
            }
          }]
        })
      };
    };

    // Use continueChat to test continueChat's validation and normalization
    const result = await aiService.continueChat(
      'Resume text',
      [],
      'Candidate answer',
      2,
      5,
      'Software Engineer',
      'Mid-Level',
      'Medium',
      'Technical',
      'warmup',
      {}
    );
    assert.strictEqual(result.aiResponse, 'Normalized OpenRouter Response');
    assert.strictEqual(result.nextPhase, 'projects');
    assert.strictEqual(result.followUpOnSameTopic, false); // Default filled
    assert.strictEqual(result.isInterviewComplete, false); // Default filled
    assert.strictEqual(result.difficultyLevel, 'Medium'); // Default filled
    assert.strictEqual(geminiCallCount, 2);
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  // Test Case 7: OpenRouter returns malformed JSON -> validation catches it
  {
    resetMocks();
    console.log('Test Case 7: OpenRouter returns malformed JSON -> throw clean error');
    mockGeminiBehavior = () => {
      const err = new Error('Resource Exceeded');
      err.status = 429;
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is not JSON!'
            }
          }]
        })
      };
    };

    await assert.rejects(
      async () => {
        await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
      },
      (err) => {
        return err.message.includes('Both Gemini and OpenRouter failed') || err.message.includes('Invalid JSON response');
      }
    );
    assert.strictEqual(geminiCallCount, 2);
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  // Test Case 8: Both Gemini and OpenRouter fail -> clean final AI error
  {
    resetMocks();
    console.log('Test Case 8: Both Gemini and OpenRouter fail');
    mockGeminiBehavior = () => {
      const err = new Error('Gemini rate limit');
      err.status = 429;
      throw err;
    };
    mockOpenRouterBehavior = () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal OpenRouter error'
      };
    };

    await assert.rejects(
      async () => {
        await aiService.startChat('Resume text', 5, 'Software Engineer', 'Mid-Level', 'Medium', 'Technical');
      },
      (err) => {
        return err.message.includes('Both Gemini and OpenRouter failed');
      }
    );
    assert.strictEqual(geminiCallCount, 2);
    assert.strictEqual(openRouterCallCount, 1);
    console.log('  -> PASS');
  }

  console.log('\n=== All 8 Fallback Test Cases Passed! ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
