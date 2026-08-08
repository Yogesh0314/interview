import User from '../models/User.js';
import Interview from '../models/Interview.js';

export const getPlatformStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalInterviews = await Interview.countDocuments();
    const completedInterviews = await Interview.countDocuments({ status: 'completed' });
    
    // Sum total credits allocated across users
    const users = await User.find().select('credits');
    const totalCreditsAllocated = users.reduce((acc, u) => acc + (u.credits || 0), 0);

    // Compute aggregate Growth Analysis skill averages across all completed interviews
    const completedList = await Interview.find({ status: 'completed' }).select(
      'overallScore communicationScore technicalScore problemSolvingScore architectureScore behavioralScore'
    );

    let avgOverall = 0, avgComm = 0, avgTech = 0, avgProb = 0, avgArch = 0, avgBehav = 0;
    if (completedList.length > 0) {
      const sum = completedList.reduce((acc, item) => ({
        overall: acc.overall + (item.overallScore || 0),
        comm: acc.comm + (item.communicationScore || item.overallScore || 0),
        tech: acc.tech + (item.technicalScore || item.overallScore || 0),
        prob: acc.prob + (item.problemSolvingScore || item.overallScore || 0),
        arch: acc.arch + (item.architectureScore || item.overallScore || 0),
        behav: acc.behav + (item.behavioralScore || item.overallScore || 0),
      }), { overall: 0, comm: 0, tech: 0, prob: 0, arch: 0, behav: 0 });

      const n = completedList.length;
      avgOverall = Number((sum.overall / n).toFixed(1));
      avgComm = Number((sum.comm / n).toFixed(1));
      avgTech = Number((sum.tech / n).toFixed(1));
      avgProb = Number((sum.prob / n).toFixed(1));
      avgArch = Number((sum.arch / n).toFixed(1));
      avgBehav = Number((sum.behav / n).toFixed(1));
    } else {
      // Default baseline averages if no completed interviews exist yet
      avgOverall = 7.5; avgComm = 7.8; avgTech = 7.6; avgProb = 7.2; avgArch = 7.4; avgBehav = 7.9;
    }

    res.json({
      totalUsers,
      totalInterviews,
      completedInterviews,
      totalCreditsAllocated,
      estimatedRevenue: totalUsers * 499,
      growthAverages: {
        avgOverallScore: avgOverall,
        avgCommunicationScore: avgComm,
        avgTechnicalScore: avgTech,
        avgProblemSolvingScore: avgProb,
        avgArchitectureScore: avgArch,
        avgBehavioralScore: avgBehav,
      }
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ message: 'Failed to fetch platform stats', error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

export const updateUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { credits } = req.body;
    if (typeof credits !== 'number') {
      return res.status(400).json({ message: 'Credits must be a number' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.credits = credits;
    await user.save();
    res.json({ _id: user._id, name: user.name, email: user.email, credits: user.credits, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user credits', error: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be user or admin' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = role;
    await user.save();
    res.json({ _id: user._id, name: user.name, email: user.email, credits: user.credits, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role', error: error.message });
  }
};

export const getAllInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch interviews', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own admin account' });
    }
    await User.findByIdAndDelete(userId);
    await Interview.deleteMany({ user: userId });
    res.json({ message: 'User and associated interviews deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};
