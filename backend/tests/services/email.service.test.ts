import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../../src/services/email.service.ts';

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn((_config: unknown) => ({ sendMail: mockSendMail }));
  return { mockSendMail, mockCreateTransport };
});
vi.mock('nodemailer', () => ({
  default: {
    createTransport: (config: unknown) => mockCreateTransport(config),
  },
}));

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue(undefined);
  });

  it('should create transporter when host, user, and pass are provided', () => {
    mockCreateTransport.mockClear();

    new EmailService({
      host: 'smtp.example.com',
      port: 587,
      user: 'u',
      pass: 'p',
      from: 'from@example.com',
      to: 'to@example.com',
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'u', pass: 'p' },
    });
  });

  it('should not create transporter when host, user, or pass is missing', () => {
    mockCreateTransport.mockClear();

    new EmailService({ host: 'h', user: 'u' }); // no pass

    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('should not call sendMail when transporter is null (sendNewLawEmail)', async () => {
    const service = new EmailService({});
    await service.sendNewLawEmail({
      id: 1,
      title: 'T',
      text: 't',
      author: 'A',
      email: 'e@e.com',
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should call sendMail with correct options when sendNewLawEmail and transporter set', async () => {
    const service = new EmailService({
      host: 'h',
      user: 'u',
      pass: 'p',
      from: 'from@example.com',
      to: 'to@example.com',
    });

    await service.sendNewLawEmail({
      id: 42,
      title: 'A Law',
      text: 'The law text',
      author: 'Author',
      email: 'author@example.com',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [opts] = mockSendMail.mock.calls[0];
    expect(opts.from).toBe('from@example.com');
    expect(opts.to).toBe('to@example.com');
    expect(opts.subject).toContain('42');
    expect(typeof opts.text).toBe('string');
    expect(typeof opts.html).toBe('string');
  });

  it('should not throw when sendNewLawEmail sendMail rejects', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const service = new EmailService({
      host: 'h',
      user: 'u',
      pass: 'p',
    });

    await expect(
      service.sendNewLawEmail({
        id: 1,
        title: 'T',
        text: 't',
        author: 'A',
        email: 'e@e.com',
      })
    ).resolves.toBeUndefined();
  });

  it('should throw when sendCalculationEmail and transporter is null', async () => {
    const service = new EmailService({});

    await expect(
      service.sendCalculationEmail({
        to: 't@t.com',
        taskDescription: 'Task',
        senderName: 'S',
        senderEmail: 's@s.com',
        recipientName: 'R',
        urgency: 'high',
        complexity: 'low',
        importance: 'high',
        skill: 'none',
        frequency: 'rare',
        probability: 0.5,
        interpretation: 'Maybe',
      })
    ).rejects.toThrow('Email service not configured');
  });

  it('should call sendMail and return { success: true } when sendCalculationEmail with transporter', async () => {
    const service = new EmailService({
      host: 'h',
      user: 'u',
      pass: 'p',
      from: 'noreply@example.com',
      to: 'admin@example.com',
    });

    const result = await service.sendCalculationEmail({
      to: 'recipient@example.com',
      taskDescription: 'Task',
      senderName: 'Sender',
      senderEmail: 'sender@example.com',
      recipientName: 'Recipient',
      urgency: 'high',
      complexity: 'medium',
      importance: 'high',
      skill: 'low',
      frequency: 'often',
      probability: 0.75,
      interpretation: 'Likely',
    });

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [opts] = mockSendMail.mock.calls[0];
    expect(opts.to).toBe('recipient@example.com');
    expect(opts.bcc).toBe('admin@example.com');
    expect(opts.from).toBe('noreply@example.com');
    expect(opts.subject).toBeDefined();
    expect(opts.text).toBeDefined();
    expect(opts.html).toBeDefined();
  });

  it('should throw with message and cause when sendCalculationEmail sendMail rejects', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Network error'));
    const service = new EmailService({
      host: 'h',
      user: 'u',
      pass: 'p',
    });

    await expect(
      service.sendCalculationEmail({
        to: 't@t.com',
        taskDescription: 'T',
        senderName: 'S',
        senderEmail: 's@s.com',
        recipientName: 'R',
        urgency: 'u',
        complexity: 'c',
        importance: 'i',
        skill: 'sk',
        frequency: 'f',
        probability: 0.5,
        interpretation: 'i',
      })
    ).rejects.toThrow(/Failed to send calculation email/);

    try {
      await service.sendCalculationEmail({
        to: 't@t.com',
        taskDescription: 'T',
        senderName: 'S',
        senderEmail: 's@s.com',
        recipientName: 'R',
        urgency: 'u',
        complexity: 'c',
        importance: 'i',
        skill: 'sk',
        frequency: 'f',
        probability: 0.5,
        interpretation: 'i',
      });
    } catch (e: any) {
      expect(e.cause).toEqual(expect.any(Error));
      expect(e.cause.message).toBe('Network error');
    }
  });
});
