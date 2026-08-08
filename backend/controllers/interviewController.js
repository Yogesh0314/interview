import Interview from '../models/Interview.js';
import * as aiService from '../services/aiService.js';
import pdfParse from 'pdf-parse-new';
import { getInterviewTimeState } from '../utils/timeUtils.js';

const { buildFlowContext, normalizePhase } = aiService;

const ADAPTIVE_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Safety cap ceilings to prevent infinite loops (Time is the authoritative limit)
const SAFETY_MAX_TURNS = {
  '10': 40,
  '15': 50,
  '20': 60,
  '30': 80,
  '60': 150,
};

export const setupInterview = async (req, res) => {
  try {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admins manage the platform and cannot take candidate interviews.' });
    }

    const { length = '15', rawText, jobRole, experienceLevel, difficulty = 'Medium', type = 'Technical', jobDescription = '' } = req.body;
    
    if (req.user.credits <= 0) {
      return res.status(403).json({ message: 'No credits remaining. Please upgrade your account.' });
    }

    if (!jobRole || !experienceLevel) {
      return res.status(400).json({ message: 'Job Role and Experience Level are required' });
    }

    let resumeText = rawText;
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text;
    }

    if (!resumeText) {
      return res.status(400).json({ message: 'Resume text or PDF is required' });
    }

    const maxTurns = SAFETY_MAX_TURNS[length] || 50;
    const startTime = new Date();
    const durationMs = Number(length) * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);

    // Start chat — always warmup phase
    const startData = await aiService.startChat(resumeText, maxTurns, jobRole, experienceLevel, difficulty, type);

    // Save to DB
    const interview = await Interview.create({
      user: req.user._id,
      resumeText,
      jobDescription,
      length,
      jobRole,
      experienceLevel,
      difficulty,
      type,
      maxTurns,
      startTime,
      endTime,
      currentPhase: 'warmup',
      status: 'ongoing',
      messages: [
        {
          role: 'ai',
          content: startData.aiResponse,
          phase: 'warmup',
          followUpOnSameTopic: false,
          timestamp: new Date()
        }
      ]
    });

    // Decrement credits
    req.user.credits -= 1;
    await req.user.save();

    res.status(201).json(interview);
  } catch (error) {
    console.error('Setup Interview Error:', error);
    res.status(500).json({ message: 'Failed to setup interview', error: error.message, stack: error.stack });
  }
};

export const analyzeATS = async (req, res) => {
  try {
    const { rawText, jobRole, jobDescription = '', difficulty = 'Medium', experienceLevel = 'Mid-Level' } = req.body;
    
    if (!jobRole) {
      return res.status(400).json({ message: 'Job Role is required for ATS Analysis' });
    }

    let resumeText = rawText;
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text;
    }

    if (!resumeText) {
      return res.status(400).json({ message: 'Resume text or PDF is required' });
    }

    const analysis = await aiService.generateATSAnalysis(resumeText, jobRole, jobDescription, difficulty, experienceLevel);
    res.json(analysis);
  } catch (error) {
    console.error('ATS Analysis Error:', error);
    res.status(500).json({ message: 'Failed to generate ATS analysis', error: error.message });
  }
};

export const chatInterview = async (req, res) => {
  try {
    const { interviewId, answer } = req.body;

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (interview.status === 'completed') {
      return res.status(400).json({ message: 'Interview already completed' });
    }

    // 1. Always protect & save the candidate's submitted answer first
    interview.messages.push({
      role: 'user',
      content: answer,
      timestamp: new Date()
    });

    // 2. Authoritative Backend Time Check
    const timeInfo = getInterviewTimeState(interview);
    const currentTurn = interview.messages.filter(m => m.role === 'ai').length;
    const nextTurn = currentTurn + 1;
    const activePhase = interview.currentPhase || 'warmup';

    // 3. DECISION LOOP: CLOSING or EXPIRED -> Complete without calling Gemini question generation
    if (timeInfo.state === 'EXPIRED' || timeInfo.state === 'CLOSING' || nextTurn >= (interview.maxTurns || 50)) {
      const closingMsg = "Thank you for sharing your experience with me today. We have reached the end of our allotted interview time. This concludes our interview.";
      interview.messages.push({
        role: 'ai',
        content: closingMsg,
        phase: 'closing',
        followUpOnSameTopic: false,
        timestamp: new Date()
      });

      interview.currentPhase = 'closing';
      interview.status = 'completed';
      await interview.save();
      return res.json(interview);
    }

    // 4. DECISION LOOP: TIME_LIMITED or NORMAL -> Invoke 1 lightweight Gemini call for next question
    const flowContext = buildFlowContext(interview.messages, interview.maxTurns || 50);

    const chatData = await aiService.continueChat(
      interview.resumeText,
      interview.messages,
      answer,
      nextTurn,
      interview.maxTurns || 50,
      interview.jobRole,
      interview.experienceLevel,
      interview.difficulty,
      interview.type,
      activePhase,
      flowContext,
      timeInfo.state,
      timeInfo.remainingSeconds
    );

    const nextPhase = normalizePhase(chatData.nextPhase, activePhase);

    // Push AI question message
    interview.messages.push({
      role: 'ai',
      content: chatData.aiResponse,
      phase: nextPhase,
      followUpOnSameTopic: chatData.followUpOnSameTopic ?? false,
      timestamp: new Date()
    });

    interview.currentPhase = nextPhase;

    if (chatData.isInterviewComplete || nextPhase === 'closing') {
      interview.status = 'completed';
    }

    await interview.save();
    res.json(interview);
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ message: 'Failed to chat', error: error.message });
  }
};

export const finishInterview = async (req, res) => {
  try {
    const { interviewId } = req.body;
    
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (interview.status !== 'completed') {
      interview.status = 'completed';
    }

    // Deep post-interview evaluation with complete candidate & job context
    const analysis = await aiService.generateGrowthAnalysis(interview.messages, {
      jobRole: interview.jobRole,
      experienceLevel: interview.experienceLevel,
      type: interview.type,
      difficulty: interview.difficulty,
      resumeText: interview.resumeText,
      jobDescription: interview.jobDescription,
    });

    interview.overallScore = analysis.overallScore;
    interview.communicationScore = analysis.communicationScore || Math.min(10, Math.max(1, analysis.overallScore + 1));
    interview.technicalScore = analysis.technicalScore || analysis.overallScore;
    interview.problemSolvingScore = analysis.problemSolvingScore || Math.min(10, Math.max(1, analysis.overallScore - 1));
    interview.architectureScore = analysis.architectureScore || analysis.overallScore;
    interview.behavioralScore = analysis.behavioralScore || Math.min(10, Math.max(1, analysis.overallScore));

    interview.growthAreas = analysis.growthAreas || [];
    interview.strengths = analysis.strengths || [];
    interview.comprehensiveFeedback = analysis.comprehensiveFeedback || '';
    interview.questionBreakdown = analysis.questionBreakdown || [];
    await interview.save();

    res.json(interview);
  } catch (error) {
    console.error('Finish Error:', error);
    res.status(500).json({ message: 'Failed to finish interview', error: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
};
