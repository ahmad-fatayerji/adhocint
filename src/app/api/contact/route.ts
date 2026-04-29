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

        const escapedMessage = message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${mailSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3960ad 0%,#958349 100%);padding:36px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">adhoc<span style="opacity:0.75;">int</span></span>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:20px;">New Message</span>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">${subject ? subject : 'Contact Form Submission'}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 24px;">

            <!-- Sender info card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="48" valign="middle" style="padding-right:14px;">
                        <table cellpadding="0" cellspacing="0" width="48" height="48">
                          <tr>
                            <td width="48" height="48" align="center" valign="middle"
                                style="width:48px;height:48px;border-radius:50%;background:#3960ad;font-size:20px;font-weight:700;color:#ffffff;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                              ${name.charAt(0).toUpperCase()}
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td valign="middle">
                        <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#0a0a0a;">${name}</p>
                        <a href="mailto:${email}" style="color:#3960ad;font-size:13px;text-decoration:none;">${email}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Field: Subject -->
            ${subject ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#958349;">Subject</p>
                  <p style="margin:0;font-size:15px;color:#171717;">${subject}</p>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e8eaed;margin:0 0 20px;"/>
            ` : ''}

            <!-- Field: Message -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#958349;">Message</p>
                  <div style="font-size:15px;line-height:1.7;color:#333;background:#f7f8fb;border-left:3px solid #3960ad;padding:16px 20px;border-radius:0 6px 6px 0;">${escapedMessage}</div>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Reply CTA -->
        <tr>
          <td style="padding:0 40px 32px;">
            <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject || 'Your message')}"
               style="display:inline-block;background:linear-gradient(135deg,#3960ad 0%,#958349 100%);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;letter-spacing:0.3px;">
              Reply to ${name}
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7f8fb;padding:20px 40px;border-top:1px solid #e8eaed;">
            <p style="margin:0;font-size:12px;color:#888;text-align:center;">
              Sent via the contact form at <strong style="color:#3960ad;">adhocint.com</strong> &mdash; reply directly to respond to ${name}.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await transporter.sendMail({
            from: `Contact Form <${user}>`,
            replyTo: email,
            to,
            subject: mailSubject,
            text,
            html,
        });

        return json(200, { ok: true });
    } catch (e) {
        console.error('Contact form error', e);
        return json(500, { ok: false, error: 'Server error' });
    }
}
