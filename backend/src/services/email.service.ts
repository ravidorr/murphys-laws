import nodemailer from 'nodemailer';
import { SITE_URL } from '../utils/constants.ts';
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

import {
  type DailyLawEmailData,
  createDailyLawHtml,
  createDailyLawSubject,
  createDailyLawText,
  createSubscriptionConfirmationHtml,
  createSubscriptionConfirmationSubject,
  createSubscriptionConfirmationText,
} from '../../../shared/modules/daily-law-email-template.ts';

export interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
}

export type ApprovalEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'not_configured' }
  | { status: 'failed' };

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

  /**
   * Thanks the submitter once their law is published. Never throws. Failures are logged by law ID, error code
   * and SMTP response code only, because the rest of an SMTP error can contain the recipient's address.
   */
  async sendLawApprovedEmail(to: string, lawData: LawApprovalEmailData): Promise<ApprovalEmailResult> {
    if (!this.transporter) {
      return { status: 'skipped', reason: 'not_configured' };
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: { name: '', address: to },
        subject: createLawApprovalEmailSubject(),
        text: createLawApprovalEmailText(lawData, SITE_URL),
        html: createLawApprovalEmailHtml(lawData, SITE_URL),
      });
      console.log(`Thank-you email sent for law ID ${lawData.id}`);
      return { status: 'sent' };
    } catch (error: unknown) {
      const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
      console.error(`Failed to send thank-you email for law ID ${lawData.id} (code: ${String(code ?? 'unknown')}, response: ${String(responseCode ?? 'none')})`);
      return { status: 'failed' };
    }
  }

  /**
   * Asks the owner of an address to confirm the daily email. Never throws; failures are logged by SMTP
   * code only because the rest of an SMTP error can contain the address.
   */
  async sendSubscriptionConfirmationEmail(to: string, confirmUrl: string): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        // Address object, not a string, so the address is never parsed as a recipient list.
        to: { name: '', address: to },
        subject: createSubscriptionConfirmationSubject(),
        text: createSubscriptionConfirmationText(confirmUrl),
        html: createSubscriptionConfirmationHtml(confirmUrl, SITE_URL),
      });
      return true;
    } catch (error: unknown) {
      this.logSendFailure('subscription confirmation', error);
      return false;
    }
  }

  /** Sends one subscriber the Law of the Day. Never throws; returns whether it was sent. */
  async sendDailyLawEmail(to: string, law: DailyLawEmailData, unsubscribeUrl: string): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: { name: '', address: to },
        subject: createDailyLawSubject(law),
        text: createDailyLawText(law, SITE_URL, unsubscribeUrl),
        html: createDailyLawHtml(law, SITE_URL, unsubscribeUrl),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      return true;
    } catch (error: unknown) {
      this.logSendFailure('daily law', error);
      return false;
    }
  }

  private logSendFailure(kind: string, error: unknown): void {
    const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
    console.error(`Failed to send ${kind} email (code: ${String(code ?? 'unknown')}, response: ${String(responseCode ?? 'none')})`);
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
