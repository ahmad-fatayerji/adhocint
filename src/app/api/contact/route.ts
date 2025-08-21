import type { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';

// Basic env-driven config. User must set these in a .env.local file.
// EMAIL_HOST (e.g. smtp.gmail.com)
// EMAIL_PORT (e.g. 465 or 587)
// EMAIL_USER (login/email)
// EMAIL_PASS (app password)
// CONTACT_TO (destination address, can be same as user)

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name = '', email = '', subject = '', message = '', company = '', t } = body as Record<string, string>;

    // Honeypot check
    if (company) return json(400, { ok: false, error: 'Spam detected' });

    // Minimal validation
    if (name.trim().length < 2) return json(400, { ok: false, error: 'Name too short' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { ok: false, error: 'Invalid email' });
    if (message.trim().length < 10) return json(400, { ok: false, error: 'Message too short' });

    // Simple fill time check (client sends t = Date.now() when form mounted)
    if (t) {
      const delta = Date.now() - Number(t);
      if (!isNaN(delta) && delta < 1200) {
        return json(400, { ok: false, error: 'Form filled too quickly' });
      }
    }

    const host = process.env.EMAIL_HOST;
    const port = Number(process.env.EMAIL_PORT || 0);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const to = process.env.CONTACT_TO || user;

    if (!host || !port || !user || !pass || !to) {
      return json(500, { ok: false, error: 'Email not configured' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587/others
      auth: { user, pass }
    });

    const mailSubject = subject ? `[Contact] ${subject}` : 'New Contact Form Submission';
    const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`;

    await transporter.sendMail({
      from: `Contact Form <${user}>`,
      replyTo: email,
      to,
      subject: mailSubject,
      text,
      html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Subject:</strong> ${subject || '(none)'}</p><p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>`
    });

    return json(200, { ok: true });
  } catch (e) {
    console.error('Contact form error', e);
    return json(500, { ok: false, error: 'Server error' });
  }
}
