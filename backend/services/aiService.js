import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import { computeAtsScores } from './atsService.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const modelName = 'gemini-3.6-flash';

function getAIClient() {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // Force read directly from .env file to bypass shell environment caching
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      const keyLine = lines.find(line => line.trim().startsWith('GEMINI_API_KEY='));
      if (keyLine) {
        const val = keyLine.split('=')[1]?.trim();
        if (val) {
          apiKey = val.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (err) {
    console.warn('[AI] Failed to read key directly from .env:', err.message);
  }

  return new GoogleGenAI({ apiKey });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interview flow state machine (8-stage candidate-driven arc)
// ─────────────────────────────────────────────────────────────────────────────
export const PHASE_ORDER = [
  'warmup',
  'technical_skills',
  'internship_experience',
  'projects',
  'technical_deep_dive',
  'fundamentals_and_dsa',
  'behavioral',
  'closing',
];

// Map legacy phase names to standard 8 phases for backwards compatibility
const PHASE_ALIASES = {
  opening: 'warmup',
  skills: 'technical_skills',
  technical: 'technical_deep_dive',
  fundamentals: 'fundamentals_and_dsa',
};

// Validate a phase returned by the AI; fall back to normalized current phase.
export function normalizePhase(raw, current) {
  const normalizedRaw = PHASE_ALIASES[raw] || raw;
  if (PHASE_ORDER.includes(normalizedRaw)) return normalizedRaw;
  const normalizedCurrent = PHASE_ALIASES[current] || current;
  return PHASE_ORDER.includes(normalizedCurrent) ? normalizedCurrent : 'technical_skills';
}

// Build the flow context passed to the AI each turn so it can pace the
// gradual arc from the real conversation instead of from turn numbers.
export function buildFlowContext(messages, maxTurns) {
  const aiMessages = messages.filter(m => m.role === 'ai');

  const phaseProgress = {};
  for (const m of aiMessages) {
    const p = PHASE_ALIASES[m.phase] || m.phase;
    if (p) phaseProgress[p] = (phaseProgress[p] || 0) + 1;
  }

  let consecutiveFollowUps = 0;
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    if (aiMessages[i].followUpOnSameTopic) consecutiveFollowUps++;
    else break;
  }

  return {
    phaseProgress,
    phasesVisited: Object.keys(phaseProgress),
    consecutiveFollowUps,
    maxTurns,
    turnsElapsed: aiMessages.length,
    turnsRemaining: Math.max(0, (maxTurns || 7) - aiMessages.length),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task-Specific AI Generation Configurations & Safe Token Limits
// ─────────────────────────────────────────────────────────────────────────────
const TASK_CONFIGS = {
  live_interviewer: {
    responseMimeType: 'application/json',
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 1000,
  },
  ats_resume_parse: {
    responseMimeType: 'application/json',
    temperature: 0.0,
    topP: 1.0,
    maxOutputTokens: 8192,
  },
  ats_jd_parse: {
    responseMimeType: 'application/json',
    temperature: 0.0,
    topP: 1.0,
    maxOutputTokens: 8192,
  },
  evaluation: {
    responseMimeType: 'application/json',
    temperature: 0.3,
    topP: 0.9,
    maxOutputTokens: 8192,
  },
  ats_enrichment: {
    responseMimeType: 'application/json',
    temperature: 0.2,
    topP: 0.9,
    maxOutputTokens: 4096,
  },
};

function parseJsonOutput(text) {
  try {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[AI Diagnostic] Failed to parse JSON from AI response:', text);
    throw new Error('Invalid JSON response from AI');
  }
}

function isFallbackEligibleError(error) {
  if (!error) return false;

  const errString = String(error).toLowerCase();
  const status = error.status || error.statusCode;
  const code = error.code;

  // Authentication/configuration issues - do NOT fallback
  if (
    status === 401 ||
    errString.includes('api_key_invalid') ||
    errString.includes('invalid api key') ||
    errString.includes('key not valid') ||
    errString.includes('api key not valid')
  ) {
    return false;
  }

  // Quota / Rate limit (429 / RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    errString.includes('429') ||
    errString.includes('resource_exhausted') ||
    errString.includes('quota') ||
    errString.includes('rate limit') ||
    errString.includes('rate_limit')
  ) {
    return true;
  }

  // Transient service errors (502, 503, 504)
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    errString.includes('502') ||
    errString.includes('503') ||
    errString.includes('504') ||
    errString.includes('service unavailable') ||
    errString.includes('bad gateway') ||
    errString.includes('gateway timeout') ||
    errString.includes('unavailable')
  ) {
    return true;
  }

  // Network / timeout / connection failures
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    errString.includes('timeout') ||
    errString.includes('network') ||
    errString.includes('fetch failed') ||
    errString.includes('socket hang up') ||
    errString.includes('econnrefused') ||
    errString.includes('etimedout')
  ) {
    return true;
  }

  return false;
}

function validateAndNormalizeResponse(json, taskType) {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Parsed AI response is not an object');
  }

  if (taskType === 'live_interviewer') {
    if (!json.aiResponse) {
      json.aiResponse = json.text || json.message || json.response || JSON.stringify(json);
    }
    if ('nextPhase' in json || 'isInterviewComplete' in json) {
      json.nextPhase = json.nextPhase || 'technical_skills';
      json.followUpOnSameTopic = typeof json.followUpOnSameTopic === 'boolean' ? json.followUpOnSameTopic : false;
      json.isInterviewComplete = typeof json.isInterviewComplete === 'boolean' ? json.isInterviewComplete : false;
      json.difficultyLevel = json.difficultyLevel || 'Medium';
    }
  } else if (taskType === 'evaluation') {
    json.overallScore = Number(json.overallScore) || 5;
    json.communicationScore = Number(json.communicationScore) || json.overallScore;
    json.technicalScore = Number(json.technicalScore) || json.overallScore;
    json.problemSolvingScore = Number(json.problemSolvingScore) || json.overallScore;
    json.architectureScore = Number(json.architectureScore) || json.overallScore;
    json.behavioralScore = Number(json.behavioralScore) || json.overallScore;
    
    json.strengths = Array.isArray(json.strengths) ? json.strengths : [];
    while (json.strengths.length < 3) {
      json.strengths.push('Demonstrated basic competency in the required domain.');
    }
    json.growthAreas = Array.isArray(json.growthAreas) ? json.growthAreas : [];
    while (json.growthAreas.length < 3) {
      json.growthAreas.push('Continue to deepen practical and theoretical knowledge.');
    }
    json.comprehensiveFeedback = json.comprehensiveFeedback || 'Feedback not generated.';
    json.questionBreakdown = Array.isArray(json.questionBreakdown) ? json.questionBreakdown : [];
  } else if (taskType === 'ats_resume_parse') {
    json.name = json.name || '';
    json.headline = json.headline || '';
    json.summary = json.summary || '';
    json.skills = json.skills || {};
    const skillCategories = ['languages', 'frameworks', 'libraries', 'databases', 'cloud', 'devops', 'softSkills', 'certifications', 'others'];
    for (const cat of skillCategories) {
      json.skills[cat] = Array.isArray(json.skills[cat]) ? json.skills[cat] : [];
    }
    json.experience = Array.isArray(json.experience) ? json.experience : [];
    json.projects = Array.isArray(json.projects) ? json.projects : [];
    json.education = Array.isArray(json.education) ? json.education : [];
    json.certifications = Array.isArray(json.certifications) ? json.certifications : [];
    
    json.structureInfo = json.structureInfo || {};
    const structureKeys = ['hasExperienceSection', 'hasSkillsSection', 'hasEducationSection', 'hasProjectsSection', 'hasClearDates', 'hasClearJobTitles', 'hasReadableHierarchy'];
    for (const k of structureKeys) {
      json.structureInfo[k] = typeof json.structureInfo[k] === 'boolean' ? json.structureInfo[k] : false;
    }

    json.parseabilityInfo = json.parseabilityInfo || {};
    const parseabilityKeys = ['hasSelectableText', 'hasReadableStructure', 'hasTables', 'hasColumns', 'hasBrokenText', 'hasHeadersFootersInfo'];
    for (const k of parseabilityKeys) {
      json.parseabilityInfo[k] = typeof json.parseabilityInfo[k] === 'boolean' ? json.parseabilityInfo[k] : (k === 'hasSelectableText' || k === 'hasReadableStructure');
    }
  } else if (taskType === 'ats_jd_parse') {
    json.jobTitle = json.jobTitle || '';
    json.seniority = json.seniority || '';
    json.requirements = json.requirements || {};
    json.requirements.required = json.requirements.required || {};
    json.requirements.preferred = json.requirements.preferred || {};
    json.requirements.optional = json.requirements.optional || {};
    
    const reqCats = ['skills', 'education', 'certifications', 'responsibilities', 'domainKnowledge'];
    for (const cat of reqCats) {
      json.requirements.required[cat] = Array.isArray(json.requirements.required[cat]) ? json.requirements.required[cat] : [];
      json.requirements.preferred[cat] = Array.isArray(json.requirements.preferred[cat]) ? json.requirements.preferred[cat] : [];
    }
    json.requirements.optional.skills = Array.isArray(json.requirements.optional.skills) ? json.requirements.optional.skills : [];
    
    json.experienceYearsRequired = json.experienceYearsRequired !== undefined ? json.experienceYearsRequired : null;
    json.criticalRequirements = Array.isArray(json.criticalRequirements) ? json.criticalRequirements : [];
  } else if (taskType === 'ats_enrichment') {
    json.summary = json.summary || 'Summary not generated.';
    json.actionableAdvice = Array.isArray(json.actionableAdvice) ? json.actionableAdvice : [];
    while (json.actionableAdvice.length < 3) {
      json.actionableAdvice.push('Tailor resume achievements with relevant metrics.');
    }
  }

  return json;
}

async function callOpenRouter(prompt, taskType, config) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key is missing');
  }

  const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  console.log(`[AI OpenRouter] Fallback triggered. Dispatching task: '${taskType}' using model: '${model}'`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'http://localhost:5000',
    'X-Title': 'InterviewAI',
  };

  const body = {
    model: model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: config.temperature ?? 0.35,
    top_p: config.topP ?? 0.9,
    max_tokens: config.maxOutputTokens ?? 1000,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`OpenRouter API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const choice = data.choices?.[0];
    if (!choice || !choice.message?.content) {
      throw new Error('OpenRouter response content is empty');
    }

    const text = choice.message.content;
    const parsed = parseJsonOutput(text);
    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[AI OpenRouter Error] Task '${taskType}' failed:`, err.message);
    throw err;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateWithRetry = async (prompt, taskType = 'live_interviewer', retries = 5, delayMs = 3000) => {
  let modelToUse = modelName;
  const config = TASK_CONFIGS[taskType] || TASK_CONFIGS.live_interviewer;
  const fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== 'false';
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

  console.log(`[AI Diagnostic] Dispatching task: '${taskType}' using model: '${modelToUse}' (temp: ${config.temperature})`);

  // Max attempts for primary provider
  const maxAttempts = Math.min(3, retries);
  let lastError = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await getAIClient().models.generateContent({
        model: modelToUse,
        contents: prompt,
        config: config,
      });
      const parsed = parseJsonOutput(response.text);
      validateAndNormalizeResponse(parsed, taskType);
      
      console.log(`[AI] provider=gemini status=success model=${modelToUse} task=${taskType}`);
      return parsed;
    } catch (error) {
      lastError = error;
      const errString = String(error);
      const isRateLimit = error.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('RESOURCE_EXHAUSTED');
      const isTransient = isFallbackEligibleError(error);

      console.warn(`[AI Diagnostic] Task '${taskType}' attempt ${i + 1}/${maxAttempts} error (Model: ${modelToUse}):`, error.message || errString);

      // Model fallback logic to handle strict project quota/daily limits (from gemini-3.6-flash to gemini-2.5-flash)
      if (isRateLimit && modelToUse === 'gemini-3.6-flash') {
        console.warn(`[AI Fallback] Quota exhausted for ${modelToUse} during task '${taskType}'. Falling back to gemini-2.5-flash...`);
        modelToUse = 'gemini-2.5-flash';
        i--;
        await sleep(2000);
        continue;
      }

      // If it is not a transient/fallback-eligible error, fail fast and throw immediately
      if (!isTransient) {
        console.error(`[AI Error] Non-retryable error during task '${taskType}':`, error.message || errString);
        throw error;
      }

      // Check if we should fallback immediately to OpenRouter
      if (isTransient && fallbackEnabled && hasOpenRouterKey) {
        const status = error.status || error.statusCode;
        const isTransientServiceError = status === 502 || status === 503 || status === 504 || errString.includes('503') || errString.includes('service unavailable');
        
        // Fallback immediately on rate limit, timeout, transient service errors, or on the final attempt
        if (isRateLimit || isTransientServiceError || error.code === 'ETIMEDOUT' || errString.includes('timeout') || i === maxAttempts - 1) {
          console.warn(`[AI] provider=gemini status=quota_exceeded_or_failed fallback=openrouter error="${error.message || errString}"`);
          try {
            const orParsed = await callOpenRouter(prompt, taskType, config);
            validateAndNormalizeResponse(orParsed, taskType);
            console.log(`[AI] provider=openrouter model=${process.env.OPENROUTER_MODEL || 'openrouter/free'} status=success task=${taskType} fallback=true`);
            return orParsed;
          } catch (orError) {
            console.error(`[AI] OpenRouter fallback failed:`, orError.message);
            throw new Error(`AI Service Error: Both Gemini and OpenRouter failed. Gemini: ${error.message || errString}. OpenRouter: ${orError.message}`);
          }
        }
      }

      if (i < maxAttempts - 1) {
        const wait = isRateLimit ? 1000 : delayMs;
        console.warn(`[AI Retry] Waiting ${wait}ms before next attempt...`);
        await sleep(wait);
      }
    }
  }

  // Final fallback attempt if not triggered yet
  if (fallbackEnabled && hasOpenRouterKey && isFallbackEligibleError(lastError)) {
    console.warn(`[AI] Triggering final fallback to OpenRouter after all Gemini attempts failed.`);
    try {
      const orParsed = await callOpenRouter(prompt, taskType, config);
      validateAndNormalizeResponse(orParsed, taskType);
      console.log(`[AI] provider=openrouter model=${process.env.OPENROUTER_MODEL || 'openrouter/free'} status=success task=${taskType} fallback=true`);
      return orParsed;
    } catch (orError) {
      console.error(`[AI] OpenRouter fallback failed:`, orError.message);
      throw new Error(`AI Service Error: Both Gemini and OpenRouter failed. Gemini: ${lastError.message || String(lastError)}. OpenRouter: ${orError.message}`);
    }
  }

  // If rate limit skipped on enrichment
  if (lastError && lastError.status === 429 && taskType === 'ats_enrichment') {
    console.warn('[AI] ATS feedback enrichment skipped — using rule-based feedback.');
    return null;
  }

  console.error(`[AI Error] Task '${taskType}' failed:`, lastError.message || String(lastError));
  throw new Error(`AI API Error (${taskType}): ${lastError.message || String(lastError)}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONA 1 — REECHA: LIVE SENIOR TECHNICAL INTERVIEWER
// ─────────────────────────────────────────────────────────────────────────────
const REECHA_LIVE_PERSONA = `
You are Reecha, a warm, professional, highly observant Senior Technical Interviewer with 15+ years of live interviewing experience across Full-Stack, Backend, Frontend, DBMS, System Design, Cloud, APIs, Architecture, DSA, and STAR Behavioral interviews.

CORE PHILOSOPHY & METHODOLOGY:
1. EVIDENCE OVER ASSUMPTION:
   - Treat any technology, framework, tool, architecture, project responsibility, or work experience mentioned on the resume or in candidate answers as an UNVERIFIED CLAIM, NOT proof of knowledge.
   - Do NOT assume a candidate knows a technology simply because they named it.
2. INTELLIGENT SELECTIVE CLAIM VERIFICATION:
   - Selectively verify ONLY HIGH-VALUE CLAIMS (target job relevance, core project tech, claimed personal implementation, key architectural/design decisions, or spontaneous technical statements in their reply).
   - DO NOT waste turns probing trivial tools or generic statements (e.g. using Git/GitHub for basic version control).
3. PROGRESSIVE VERIFICATION & STOPPING RULE:
   - Use progressive probing: Claim → Basic Understanding → Practical Implementation → Reasoning/Trade-offs.
   - STOP probing a claim as soon as sufficient evidence is obtained. Do NOT force every claim through all levels or repeat probing on topics already verified.
4. CANDIDATE-DRIVEN PIVOTS:
   - If the candidate spontaneously introduces an important technical concept (e.g. database transactions for atomic multi-table updates), follow that technical thread to gather evidence before returning smoothly to the broader 8-stage arc.
5. NON-ADVERSARIAL PROFESSIONAL BEHAVIOR:
   - Never accuse, trap, or interrogate. If a candidate acknowledges they don't know a detail, treat that as useful information ("Doesn't know ≠ Lying") and move forward naturally.
6. ADAPTIVE DEPTH:
   - Strong evidence → deepen technical trade-offs / under-the-hood probing.
   - Weak/vague answer → ask a simpler clarification or concrete implementation question.
   - Repeated inability → gather evidence and advance smoothly to next topic.

STRICT RESPONSE LENGTH & SINGLE-QUESTION RULES:
1. ASK EXACTLY ONE QUESTION AT A TIME: Never ask 2 or 3 questions in a single turn.
2. NO COMPOUND QUESTIONS: A question MUST NOT contain multiple independent sub-questions or joined clauses (e.g. DO NOT ask "Why did you choose MongoDB, how did you structure the schema, and what indexing strategy did you use?"). Ask ONLY ONE focused question (e.g. "Why did you choose MongoDB for this project?").
3. MAXIMUM QUESTION LENGTH: Keep the actual question under 20–25 words.
4. BRIEF ACKNOWLEDGEMENT: Maximum ONE short sentence (under 12 words) acknowledging their reply (e.g. "Good point.", "Understood."). Do NOT restate the candidate's entire answer.
5. TOTAL OUTPUT LENGTH: The total 'aiResponse' string MUST stay below approximately 40-45 words total.
6. NO DETAILED FEEDBACK, EXPLANATIONS, OR MODEL ANSWERS: Never provide detailed feedback, model answers, or topic explanations during the live interview.
`.trim();

const REAL_INTERVIEW_FLOW = `
You lead an 8-stage candidate-driven interview arc:
1. warmup (Dynamic greeting & candidate resume-tailored background walkthrough)
2. technical_skills (Dynamic probing of technical skills, tools & frameworks from candidate's resume)
3. internship_experience (Dynamic probing of internships & work experience from candidate's resume)
4. projects (Dynamic resume project architecture & technical ownership)
5. technical_deep_dive (Under-the-hood drill into concepts candidate mentioned live)
6. fundamentals_and_dsa (Role fundamentals, DBMS, CN/OS & problem solving)
7. behavioral (STAR-format scenario evidence)
8. closing (Dynamic candidate Q&A & personalized warm wrap-up)

CRITICAL DYNAMIC PRINCIPLE:
- The 8 stages guide the PATH, but 100% of questions MUST be dynamically generated from the candidate's actual resume text and their previous answer.
- Never ask canned, static, or template questions.
`.trim();

function getPhaseGuidance(phase, turn, maxTurns, jobRole, type) {
  const normalized = PHASE_ALIASES[phase] || phase;

  const progressionGuidance = {
    warmup: `
PHASE: Stage 1 — warmup (Dynamic Opening & Background)
Simulate the opening minutes of a real video interview.
Greet the candidate warmly as Reecha in 1 brief sentence, set brief expectations for the ${jobRole} interview (${type}), and dynamically ask them to introduce their background referencing their resume summary.
`.trim(),

    technical_skills: `
PHASE: Stage 2 — technical_skills (Technical Skills & Tools on Resume)
Inspect the candidate's resume for listed technical skills, languages, frameworks, or databases. Select ONE high-value tool listed on their resume and ask ONE concise question about how they applied it in practice.
`.trim(),

    internship_experience: `
PHASE: Stage 3 — internship_experience (Internship & Work Experience from Resume)
Inspect the candidate's resume for work experience. Dynamically ask ONE concise question about their specific contributions or practical learnings during that role.
`.trim(),

    projects: `
PHASE: Stage 4 — projects (Resume Project Architecture & Ownership)
Select a key project mentioned in the candidate's resume. Dynamically ask ONE concise question about their technical ownership, architecture, or tech choice.
`.trim(),

    technical_deep_dive: `
PHASE: Stage 5 — technical_deep_dive (Deep Technical Probing & Under-the-Hood Mechanics)
Drill directly into a high-value technology or architecture pattern the candidate JUST mentioned. Ask ONE concise under-the-hood or trade-off question.
`.trim(),

    fundamentals_and_dsa: `
PHASE: Stage 6 — fundamentals_and_dsa (Role Fundamentals, DBMS & Problem Solving)
Test core role fundamentals: database design, CS fundamentals (DBMS, OS, Networking), or a single problem-solving question.
`.trim(),

    behavioral: `
PHASE: Stage 7 — behavioral (STAR Method Evidence)
Ask ONE concise STAR-style scenario question tailored to their role level.
`.trim(),

    closing: `
PHASE: Stage 8 — closing (Dynamic Candidate Q&A & Wrap-Up)
Invite candidate questions about the team or role. If they just asked a question, answer concisely and wrap up warmly.
`.trim(),
  };

  return progressionGuidance[normalized] || progressionGuidance.technical_deep_dive;
}

function buildAskedQuestionsBlock(previousMessages) {
  const asked = previousMessages
    .filter(m => m.role === 'ai')
    .map((m, i) => `${i + 1}. ${m.content}`);

  if (asked.length === 0) return '';

  return `
Questions already asked in THIS interview (you MUST NOT repeat, rephrase, or ask anything substantially similar):
${asked.map(q => `- ${q}`).join('\n')}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// startChat — Opening question (Turn 1, Warmup phase)
// ─────────────────────────────────────────────────────────────────────────────
export const startChat = async (resumeText, maxTurns, jobRole, experienceLevel, difficulty, type) => {
  const phaseGuidance = getPhaseGuidance('warmup', 1, maxTurns, jobRole, type);

  const prompt = `
${REECHA_LIVE_PERSONA}

${REAL_INTERVIEW_FLOW}

You are interviewing a candidate for "${experienceLevel} ${jobRole}".
Interview type: "${type}" | Difficulty: "${difficulty}".

${phaseGuidance}

STRICT OUTPUT CONSTRAINTS FOR OPENING:
- Welcome the candidate as Reecha in ONE brief sentence (max 12 words).
- Ask EXACTLY ONE short, focused opening question about their background (max 20 words).
- Total 'aiResponse' MUST be under 40 words total.
- Return ONLY valid JSON: { "aiResponse": "string" }

Candidate's Resume:
"""
${resumeText.slice(0, 3000)}
"""
  `.trim();

  return await generateWithRetry(prompt, 'live_interviewer');
};

// ─────────────────────────────────────────────────────────────────────────────
// continueChat — Lightweight Live Turn (1 Call, Zero Deep Evaluation)
// ─────────────────────────────────────────────────────────────────────────────
export const continueChat = async (
  resumeText,
  previousMessages,
  userReply,
  nextTurn,
  maxTurns,
  jobRole,
  experienceLevel,
  difficulty,
  type,
  currentPhase,
  flowContext,
  timeState = 'NORMAL',
  remainingSeconds = 300
) => {
  const relevantHistory = previousMessages
    .filter(m => m.role === 'ai' || m.role === 'user')
    .slice(-6);

  const historyStr = relevantHistory
    .map(m => `${m.role === 'ai' ? 'REECHA (Interviewer)' : 'CANDIDATE'}: ${m.content}`)
    .join('\n\n');

  const phaseGuidance = getPhaseGuidance(currentPhase, nextTurn, maxTurns, jobRole, type);
  const askedQuestionsBlock = buildAskedQuestionsBlock(previousMessages);

  const timeGuidance = timeState === 'TIME_LIMITED'
    ? `TIME CONSTRAINT: Only ~${remainingSeconds} seconds remaining! Keep your question brief, focused, and single-part.`
    : `TIME BUDGET: ~${remainingSeconds} seconds remaining. Maintain natural dynamic interviewing.`;

  const prompt = `
${REECHA_LIVE_PERSONA}

${REAL_INTERVIEW_FLOW}

You are interviewing a candidate for "${experienceLevel} ${jobRole}" (${type}, ${difficulty} difficulty).
Current turn: ${nextTurn}.
${timeGuidance}

${phaseGuidance}

STRICT CONCISE RESPONSE & SINGLE-QUESTION RULES:
1. ASK EXACTLY ONE FOCUSED QUESTION. Never combine multiple sub-questions or topics.
2. NO COMPOUND QUESTIONS: Reject multi-part queries like "Why X, how Y, and what Z?". Ask only ONE single point.
3. BRIEF ACKNOWLEDGEMENT: Maximum ONE short sentence (under 12 words) acknowledging their reply before asking the question.
4. WORD LIMIT: Total "aiResponse" MUST NOT exceed 45 words. Keep the actual question under 25 words.
5. NO FEEDBACK OR EXPLANATIONS: Do NOT teach, explain topics, restate their answer, or give feedback.

RULES FOR PHASE PROGRESSION & STATE:
- Probe high-value claims or concepts from resume or candidate's reply.
- Valid "nextPhase" values: ${JSON.stringify(PHASE_ORDER)}.
- "isInterviewComplete": true ONLY if in closing phase after wrap-up or if time limits require closing.
- "difficultyLevel": "${difficulty}".

${askedQuestionsBlock}

CANDIDATE'S LATEST ANSWER:
"${userReply}"

Resume Summary:
"""
${resumeText.slice(0, 2000)}
"""

Recent Conversation Context:
"""
${historyStr}
"""

Return ONLY a valid JSON object matching this schema:
{
  "aiResponse": "string",
  "nextPhase": "string",
  "followUpOnSameTopic": boolean,
  "isInterviewComplete": boolean,
  "difficultyLevel": "string"
}
  `.trim();

  return await generateWithRetry(prompt, 'live_interviewer');
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONA 2 — SENIOR INTERVIEW EVALUATOR: Deep Post-Interview Analysis
// ─────────────────────────────────────────────────────────────────────────────
const SENIOR_EVALUATOR_PERSONA = `
You are a Senior Technical Interview Evaluator with 15+ years of experience conducting and evaluating engineering interviews.

EVALUATION PHILOSOPHY:
1. EVIDENCE VS ASSUMPTION:
   - Assess what the candidate ACTUALLY DEMONSTRATED with verified evidence vs what they merely claimed on their resume or in vague statements.
2. OBJECTIVE EVIDENCE REPORTING:
   - Describe evidence objectively. Do NOT assume dishonesty when knowledge is unverified or partial.
3. IMPROVED ANSWER INTEGRITY:
   - "improvedAnswer" MUST preserve the candidate's ACTUAL experience, tools, projects, and facts mentioned.
   - NEVER invent false technologies, projects, responsibilities, work history, or false achievements. Rewrite their real response to improve clarity, technical depth, vocabulary, and structure as if the same candidate said it better.
`.trim();

export const generateGrowthAnalysis = async (messages, interviewDetails = {}) => {
  const cleanMessages = messages
    .filter(m => m.role === 'ai' || m.role === 'user')
    .map(m => ({ role: m.role === 'ai' ? 'interviewer' : 'candidate', content: m.content }));

  const jobRole = interviewDetails.jobRole || 'Software Engineer';
  const experienceLevel = interviewDetails.experienceLevel || 'Mid-Level';
  const type = interviewDetails.type || 'Technical';
  const difficulty = interviewDetails.difficulty || 'Medium';
  const resumeText = interviewDetails.resumeText ? interviewDetails.resumeText.slice(0, 3000) : '';
  const jobDescription = interviewDetails.jobDescription ? interviewDetails.jobDescription.slice(0, 1500) : '';

  const prompt = `
${SENIOR_EVALUATOR_PERSONA}

Review the following complete interview transcript and provide a concise, evidence-based performance evaluation.

CANDIDATE & ROLE CONTEXT:
- Role: ${experienceLevel} ${jobRole} (${type} Interview, ${difficulty} Difficulty)
${jobDescription ? `- Target Job Description: ${jobDescription}\n` : ''}${resumeText ? `- Candidate Resume Summary: ${resumeText}\n` : ''}

INTERVIEW TRANSCRIPT:
${JSON.stringify(cleanMessages, null, 2)}

STRICT COMPACT EVALUATION INSTRUCTIONS:
1. Provide an overall score out of 10 ("overallScore").
2. Provide score 1-10 for each of the 5 skill competency dimensions:
   - "communicationScore": clarity, structured answers, articulation
   - "technicalScore": depth of technology, under-the-hood mechanics
   - "problemSolvingScore": analytical reasoning, handling trade-offs & edge cases
   - "architectureScore": project ownership, data flow, system design
   - "behavioralScore": STAR evidence, collaboration, professionalism
3. "strengths": EXACTLY 3 concise bullet points.
4. "growthAreas": EXACTLY 3 concise bullet points.
5. "comprehensiveFeedback": MAXIMUM ~100 words total summarizing overall performance.
6. "questionBreakdown": Select up to a MAXIMUM of 5 most critical/pivotal questions from the interview (do NOT list every single question if there are more than 5):
   - "question": exact interviewer question
   - "userAnswer": candidate answer (truncate to under 60 words if long)
   - "accuracyScore": score 1–10
   - "detailedFeedback": maximum ~50 words
   - "idealAnswer": maximum ~75 words
   - "improvedAnswer": maximum ~75 words — TRUTHFUL REWRITE ONLY. Rewrite candidate's ACTUAL answer to improve structure, vocabulary, and clarity. DO NOT invent false technologies, projects, or achievements not mentioned by the candidate.

Return ONLY a valid JSON object matching this exact schema:
{
  "overallScore": number,
  "communicationScore": number,
  "technicalScore": number,
  "problemSolvingScore": number,
  "architectureScore": number,
  "behavioralScore": number,
  "strengths": [ "string", "string", "string" ],
  "growthAreas": [ "string", "string", "string" ],
  "comprehensiveFeedback": "string",
  "questionBreakdown": [
    {
      "question": "string",
      "userAnswer": "string",
      "accuracyScore": number,
      "detailedFeedback": "string",
      "idealAnswer": "string",
      "improvedAnswer": "string"
    }
  ]
}
  `.trim();

  return await generateWithRetry(prompt, 'evaluation');
};

// ─────────────────────────────────────────────────────────────────────────────
// generateATSAnalysis — LLM structured parsing + deterministic matching & scoring
// ─────────────────────────────────────────────────────────────────────────────

export async function parseResumeWithLLM(resumeText) {
  const prompt = `
You are an expert ATS Resume Parsing Engine.
Analyze the following resume text and parse it into a structured JSON representation matching the schema below.

STRICT DETERMINISTIC EXTRACTION RULES:
1. Extract ONLY information explicitly present in the resume text.
2. NEVER infer a technology from context or job role.
3. NEVER infer years of experience unless explicitly supported by dates in the text.
4. NEVER add synonymous technologies unless they are explicitly present in the text.
5. Preserve the candidate's actual wording and capitalization where practical.
6. Return empty arrays when information is absent. Do NOT summarize skills into broader categories.
7. Do NOT hallucinate missing skills or experiences.

Resume Text:
"""
${resumeText}
"""

Return ONLY a valid JSON object matching this schema:
{
  "name": "string",
  "headline": "string",
  "summary": "string",
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "libraries": ["string"],
    "databases": ["string"],
    "cloud": ["string"],
    "devops": ["string"],
    "softSkills": ["string"],
    "certifications": ["string"],
    "others": ["string"]
  },
  "experience": [
    {
      "jobTitle": "string",
      "employer": "string",
      "startDate": "string",
      "endDate": "string",
      "responsibilities": ["string"],
      "achievements": ["string"],
      "estimatedYears": number
    }
  ],
  "projects": [
    {
      "title": "string",
      "description": "string",
      "technologies": ["string"],
      "outcomes": ["string"],
      "measurableImpact": boolean
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "fieldOfStudy": "string",
      "graduationYear": "string"
    }
  ],
  "certifications": ["string"],
  "structureInfo": {
    "hasExperienceSection": boolean,
    "hasSkillsSection": boolean,
    "hasEducationSection": boolean,
    "hasProjectsSection": boolean,
    "hasClearDates": boolean,
    "hasClearJobTitles": boolean,
    "hasReadableHierarchy": boolean
  },
  "parseabilityInfo": {
    "hasSelectableText": boolean,
    "hasReadableStructure": boolean,
    "hasTables": boolean,
    "hasColumns": boolean,
    "hasBrokenText": boolean,
    "hasHeadersFootersInfo": boolean
  }
}
  `.trim();

  try {
    return await generateWithRetry(prompt, 'ats_resume_parse');
  } catch (err) {
    console.warn('[AI] parseResumeWithLLM failed, returning fallback empty structure:', err.message);
    return {
      name: '', headline: '', summary: '',
      skills: {}, experience: [], projects: [], education: [], certifications: [],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: false, hasEducationSection: false, hasProjectsSection: false, hasClearDates: false, hasClearJobTitles: false, hasReadableHierarchy: false },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasTables: false, hasColumns: false, hasBrokenText: false, hasHeadersFootersInfo: false }
    };
  }
}

export async function parseJobDescriptionWithLLM(jdText, jobRole) {
  const textToParse = jdText?.trim() ? jdText : `Standard job description for ${jobRole}`;
  const prompt = `
You are an expert recruitment parser.
Analyze the following Job Description (and Job Role "${jobRole}") and parse it into a structured JSON representation matching the schema below.

STRICT DETERMINISTIC EXTRACTION RULES:
1. Extract explicit requirements stated in the text. Do NOT invent requirements.
2. Keep required/preferred/optional classifications based ONLY on the text wording.
3. Preserve explicit minimum years of experience stated in the text.
4. Do NOT randomly add skills based on the job role title alone.

Job Description Text:
"""
${textToParse}
"""

Return ONLY a valid JSON object matching this schema:
{
  "jobTitle": "string",
  "seniority": "string",
  "requirements": {
    "required": {
      "skills": ["string"],
      "education": ["string"],
      "certifications": ["string"],
      "responsibilities": ["string"],
      "domainKnowledge": ["string"]
    },
    "preferred": {
      "skills": ["string"],
      "education": ["string"],
      "certifications": ["string"],
      "responsibilities": ["string"],
      "domainKnowledge": ["string"]
    },
    "optional": {
      "skills": ["string"]
    }
  },
  "experienceYearsRequired": number,
  "criticalRequirements": ["string"]
}
  `.trim();

  try {
    return await generateWithRetry(prompt, 'ats_jd_parse');
  } catch (err) {
    console.warn('[AI] parseJobDescriptionWithLLM failed, returning standard fallback structure:', err.message);
    return {
      jobTitle: jobRole,
      seniority: 'Mid-Level',
      requirements: {
        required: { skills: [jobRole], education: [], certifications: [], responsibilities: [], domainKnowledge: [] },
        preferred: { skills: [], education: [], certifications: [], responsibilities: [], domainKnowledge: [] },
        optional: { skills: [] }
      },
      experienceYearsRequired: 3,
      criticalRequirements: []
    };
  }
}

async function enrichAtsFeedback(resumeText, jobRole, jobDescription, difficulty, experienceLevel, computed) {
  const isResumeOnly = computed.mode === 'resume_only';
  
  let metricsBlock = '';
  if (isResumeOnly) {
    metricsBlock = `
- Overall ATS Readiness Score: ${computed.score}/100
- Parseability Quality: ${computed.breakdown.parseability}/100
- Structure Completeness: ${computed.breakdown.structure}/100
- Skills Presentation: ${computed.breakdown.skills}/100
- Experience Quality: ${computed.breakdown.experience}/100
    `;
  } else {
    metricsBlock = `
- Overall Match Score: ${computed.atsScore}/100
- Keyword Match Score: ${computed.keywordScore}/100
- Found Keywords: ${computed.matchedKeywords.join(', ')}
- Missing Keywords: ${computed.missingKeywords.join(', ')}
    `;
  }

  const prompt = `
You are an expert ATS (Applicant Tracking System) Specialist and Senior Technical Recruiter.
A candidate has submitted their resume for evaluation.
${isResumeOnly ? 'The evaluation is a general ATS Readiness analysis (no specific Job Description was provided).' : 'The candidate is applying for the position of "' + experienceLevel + ' ' + jobRole + '".'}

Resume Text:
"""
${resumeText.slice(0, 3000)}
"""

${!isResumeOnly ? `Target Job Description:
"""
${jobDescription ? jobDescription.slice(0, 1500) : 'Standard ' + experienceLevel + ' ' + jobRole + ' requirements'}
"""` : ''}

Our deterministic parser calculated these initial metrics:
${metricsBlock}

Your task:
Enrich this analysis with brief, highly actionable professional insights:
1. "summary": A 2-sentence executive summary of how well this resume ${isResumeOnly ? 'is structured, readable, and ready for automated screening' : 'matches the target role'}.
2. "actionableAdvice": 3 specific, concrete suggestions to improve this resume ${isResumeOnly ? 'for ATS compatibility and readability' : 'for the target role'}.

Return ONLY a valid JSON object:
{
  "summary": "string",
  "actionableAdvice": [ "string", "string", "string" ]
}
  `.trim();

  try {
    return await generateWithRetry(prompt, 'ats_enrichment');
  } catch (err) {
    console.warn('[AI] ATS enrichment failed, returning null:', err.message);
    return null;
  }
}

function buildResumeOnlyRuleFeedback({ score, breakdown, resumeData }) {
  const strengths = [];
  const weaknesses = [];
  const formattingTips = [];

  if (breakdown.parseability >= 80) {
    strengths.push('Excellent document parseability — text is clean, structured, and easily readable.');
  } else {
    weaknesses.push('Parseability issues detected; verify that text is not embedded inside images.');
    formattingTips.push('Avoid using visual text-in-images or complex tables that disrupt parser flows.');
  }

  if (breakdown.structure >= 80) {
    strengths.push('Good layout structure with standard headings and readable section hierarchy.');
  } else {
    weaknesses.push('Missing common resume sections (such as professional summary, skills, or projects).');
    formattingTips.push('Ensure standard headings like "Professional Experience" and "Education" are clearly demarcated.');
  }

  if (breakdown.skills >= 80) {
    strengths.push('Strong skills presentation with credible project/experience backing.');
  } else if (breakdown.skills < 50) {
    weaknesses.push('Low skills verification or credibility; list technologies in detail under projects/experience.');
    formattingTips.push('Deduplicate skills and categorize them (e.g. Languages, Frameworks) for clarity.');
  }

  if (breakdown.achievements >= 80) {
    strengths.push('Resume includes clear quantified achievements and action verbs.');
  } else {
    weaknesses.push('Lacks quantified accomplishments; add numeric results to your bullet points.');
    formattingTips.push('Use metrics where possible, e.g. "Improved query performance by 40%".');
  }

  if (breakdown.contact < 70) {
    weaknesses.push('Incomplete contact information; missing professional links like LinkedIn or GitHub.');
  } else {
    strengths.push('Complete contact information with active professional links.');
  }

  let recommendation = 'Your resume is ready for ATS systems. Focus on tailoring it to specific JDs when applying.';
  if (score < 60) {
    recommendation = 'Significant ATS issues found. Re-format your layout and add missing sections/contact links before applying.';
  } else if (score < 80) {
    recommendation = 'Good foundation. Improve your score by adding metrics to your projects and experience sections.';
  }

  const defaultStrengths = [
    'Clean section structure provides a solid foundation for keyword parsing.',
    'Technical skills list supports candidate profile.',
    'Education credentials align with standard candidate profiles.'
  ];
  const defaultWeaknesses = [
    'Consider highlighting more hands-on tools in experience achievements.',
    'Ensure clear start/end dates are specified for all work periods.',
    'Add more action verbs to start your experience bullets.'
  ];

  while (strengths.length < 3) {
    const s = defaultStrengths.find(x => !strengths.includes(x));
    if (s) strengths.push(s);
    else break;
  }
  while (weaknesses.length < 3) {
    const w = defaultWeaknesses.find(x => !weaknesses.includes(x));
    if (w) weaknesses.push(w);
    else break;
  }
  if (formattingTips.length < 2) {
    formattingTips.push("Use action verbs like 'designed', 'built', and 'optimized' to highlight technical contributions.");
    formattingTips.push("Quantify achievements where possible, such as 'increased performance by 20%'.");
  }

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    formattingTips: formattingTips.slice(0, 3),
    recommendation
  };
}

function buildRuleBasedFeedback({ overallScore, breakdown, skills, experience, projects, criticalRequirements }) {
  const strengths = [];
  const weaknesses = [];
  const formattingTips = [];

  if (breakdown.skillMatch >= 80) {
    strengths.push('Excellent alignment with required skills, matching core technical requirements.');
  } else if (breakdown.skillMatch < 55) {
    weaknesses.push('Low keyword overlap with target requirements; key skills are missing.');
  }

  if (skills.missingRequired.length > 0) {
    weaknesses.push(`Missing critical required skills: ${skills.missingRequired.slice(0, 3).join(', ')}.`);
  }

  if (breakdown.experienceRelevance >= 80) {
    strengths.push('Strong professional background matching the expected years of experience.');
  } else if (breakdown.experienceRelevance < 50) {
    weaknesses.push('Professional experience years or role seniority does not fully align with requirements.');
  }

  if (breakdown.projectsAchievements >= 75) {
    strengths.push('Relevant project history showcasing technologies and outcomes aligned with the role.');
  } else if (breakdown.projectsAchievements < 50) {
    weaknesses.push('Projects list lacks measurable outcomes or target tech stack implementation.');
  }

  if (breakdown.formattingParseability < 70) {
    formattingTips.push('Ensure your resume has standard section headings and uses standard bullet lists.');
    formattingTips.push('Avoid complex nested tables or multi-column layouts that ATS scanners can misread.');
  } else {
    formattingTips.push('Clean, standard layout which makes text easily parseable by modern ATS systems.');
  }

  if (criticalRequirements.missing.length > 0) {
    weaknesses.push(`Missing mandatory requirements: ${criticalRequirements.missing.slice(0, 2).join(', ')}.`);
  } else if (criticalRequirements.met.length > 0) {
    strengths.push('Successfully meets all mandatory critical requirements.');
  }

  let recommendation = `Tailor your experience bullets by adding missing skills like ${skills.missingRequired.slice(0, 2).join(', ') || 'required tools'}.`;
  if (overallScore >= 85) {
    recommendation = 'Excellent match! Proceed with applying, and make sure to review the specific job description highlights for final interview prep.';
  } else if (overallScore >= 70) {
    recommendation = 'Strong candidate profile. Optimize your bullet points by adding measurable metrics to projects to push the score higher.';
  } else if (overallScore >= 55) {
    recommendation = `Moderate match. Consider adding more context around ${skills.missingRequired.slice(0, 2).join(', ') || 'essential skills'} in your projects section to show hands-on experience.`;
  }

  const defaultStrengths = [
    'Clean section structure provides a solid foundation for keyword parsing.',
    'Technical skills list supports core requirements of the role profile.',
    'Education credentials align with standard candidate profiles.'
  ];
  const defaultWeaknesses = [
    'Consider highlighting more hands-on tools in experience achievements.',
    'Ensure clear start/end dates are specified for all work periods.',
    'Add more action verbs to start your experience bullets.'
  ];

  while (strengths.length < 3) {
    const s = defaultStrengths.find(x => !strengths.includes(x));
    if (s) strengths.push(s);
    else break;
  }
  while (weaknesses.length < 3) {
    const w = defaultWeaknesses.find(x => !weaknesses.includes(x));
    if (w) weaknesses.push(w);
    else break;
  }
  if (formattingTips.length < 2) {
    formattingTips.push("Use action verbs like 'designed', 'built', and 'optimized' to highlight technical contributions.");
    formattingTips.push("Quantify achievements where possible, such as 'increased performance by 20%'.");
  }

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    formattingTips: formattingTips.slice(0, 3),
    recommendation
  };
}

export const generateATSAnalysis = async (resumeText, jobRole, jobDescription = '', difficulty = 'Medium', experienceLevel = 'Mid-Level') => {
  // 1. LLM structured parsing of Resume (Deterministic config temp=0)
  const resumeData = await parseResumeWithLLM(resumeText);
  
  // 2. LLM structured parsing of Job Description (if provided) (Deterministic config temp=0)
  const hasJd = jobDescription && jobDescription.trim().length > 0;
  let jdData;
  if (hasJd) {
    jdData = await parseJobDescriptionWithLLM(jobDescription, jobRole);
    if (!jdData.seniority || jdData.seniority === 'string') {
      jdData.seniority = experienceLevel;
    }
  } else {
    jdData = {
      jobTitle: '',
      seniority: experienceLevel,
      requirements: {
        required: { skills: [] },
        preferred: { skills: [] },
        optional: { skills: [] }
      },
      experienceYearsRequired: null,
      criticalRequirements: []
    };
  }

  // 3. Compute deterministic scores (Source of truth, untouched by LLM)
  const computed = computeAtsScores(resumeData, jdData, resumeText, difficulty);

  // 4. Map parameters for LLM enrichment prompt
  let mappedForPrompt;
  let matchedKeywords = [];
  let missingKeywords = [];
  
  if (computed.mode === 'resume_only') {
    mappedForPrompt = {
      mode: 'resume_only',
      score: computed.score,
      breakdown: computed.breakdown
    };
  } else {
    matchedKeywords = [...computed.skills.matchedRequired, ...computed.skills.matchedPreferred];
    missingKeywords = [...computed.skills.missingRequired, ...computed.skills.missingPreferred];
    mappedForPrompt = {
      mode: 'job_match',
      atsScore: computed.atsScore,
      keywordScore: computed.breakdown.skillMatch,
      matchedKeywords,
      missingKeywords
    };
  }

  // 5. LLM qualitative enrichment (Does NOT alter computed numeric scores)
  const enrichment = await enrichAtsFeedback(resumeText, jobRole, jobDescription, difficulty, experienceLevel, mappedForPrompt);

  const finalSummary = enrichment?.summary ||
    (computed.mode === 'resume_only'
      ? `This resume achieves a ${computed.score}% ATS readiness score based on structure, parseability, and content completeness.`
      : `This resume achieves a ${computed.atsScore}% match score for a ${experienceLevel} ${jobRole} role based on keyword density and experience indicators.`);

  const finalAdvice = enrichment?.actionableAdvice || 
    (computed.mode === 'resume_only'
      ? [
          'Ensure all sections have standard headings (e.g. Experience, Education) for parser recognition.',
          'Add quantified achievements (percentages, revenue, time saved) to show professional impact.',
          'Verify that contact details are complete, including LinkedIn and GitHub links.'
        ]
      : [
          computed.skills.missingRequired.length > 0
            ? `Incorporate key industry technologies like ${computed.skills.missingRequired.slice(0, 3).join(', ')} into your experience bullet points.`
            : 'Quantify your project achievements using specific metrics and numbers.',
          'Ensure your technical skills section highlights core framework knowledge relevant to the position.',
          'Align experience section action verbs with industry-standard engineering terms.'
        ]);

  // 6. Build rule-based feedback
  let ruleFeedback;
  if (computed.mode === 'resume_only') {
    ruleFeedback = buildResumeOnlyRuleFeedback({
      score: computed.score,
      breakdown: computed.breakdown,
      resumeData
    });
  } else {
    ruleFeedback = buildRuleBasedFeedback({
      overallScore: computed.overallScore,
      breakdown: computed.breakdown,
      skills: computed.skills,
      experience: computed.experience,
      projects: computed.projects,
      criticalRequirements: computed.criticalRequirements
    });
  }

  const payload = {
    ...computed,
    summary: finalSummary,
    actionableAdvice: finalAdvice,
    strengths: ruleFeedback.strengths,
    weaknesses: ruleFeedback.weaknesses,
    formattingTips: ruleFeedback.formattingTips,
    recommendation: ruleFeedback.recommendation
  };

  if (computed.mode !== 'resume_only') {
    payload.keywordScore = computed.breakdown.skillMatch;
    payload.experienceScore = computed.breakdown.experienceRelevance;
    payload.completenessScore = computed.breakdown.structureCompleteness;
    payload.formatScore = computed.breakdown.formattingParseability;
    payload.readinessLevel = computed.interviewReadiness;
    payload.matchedKeywords = matchedKeywords;
    payload.missingKeywords = missingKeywords;
    payload.keywordMatches = matchedKeywords;
  } else {
    payload.keywordScore = computed.breakdown.skills;
    payload.experienceScore = computed.breakdown.experience;
    payload.completenessScore = computed.breakdown.structure;
    payload.formatScore = computed.breakdown.parseability;
    payload.readinessLevel = 'N/A';
  }

  return payload;
};
