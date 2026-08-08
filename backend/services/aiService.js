import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { computeAtsScores } from './atsService.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const modelName = 'gemini-3.6-flash';

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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

  // How many consecutive follow-ups have been spent on the current topic
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

const GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  temperature: 0.95,
  topP: 0.92,
};

function parseJsonOutput(text) {
  try {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON from AI response:', text);
    throw new Error('Invalid JSON response from AI');
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateWithRetry = async (prompt, retries = 6, delayMs = 4000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await getAIClient().models.generateContent({
        model: modelName,
        contents: prompt,
        config: GENERATION_CONFIG,
      });
      return parseJsonOutput(response.text);
    } catch (error) {
      const errString = String(error);
      const isRateLimit = error.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && i < retries - 1) {
        const wait = delayMs * (i + 1);
        console.warn(`[AI] Quota rate limit hit, retrying in ${wait}ms (attempt ${i + 2}/${retries})...`);
        await sleep(wait);
        continue;
      }

      if (isRateLimit && prompt.includes('ATS qualitative feedback')) {
        console.warn('[AI] ATS feedback enrichment skipped — using rule-based feedback.');
        return null;
      }

      if (i < retries - 1) {
        await sleep(delayMs);
        continue;
      }

      console.error('AI Generation Error Details:', error);
      throw new Error(`AI API Error: ${errString}`);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEWER PERSONA (100% DYNAMIC — ZERO HARDCODED QUESTIONS)
// ─────────────────────────────────────────────────────────────────────────────
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
Greet the candidate warmly as Reecha, set brief expectations for the ${jobRole} interview (${type}), and dynamically ask them to introduce their background, referencing key elements from their resume summary. Do NOT use fixed static scripts.
`.trim(),

    technical_skills: `
PHASE: Stage 2 — technical_skills (Technical Skills & Tools on Resume)
Inspect the candidate's resume for listed technical skills, programming languages, frameworks, databases, or cloud tools. Select high-value tools listed on their resume and probe how they apply them in practice.
`.trim(),

    internship_experience: `
PHASE: Stage 3 — internship_experience (Internship & Work Experience from Resume)
Inspect the candidate's resume for internships, co-ops, or past work experience. Dynamically ask about their specific contributions, team collaboration, feature delivery, or practical learnings during that role.
`.trim(),

    projects: `
PHASE: Stage 4 — projects (Resume Project Architecture & Ownership)
Select a key project mentioned in the candidate's resume. Dynamically ask about their technical ownership, architecture, data flow, or why they chose the key technologies involved.
`.trim(),

    technical_deep_dive: `
PHASE: Stage 5 — technical_deep_dive (Deep Technical Probing & Under-the-Hood Mechanics)
Drill directly into a high-value technology or architecture pattern the candidate JUST mentioned in their last reply. Dynamically ask how it works under the hood or how trade-offs were handled.
`.trim(),

    fundamentals_and_dsa: `
PHASE: Stage 6 — fundamentals_and_dsa (Role Fundamentals, DBMS & Problem Solving)
Test core role fundamentals connected to their experience: Database design (SQL vs NoSQL, indexing), CS fundamentals (OOP, DBMS, OS, Networking), or present a dynamic coding challenge.
`.trim(),

    behavioral: `
PHASE: Stage 7 — behavioral (STAR Method Evidence)
Dynamically formulate one STAR-style scenario question tailored to their role level (e.g. handling technical disagreement, tight deadline pressure, or production issues).
`.trim(),

    closing: `
PHASE: Stage 8 — closing (Dynamic Candidate Q&A & Wrap-Up)
Dynamically invite candidate questions about the team or role. If they just asked a question, answer concisely and wrap up warmly with personalized feedback.
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

You are interviewing a candidate for the position of "${experienceLevel} ${jobRole}".
Interview type: "${type}" | Difficulty: "${difficulty}".

${phaseGuidance}

IMPORTANT: Generate a 100% dynamic, warm opening tailored specifically to the candidate's resume context below.
Return ONLY a valid JSON object:
{ "aiResponse": "string" }

Candidate's Resume:
"""
${resumeText}
"""
  `.trim();

  return await generateWithRetry(prompt);
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
  // Extract recent 2-3 turns for compact context to minimize latency
  const relevantHistory = previousMessages
    .filter(m => m.role === 'ai' || m.role === 'user')
    .slice(-6);

  const historyStr = relevantHistory
    .map(m => `${m.role === 'ai' ? 'REECHA (Interviewer)' : 'CANDIDATE'}: ${m.content}`)
    .join('\n\n');

  const phaseGuidance = getPhaseGuidance(currentPhase, nextTurn, maxTurns, jobRole, type);
  const askedQuestionsBlock = buildAskedQuestionsBlock(previousMessages);
  const isAdaptive = difficulty === 'Adaptive';

  const timeGuidance = timeState === 'TIME_LIMITED'
    ? `TIME CONSTRAINT: Only ~${remainingSeconds} seconds remaining in this interview! Keep your next question brief, focused, and single-part. Do NOT launch complex multi-part system design problems or deep claim verification chains.`
    : `TIME BUDGET: ~${remainingSeconds} seconds remaining in this interview. Maintain natural dynamic interviewing.`;

  const prompt = `
${REECHA_LIVE_PERSONA}

${REAL_INTERVIEW_FLOW}

You are interviewing a candidate for "${experienceLevel} ${jobRole}" (${type}, ${difficulty} difficulty).
Current turn: ${nextTurn}.
${timeGuidance}

${phaseGuidance}

LIVE INTERVIEW DIRECTIVE (LIGHTWEIGHT & LOW LATENCY — NO DEEP ANSWER SCORING):
Your ONLY goal is to understand the candidate's latest reply, identify high-value claims or spontaneous technical concepts, and ask the single best next conversational interview question.
Do NOT score the answer, do NOT generate detailed feedback or model answers. Focus solely on live dialogue flow.

RULES FOR THE NEXT QUESTION & PHASE PROGRESSION:
1. 100% DYNAMIC & CLAIM-VERIFYING: Selectively probe high-value technical claims or spontaneous concepts the candidate JUST mentioned or listed in their resume. NEVER repeat a question.
2. CONVERSATIONAL CONTINUITY: Briefly acknowledge their reply in a natural tone before asking ONE follow-up question.
3. FOLLOW-UP LIMIT & STOPPING RULE: Do not spend more than 2 consecutive follow-ups on the same topic. Stop probing a claim when sufficient evidence is gathered. Advance across the 8-stage arc: warmup → technical_skills → internship_experience → projects → technical_deep_dive → fundamentals_and_dsa → behavioral → closing.
4. VALID "nextPhase" values: ${JSON.stringify(PHASE_ORDER)}.
5. COMPLETION: Set "isInterviewComplete": true ONLY if in closing phase after wrap-up or if time state requires closing. Otherwise set false.
6. DIFFICULTY: Return "difficultyLevel": "${difficulty}".

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

  return await generateWithRetry(prompt);
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONA 2 — SENIOR INTERVIEW EVALUATOR: Deep Post-Interview Analysis
// ─────────────────────────────────────────────────────────────────────────────
const SENIOR_EVALUATOR_PERSONA = `
You are a Senior Technical Interview Evaluator with 15+ years of experience conducting and evaluating engineering interviews.

EVALUATION PHILOSOPHY:
1. EVIDENCE VS ASSUMPTION:
   - Assess what the candidate ACTUALLY DEMONSTRATED with verified evidence vs what they merely claimed on their resume or in vague statements.
   - Distinguish between Resume Claims, Candidate Claims, Candidate Explanations, Demonstrated Knowledge, Verified Practical Experience, Strong Evidence, and Weak Evidence.
2. OBJECTIVE EVIDENCE REPORTING:
   - Describe evidence objectively. Do NOT assume dishonesty when knowledge is unverified or partial—simply note where evidence was strong vs lacking.
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

Review the following complete interview transcript and candidate context to provide a deep, accurate evidence-based performance analysis.

CANDIDATE & ROLE CONTEXT:
- Role: ${experienceLevel} ${jobRole} (${type} Interview, ${difficulty} Difficulty)
${jobDescription ? `- Target Job Description: ${jobDescription}\n` : ''}${resumeText ? `- Candidate Resume Summary: ${resumeText}\n` : ''}
INTERVIEW TRANSCRIPT:
${JSON.stringify(cleanMessages, null, 2)}

Your task:
1. Provide an overall score out of 10 ("overallScore").
2. Provide score 1-10 for each of the 5 skill competency dimensions:
   - "communicationScore": clarity, structured answers, articulation
   - "technicalScore": depth of technology, under-the-hood mechanics
   - "problemSolvingScore": analytical reasoning, handling trade-offs & edge cases
   - "architectureScore": project ownership, data flow, system design
   - "behavioralScore": STAR evidence, collaboration, professionalism
3. Identify 2-3 key strengths demonstrated in the interview ("strengths").
4. Identify 2-3 specific growth areas ("growthAreas").
5. Provide a comprehensive summary paragraph of their performance ("comprehensiveFeedback").
6. Provide a turn-by-turn breakdown for every single question asked by the AI ("questionBreakdown"):
   - "question": the exact question Reecha asked
   - "userAnswer": the candidate's verbatim answer
   - "accuracyScore": score 1–10
   - "detailedFeedback": honest, specific feedback on what was demonstrated vs missing, and whether their claim was verified
   - "idealAnswer": what a strong, complete model answer would look like
   - "improvedAnswer": rewrite the candidate's ACTUAL answer — preserve their real experience, facts, and tools mentioned, but improve clarity, structure, articulation, and technical depth. Do NOT invent new technologies or false achievements.

Return ONLY a valid JSON object matching this exact schema:
{
  "overallScore": number,
  "communicationScore": number,
  "technicalScore": number,
  "problemSolvingScore": number,
  "architectureScore": number,
  "behavioralScore": number,
  "strengths": [ "string", "string" ],
  "growthAreas": [ "string", "string" ],
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

  return await generateWithRetry(prompt);
};

// ─────────────────────────────────────────────────────────────────────────────
// generateATSAnalysis — Deterministic scoring + optional AI narrative enrichment
// ─────────────────────────────────────────────────────────────────────────────
async function enrichAtsFeedback(resumeText, jobRole, jobDescription, difficulty, experienceLevel, computed) {
  const prompt = `
You are an expert ATS (Applicant Tracking System) Specialist and Senior Technical Recruiter.
A candidate has submitted their resume for the position of "${experienceLevel} ${jobRole}".

Resume Text:
"""
${resumeText.slice(0, 3000)}
"""

Target Job Description:
"""
${jobDescription ? jobDescription.slice(0, 1500) : 'Standard ' + experienceLevel + ' ' + jobRole + ' requirements'}
"""

Our deterministic parser calculated these initial metrics:
- Overall Match Score: ${computed.atsScore}/100
- Keyword Match Score: ${computed.keywordScore}/100
- Found Keywords: ${computed.matchedKeywords.join(', ')}
- Missing Keywords: ${computed.missingKeywords.join(', ')}

Your task:
Enrich this analysis with brief, highly actionable professional insights:
1. "summary": A 2-sentence executive summary of how well this resume matches the target role.
2. "actionableAdvice": 3 specific, concrete suggestions to improve this resume for the target role.

Return ONLY a valid JSON object:
{
  "summary": "string",
  "actionableAdvice": [ "string", "string", "string" ]
}
  `.trim();

  try {
    return await generateWithRetry(prompt);
  } catch (err) {
    console.warn('[AI] ATS enrichment failed, returning base computed results:', err.message);
    return null;
  }
}

export const generateATSAnalysis = async (resumeText, jobRole, jobDescription = '', difficulty = 'Medium', experienceLevel = 'Mid-Level') => {
  const computed = computeAtsScores(resumeText, jobRole, jobDescription, difficulty, experienceLevel);
  const enrichment = await enrichAtsFeedback(resumeText, jobRole, jobDescription, difficulty, experienceLevel, computed);

  const finalSummary = enrichment?.summary ||
    `This resume achieves a ${computed.atsScore}% match score for a ${experienceLevel} ${jobRole} role based on keyword density and experience indicators.`;

  const finalAdvice = enrichment?.actionableAdvice || [
    computed.missingKeywords.length > 0
      ? `Incorporate key industry technologies like ${computed.missingKeywords.slice(0, 3).join(', ')} into your experience bullet points.`
      : 'Quantify your project achievements using specific metrics and numbers.',
    'Ensure your technical skills section highlights core framework knowledge relevant to the position.',
    'Align experience section action verbs with industry-standard engineering terms.'
  ];

  return {
    atsScore: computed.atsScore,
    keywordScore: computed.keywordScore,
    experienceScore: computed.experienceScore,
    completenessScore: computed.completenessScore,
    formatScore: computed.formatScore,
    readinessLevel: computed.readinessLevel,
    matchedKeywords: computed.matchedKeywords,
    missingKeywords: computed.missingKeywords,
    summary: finalSummary,
    actionableAdvice: finalAdvice,
  };
};
