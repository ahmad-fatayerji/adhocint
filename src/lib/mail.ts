import nodemailer from "nodemailer";

export function createTransport() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !port || !user || !pass) {
        throw new Error("Missing EMAIL_* configuration");
    }

    return nodemailer.createTransport({
        host,
        port: Number(port),
        auth: { user, pass },
    });
}

export async function sendMail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}) {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!from) throw new Error("Missing EMAIL_FROM/EMAIL_USER");

    const transporter = createTransport();
    await transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
    });
}
