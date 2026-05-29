'use server';

import { z } from 'zod';
import { sendEmail } from '@/services/mail/resend';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
import { getSessionFromCookies as getSession } from '@/lib/auth/session';

const schema = z.object({
  email: z.string().email(),
  message: z.string().min(1).max(1250),
});

/**
 * Sends a pilot program request email via the shared mail service.
 * Target recipient: radixgenkipool@gmail.com
 */
export async function sendInstitutionalPilotMessage(formData: { email: string; message: string; lang: Locale }) {
  await getSession(); // Optional — public contact form
  try {
    // 1. Validate data
    const { lang, ...data } = formData;
    const validated = schema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: 'errorInvalidInput' as const };
    }

    const { email, message } = validated.data;
    const dict = await getDictionary(lang);

    // 2. Send email via service
    const result = await sendEmail({
      to: 'radixgenkipool@gmail.com',
      replyTo: email,
      subject: `${dict.institutionalPilot.emailSubject} ${email}`,
      text: `${message}\n\n---\n${dict.institutionalPilot.senderEmail}: ${email}`,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };

  } catch (_err) {
    return { success: false, error: 'errorGeneric' as const };
  }
}
