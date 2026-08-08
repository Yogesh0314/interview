import PDFDocument from 'pdfkit';
import Interview from '../models/Interview.js';

export const downloadPDFReport = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (interview.status !== 'completed') {
      return res.status(400).json({ message: 'Interview is not completed yet' });
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Interview_Report_${interview._id}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#4f46e5').text('Interview.ai - Assessment Report', { align: 'center' });
    doc.moveDown(1);

    // Metadata
    doc.fontSize(12).font('Helvetica').fillColor('#000000');
    doc.text(`Role: ${interview.experienceLevel} ${interview.jobRole}`);
    doc.text(`Format: ${interview.difficulty} ${interview.type}`);
    doc.text(`Date: ${new Date(interview.createdAt).toLocaleDateString()}`);
    doc.moveDown(2);

    // Scores
    const overall = interview.overallScore ?? interview.analysis?.overallScore;
    if (overall !== undefined && overall !== null) {
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#4f46e5').text(`Overall Score: ${overall}/10`);
      doc.moveDown(0.5);

      // Skill breakdown subscores
      doc.fontSize(11).font('Helvetica').fillColor('#4b5563');
      const subScores = [
        `Communication: ${interview.communicationScore ?? 'N/A'}/10`,
        `Technical: ${interview.technicalScore ?? 'N/A'}/10`,
        `Problem Solving: ${interview.problemSolvingScore ?? 'N/A'}/10`,
        `Architecture: ${interview.architectureScore ?? 'N/A'}/10`,
        `Behavioral: ${interview.behavioralScore ?? 'N/A'}/10`,
      ];
      doc.text(subScores.join('  |  '));
      doc.moveDown(1);
    }

    // Strengths
    const strengths = (interview.strengths && interview.strengths.length > 0)
      ? interview.strengths
      : (interview.analysis?.strengths || []);
    if (strengths.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#10b981').text('Key Strengths');
      doc.fontSize(11).font('Helvetica').fillColor('#374151');
      strengths.forEach(s => doc.text(`• ${s}`));
      doc.moveDown(1);
    }

    // Growth Areas / Weaknesses
    const growthAreas = (interview.growthAreas && interview.growthAreas.length > 0)
      ? interview.growthAreas
      : (interview.analysis?.weaknesses || interview.analysis?.growthAreas || []);
    if (growthAreas.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#f59e0b').text('Areas for Growth');
      doc.fontSize(11).font('Helvetica').fillColor('#374151');
      growthAreas.forEach(w => doc.text(`• ${w}`));
      doc.moveDown(1);
    }

    // Comprehensive Feedback
    if (interview.comprehensiveFeedback) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('Executive Feedback');
      doc.fontSize(11).font('Helvetica').fillColor('#374151').text(interview.comprehensiveFeedback);
      doc.moveDown(1.5);
    }

    // Transcript
    doc.fontSize(16).font('Helvetica-Bold').text('Interview Transcript', { underline: true });
    doc.moveDown(1);

    interview.messages.forEach(msg => {
      const isAI = msg.role === 'ai';
      doc.font('Helvetica-Bold').fillColor(isAI ? '#4f46e5' : '#10b981').text(isAI ? 'Interviewer (AI):' : 'Candidate:');
      doc.font('Helvetica').fillColor('#333333').text(msg.content);
      doc.moveDown(0.5);
    });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('PDF Generation Error:', error);
    // If headers already sent, we can't send JSON. 
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
    }
  }
};
