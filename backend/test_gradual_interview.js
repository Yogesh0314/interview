import { startChat, continueChat, buildFlowContext, generateGrowthAnalysis } from './services/aiService.js';
import { getInterviewTimeState } from './utils/timeUtils.js';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  console.log('=== Testing Candidate-Driven AI Interview Engine (Time-Aware Dynamic Flow) ===');
  const resume = `
John Doe - Full Stack Developer
Experience: 3 years.
Skills: React, Node.js, Express, PostgreSQL, JWT Authentication, Redis.
Projects: College Compass - A student recommendation engine built with React, Node.js, and PostgreSQL.
  `.trim();

  // Test Time State Utility
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
  const mockInterview = { startTime, endTime, length: '15' };
  
  const timeInfo = getInterviewTimeState(mockInterview);
  console.log('\n--- Time State Helper Test ---');
  console.log('State:', timeInfo.state);
  console.log('Remaining Seconds:', timeInfo.remainingSeconds);
  if (timeInfo.state !== 'NORMAL') {
    throw new Error('Expected NORMAL time state for newly created 15m interview');
  }

  // Test Near-End Time State (30 seconds left -> CLOSING)
  const closingInterview = {
    startTime: new Date(Date.now() - 14.5 * 60 * 1000),
    endTime: new Date(Date.now() + 30 * 1000),
    length: '15'
  };
  const closingInfo = getInterviewTimeState(closingInterview);
  console.log('Near-End Time State:', closingInfo.state, `(${closingInfo.remainingSeconds}s remaining)`);
  if (closingInfo.state !== 'CLOSING') {
    throw new Error('Expected CLOSING state when 30s remaining');
  }

  console.log('\n--- Turn 1: Warmup Opening ---');
  const startRes = await startChat(resume, 50, 'Full Stack Developer', 'Mid-Level', 'Medium', 'Technical');
  console.log('Reecha:', startRes.aiResponse);

  const messages = [
    { role: 'ai', content: startRes.aiResponse, phase: 'warmup', timestamp: new Date() }
  ];

  console.log('\n--- Turn 2: Candidate Reply 1 (Mentions React & Express) ---');
  const reply1 = "Hi Reecha! I have 3 years of experience as a Full Stack Engineer. I specialize in building web applications using React, Express, and PostgreSQL. In my project College Compass, I designed the API gateway and state management.";
  let flowContext = buildFlowContext(messages, 50);

  const turn2Res = await continueChat(
    resume,
    messages,
    reply1,
    2,
    50,
    'Full Stack Developer',
    'Mid-Level',
    'Medium',
    'Technical',
    'warmup',
    flowContext,
    'NORMAL',
    800
  );
  console.log('Reecha (Turn 2 NORMAL state):', turn2Res.aiResponse);
  console.log('Next Phase:', turn2Res.nextPhase);
  console.log('FollowUpOnSameTopic:', turn2Res.followUpOnSameTopic);

  messages.push({ role: 'user', content: reply1, timestamp: new Date() });
  messages.push({ role: 'ai', content: turn2Res.aiResponse, phase: turn2Res.nextPhase, followUpOnSameTopic: turn2Res.followUpOnSameTopic, timestamp: new Date() });

  console.log('\n--- Turn 3: Candidate Reply 2 (TIME_LIMITED State - 90s remaining) ---');
  const reply2 = "To manage auth, I implemented JWT authentication with refresh tokens stored in HTTP-only cookies and access tokens in memory. Middleware verifies the HMAC signature on every request.";
  flowContext = buildFlowContext(messages, 50);

  const turn3Res = await continueChat(
    resume,
    messages,
    reply2,
    3,
    50,
    'Full Stack Developer',
    'Mid-Level',
    'Medium',
    'Technical',
    turn2Res.nextPhase,
    flowContext,
    'TIME_LIMITED',
    90
  );
  console.log('Reecha (Turn 3 TIME_LIMITED state):', turn3Res.aiResponse);
  console.log('Next Phase:', turn3Res.nextPhase);
  console.log('FollowUpOnSameTopic:', turn3Res.followUpOnSameTopic);

  messages.push({ role: 'user', content: reply2, timestamp: new Date() });
  messages.push({ role: 'ai', content: turn3Res.aiResponse, phase: turn3Res.nextPhase, followUpOnSameTopic: turn3Res.followUpOnSameTopic, timestamp: new Date() });

  console.log('\n============================================================');
  console.log('=== Deep Post-Interview Evaluation Test (generateGrowthAnalysis) ===');
  console.log('============================================================');

  const growthReport = await generateGrowthAnalysis(messages, {
    jobRole: 'Full Stack Developer',
    experienceLevel: 'Mid-Level',
    type: 'Technical',
    difficulty: 'Medium',
    resumeText: resume
  });

  console.log('Overall Score:', growthReport.overallScore);
  console.log('Communication Score:', growthReport.communicationScore);
  console.log('Technical Score:', growthReport.technicalScore);
  console.log('Strengths:', growthReport.strengths);
  console.log('Growth Areas:', growthReport.growthAreas);
  console.log('Question Breakdown Count:', growthReport.questionBreakdown?.length);

  console.log('\n=== All time-aware tests executed successfully! ===');
}

runTest().catch(console.error);


