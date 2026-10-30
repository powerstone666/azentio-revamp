import 'server-only';

import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import pool from '@/app/api/(db)/client';
import { queryOne } from '@/app/api/(db)/client';
import { getSmtpTransport } from '@/app/api/(services)/email/smtp';
import { renderSignInOtpEmail } from '@/app/api/(services)/email/renderer';
import { logoAttachment } from '@/app/api/(services)/email/brand';
import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';

const authAllowedHosts = [
  process.env.VERCEL_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  '*.vercel.app',
  ...(process.env.BETTER_AUTH_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim()),
  ...(process.env.NODE_ENV === 'development' ? ['localhost:3000', '127.0.0.1:3000'] : []),
].filter((host): host is string => Boolean(host));

async function isProvisionedOrInvited(email: string) {
  // Demo onboarding: any real, verifiable address may enter a private synthetic sandbox.
  // Reserved synthetic addresses (*.invalid) are never allowed.
  if (isDemoOnboardingEnabled()) return !email.toLowerCase().endsWith('.invalid');
  const result = await queryOne<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       JOIN organizations o ON o.id = m.org_id AND o.status = 'active'
       WHERE lower(u.email) = lower($1)
         AND u.disabled_at IS NULL
         AND u.verified_at IS NOT NULL
         AND (
           (m.role = 'employee' AND o.type = 'azentio' AND lower(u.email) LIKE '%@azentio.com')
           OR (m.role IN ('client_member', 'client_admin') AND o.type = 'client')
         )
     ) AS allowed`,
    [email],
  );
  if (result?.allowed === true) return true;
  const invitation = await queryOne<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM invitations i
       JOIN organizations o ON o.id = i.org_id AND o.type = 'client' AND o.status = 'active'
       WHERE lower(i.email) = lower($1) AND i.proposed_role IN ('client_member', 'client_admin')
         AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
     ) AS allowed`,
    [email],
  );
  return invitation?.allowed === true;
}

export const auth = betterAuth({
  appName: 'Azentio Collaboration Portal',
  // Resolve the request's origin, but only for known Vercel/local/custom hosts.
  // Dynamic base URLs are needed for branch previews and custom production domains.
  baseURL: { allowedHosts: authAllowedHosts },
  basePath: '/api/v1/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  // Better Auth accepts a node-postgres Pool directly and builds its Kysely dialect.
  // Wrapping the Pool in `{ db, type }` incorrectly tells the adapter that Pool is Kysely.
  database: pool,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await isProvisionedOrInvited(user.email))) return false;
          return { data: { ...user, email: user.email.toLowerCase() } };
        },
      },
      update: {
        before: async (user) => {
          if (user.email && !(await isProvisionedOrInvited(user.email))) return false;
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
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        // Unknown and unapproved addresses receive the same generic response,
        // but no mail. Account creation is independently blocked by the hook.
        if (type !== 'sign-in' || !(await isProvisionedOrInvited(email))) return;
        const smtpTransport = getSmtpTransport();
        if (!smtpTransport || !process.env.SMTP_FROM) {
          throw new Error('Email delivery is not configured. Set Gmail SMTP credentials and a Google App Password in SMTP_PASS.');
        }

        // Links in the email use the origin of the request that asked for the code.
        const requestUrl = ctx?.request?.url ?? ctx?.context.baseURL;
        if (!requestUrl) throw new Error('Cannot determine the application origin for the sign-in email.');
        const rendered = renderSignInOtpEmail({ otp, email, origin: new URL(requestUrl).origin });
        await smtpTransport.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          attachments: [logoAttachment()],
        });
      },
    }),
  ],
});
