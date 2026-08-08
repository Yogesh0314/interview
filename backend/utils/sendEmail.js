import nodemailer from 'nodemailer';
import logger from './logger.js';

const sendEmail = async (options) => {
  try {
    // Create a transporter using SMTP (Update with real credentials in production)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const message = {
      from: `${process.env.FROM_NAME || 'Interview.ai'} <${process.env.FROM_EMAIL || 'noreply@interview.ai'}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html, // Optional HTML support
    };

    const info = await transporter.sendMail(message);
    logger.info(`Message sent: %s`, info.messageId);
  } catch (error) {
    logger.error('Email could not be sent', error);
    throw new Error('Email could not be sent');
  }
};

export default sendEmail;
