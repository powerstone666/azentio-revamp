import 'server-only';

import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import nodemailer from 'nodemailer';
import pool from '@/app/api/(db)/client';
import { queryOne } from '@/app/api/(db)/client';

const smtpTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

async function isProvisioned(email: string) {
  const result = await queryOne<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       JOIN organizations o ON o.id = m.org_id AND o.status = 'active'
       WHERE lower(u.email) = lower($1)
         AND u.disabled_at IS NULL
         AND u.verified_at IS NOT NULL
     ) AS allowed`,
    [email],
  );
  return result?.allowed === true;
}

export const auth = betterAuth({
  appName: 'Azentio Collaboration Portal',
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  basePath: '/api/v1/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  database: { db: pool, type: 'postgres', transaction: true },
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean),
  rateLimit: { enabled: true, window: 60, max: 5 },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await isProvisioned(user.email))) return false;
          return { data: { ...user, email: user.email.toLowerCase() } };
        },
      },
      update: {
        before: async (user) => {
          if (user.email && !(await isProvisioned(user.email))) return false;
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: 'hashed',
      disableSignUp: false,
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Unknown and unapproved addresses receive the same generic response,
        // but no mail. Account creation is independently blocked by the hook.
        if (type !== 'sign-in' || !(await isProvisioned(email))) return;
        if (!smtpTransport || !process.env.SMTP_FROM) {
          throw new Error('Email delivery is not configured. Set SMTP_HOST and SMTP_FROM.');
        }
        await smtpTransport.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: 'Your Azentio sign-in code',
          text: `Your sign-in code is ${otp}. It expires in five minutes. If you did not request it, you can ignore this email.`,
        });
      },
    }),
  ],
});
