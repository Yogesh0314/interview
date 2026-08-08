import mongoose from 'mongoose';

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  resumeText: {
    type: String,
    required: true,
  },
  jobDescription: {
    type: String,
    default: '',
  },
  length: {
    type: String, // '15', '30', '60' - kept for reference but not used for turn calculation
    default: '15',
  },
  jobRole: {
    type: String,
    required: true,
  },
  experienceLevel: {
    type: String,
    required: true,
  },
  difficulty: {
    type: String,
    required: true,
    default: 'Medium'
  },
  type: {
    type: String,
    required: true,
    default: 'Technical'
  },
  maxTurns: {
    type: Number,
    default: 50,
  },
  status: {
    type: String,
    enum: ['ongoing', 'completed'],
    default: 'ongoing'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
  },
  durationSeconds: {
    type: Number,
  },
  currentPhase: {
    type: String,
    enum: ['warmup', 'opening', 'technical_skills', 'internship_experience', 'projects', 'skills', 'technical_deep_dive', 'technical', 'fundamentals_and_dsa', 'fundamentals', 'behavioral', 'closing'],
    default: 'warmup'
  },
  messages: [{
    role: { type: String, enum: ['system', 'ai', 'user'] },
    content: String,
    phase: String,          // Interview arc phase for 'ai' messages (answer-driven)
    score: Number,          // Optional (populated during post-interview finish if needed)
    feedback: String,       // Optional (populated during post-interview finish if needed)
    followUpOnSameTopic: Boolean, // Only populated for 'ai' messages
    timestamp: { type: Date, default: Date.now }
  }],
  overallScore: {
    type: Number,
  },
  communicationScore: Number,
  technicalScore: Number,
  problemSolvingScore: Number,
  architectureScore: Number,
  behavioralScore: Number,
  growthAreas: {
    type: [String],
  },
  strengths: {
    type: [String],
  },
  comprehensiveFeedback: {
    type: String,
  },
  questionBreakdown: [{
    question: String,
    userAnswer: String,
    accuracyScore: Number,
    detailedFeedback: String,
    idealAnswer: String,
    improvedAnswer: String
  }]
}, { timestamps: true });

export default mongoose.model('Interview', InterviewSchema);
