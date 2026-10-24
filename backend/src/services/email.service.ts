import nodemailer from 'nodemailer';
import {
  createSodsEmailHtml,
  createSodsEmailSubject,
  createSodsEmailText,
} from '../../../shared/modules/sods-email-template.ts';
import {
  type LawSubmissionEmailData,
  createLawSubmissionEmailSubject,
  createLawSubmissionEmailText,
  createLawSubmissionEmailHtml,
} from '../../../shared/modules/law-submission-email-template.ts';
import {
  type LawApprovalEmailData,
  createLawApprovalEmailSubject,
  createLawApprovalEmailText,
  createLawApprovalEmailHtml,
} from '../../../shared/modules/law-approval-email-template.ts';

export interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
}

export class EmailService {
  private config: EmailConfig;
  private transporter: ReturnType<typeof nodemailer.createTransport> | null;

  constructor(config: EmailConfig) {
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

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** Thanks the submitter once their law is published. Never throws; addresses are not logged. */
  async sendLawApprovedEmail(to: string, lawData: LawApprovalEmailData): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject: createLawApprovalEmailSubject(),
        text: createLawApprovalEmailText(lawData),
        html: createLawApprovalEmailHtml(lawData),
      });
      console.log(`Thank-you email sent for law ID ${lawData.id}`);
      return true;
    } catch (error: unknown) {
      console.error(`Failed to send thank-you email for law ID ${lawData.id}:`, error);
      return false;
    }
  }

  async sendNewLawEmail(lawData: LawSubmissionEmailData): Promise<void> {
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
    } catch (error: unknown) {
      console.error('Failed to send email notification:', error);
      // Don't fail the submission if email fails
    }
  }

  async sendCalculationEmail(calculationData: {
    to: string;
    taskDescription: string;
    senderName: string;
    senderEmail: string;
    recipientName: string;
    urgency: string;
    complexity: string;
    importance: string;
    skill: string;
    frequency: string;
    probability: number;
    interpretation: string;
  }): Promise<{ success: boolean }> {
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
    } catch (error: unknown) {
      const message = `Failed to send calculation email: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(message, { cause: error });
    }
  }
}
