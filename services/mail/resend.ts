import { Resend } from 'resend';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

// Initialize Resend lazily to avoid errors during build time if env var is missing
let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('RESEND_API_KEY is not defined. Email sending will fail.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export type EmailOptions = {
  from?: string;
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
};

/**
 * Shared mail service using Resend HTTP API.
 * Compatible with Cloudflare Pages / Workers.
 */
export async function sendEmail(options: EmailOptions) {
  const resend = getResend();
  
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'Radix Genki Pool <onboarding@resend.dev>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      logger.error({ error, to: options.to }, 'Resend API error');
      return { success: false, error: 'errorApi' as const };
    }

    logger.info({ id: data?.id, to: options.to }, 'Email sent successfully');
    return { success: true, data };
  } catch (err) {
    logger.error({ err, to: options.to }, 'Unexpected error in mail service');
    return { success: false, error: 'errorGeneric' as const };
  }
}
