import crypto from 'crypto';
import nodemailer from 'nodemailer';

type SendEmailParams = {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: {
        filename: string;
        contentBase64: string;
        contentType?: string;
    }[];
};

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || '').toLowerCase();
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const isProduction = process.env.NODE_ENV === 'production';

const getMissingVars = (keys: string[]) => keys.filter((key) => !process.env[key]);

export const getEmailConfigStatus = () => {
    const provider = EMAIL_PROVIDER || (isProduction ? '' : 'console');
    if (provider === 'console') {
        return { ok: true, provider, missing: [] as string[] };
    }
    if (provider === 'smtp') {
        const missing = getMissingVars(['EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']);
        return { ok: missing.length === 0, provider, missing };
    }
    if (provider === 'resend') {
        const missing = getMissingVars(['EMAIL_FROM', 'RESEND_API_KEY']);
        return { ok: missing.length === 0, provider, missing };
    }
    if (provider === 'sendgrid') {
        const missing = getMissingVars(['EMAIL_FROM', 'SENDGRID_API_KEY']);
        return { ok: missing.length === 0, provider, missing };
    }
    return { ok: false, provider: provider || 'unset', missing: ['EMAIL_PROVIDER'] };
};

export const logEmailConfigStatus = () => {
    const status = getEmailConfigStatus();
    if (status.ok) {
        if (status.provider === 'console') {
            console.warn('[EMAIL] Console mode is active (dev). Verification codes are logged, not emailed.');
        } else {
            console.log(`[EMAIL] Provider "${status.provider}" configured.`);
        }
        return;
    }
    console.warn(`[EMAIL] Provider "${status.provider}" is not fully configured.`);
    console.warn(`[EMAIL] Missing env vars: ${status.missing.join(', ')}`);
};

const toRecipientArray = (to: string | string[]) => (Array.isArray(to) ? to : [to]).filter(Boolean);

const sendWithResend = async ({ to, subject, html, attachments }: SendEmailParams) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Missing RESEND_API_KEY');
    if (!EMAIL_FROM) throw new Error('Missing EMAIL_FROM');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: EMAIL_FROM,
            to: toRecipientArray(to),
            subject,
            html,
            attachments: (attachments || []).map((attachment) => ({
                filename: attachment.filename,
                content: attachment.contentBase64,
                type: attachment.contentType
            }))
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Resend error: ${response.status} ${text}`);
    }
};

const sendWithSendGrid = async ({ to, subject, html, attachments }: SendEmailParams) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('Missing SENDGRID_API_KEY');
    if (!EMAIL_FROM) throw new Error('Missing EMAIL_FROM');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            personalizations: [{ to: toRecipientArray(to).map((email) => ({ email })) }],
            from: { email: EMAIL_FROM },
            subject,
            content: [{ type: 'text/html', value: html }],
            attachments: (attachments || []).map((attachment) => ({
                content: attachment.contentBase64,
                filename: attachment.filename,
                type: attachment.contentType,
                disposition: 'attachment'
            }))
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`SendGrid error: ${response.status} ${text}`);
    }
};

const sendWithSmtp = async ({ to, subject, html, attachments }: SendEmailParams) => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

    if (!host) throw new Error('Missing SMTP_HOST');
    if (!user) throw new Error('Missing SMTP_USER');
    if (!pass) throw new Error('Missing SMTP_PASS');
    if (!EMAIL_FROM) throw new Error('Missing EMAIL_FROM');

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    await transporter.sendMail({
        from: EMAIL_FROM,
        to: toRecipientArray(to).join(', '),
        subject,
        html,
        attachments: (attachments || []).map((attachment) => ({
            filename: attachment.filename,
            content: Buffer.from(attachment.contentBase64, 'base64'),
            contentType: attachment.contentType
        }))
    });
};

export const sendEmail = async (params: SendEmailParams) => {
    if (EMAIL_PROVIDER === 'console' || (!EMAIL_PROVIDER && !isProduction)) {
        console.log('[EMAIL CONSOLE MODE]');
        console.log('To:', params.to);
        console.log('Subject:', params.subject);
        console.log('Body:', params.html);
        if (params.attachments?.length) {
            console.log('Attachments:', params.attachments.map((a) => a.filename).join(', '));
        }
        return;
    }
    if (EMAIL_PROVIDER === 'resend') {
        await sendWithResend(params);
        return;
    }
    if (EMAIL_PROVIDER === 'sendgrid') {
        await sendWithSendGrid(params);
        return;
    }
    if (EMAIL_PROVIDER === 'smtp') {
        await sendWithSmtp(params);
        return;
    }
    throw new Error('EMAIL_PROVIDER is not configured. Use smtp, resend, sendgrid, or console (dev only).');
};

export const generateSixDigitCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export const hashVerificationCode = (email: string, code: string) =>
    crypto.createHash('sha256').update(`${email.toLowerCase().trim()}:${code}`).digest('hex');
