import nodemailer from 'nodemailer';
import {
  createSodsEmailHtml,
  createSodsEmailSubject,
  createSodsEmailText,
} from '../../../shared/modules/sods-email-template.js';
import {
  createLawSubmissionEmailSubject,
  createLawSubmissionEmailText,
  createLawSubmissionEmailHtml,
} from '../../../shared/modules/law-submission-email-template.js';

export class EmailService {
  constructor(config) {
    this.config = config;
    this.transporter = null;
    
    if (config.host && config.user && config.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      console.log('Email notifications enabled');
    } else {
      console.log('Email notifications disabled (SMTP not configured)');
    }
  }

  async sendNewLawEmail(lawData) {
    if (!this.transporter) {
      console.log('Email not configured, skipping notification');
      return;
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject: createLawSubmissionEmailSubject(lawData.id),
        text: createLawSubmissionEmailText(lawData),
        html: createLawSubmissionEmailHtml(lawData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email notification sent for law ID ${lawData.id}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Don't fail the submission if email fails
    }
  }

  async sendCalculationEmail(calculationData) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    try {
      const {
        to,
        taskDescription,
        senderName,
        senderEmail,
        recipientName,
        urgency,
        complexity,
        importance,
        skill,
        frequency,
        probability,
        interpretation
      } = calculationData;

      const mailOptions = {
        from: this.config.from,
        to,
        bcc: this.config.to,
        subject: createSodsEmailSubject(probability, senderName),
        text: createSodsEmailText({
          taskDescription,
          senderName,
          senderEmail,
          recipientName,
          urgency,
          complexity,
          importance,
          skill,
          frequency,
          probability,
          interpretation,
        }),
        html: createSodsEmailHtml({
          taskDescription,
          senderName,
          senderEmail,
          recipientName,
          urgency,
          complexity,
          importance,
          skill,
          frequency,
          probability,
          interpretation,
        }),
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send calculation email: ${error.message}`);
    }
  }
}
