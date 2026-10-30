import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { BRAND, absoluteUrl } from './brand';

export interface RenderResult {
  html: string;
  text: string;
  subject: string;
}

type TemplateName = 'invitation' | 'notification' | 'general' | 'signin-otp';

const TEMPLATE_DIR = path.join(process.cwd(), 'app', 'api', '(services)', 'email', 'templates');

// Fields that hold links. They may be given as paths; every one is resolved against the app origin.
const URL_FIELDS = ['actionUrl', 'inviteUrl'] as const;

const handlebars = Handlebars.create();

// {{url "/path"}} -> absolute URL on the app origin. Used for the logo, footer links and call-to-action buttons.
handlebars.registerHelper('url', function (this: unknown, pathOrUrl: string, options: Handlebars.HelperOptions) {
  return absoluteUrl(String(pathOrUrl), String(options.data.root.origin));
});

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

function getCompiledTemplate(name: string): Handlebars.TemplateDelegate {
  const cached = templateCache.get(name);
  if (cached) return cached;
  // Single source of truth: the .hbs file. A missing file is a deployment error, so fail loudly instead of sending an off-brand email.
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.hbs`), 'utf-8');
  const compiled = handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

export function renderEmailTemplate(
  templateName: TemplateName,
  data: Record<string, unknown>,
  meta: { subject: string; preheader?: string },
  origin: string,
): RenderResult {
  const normalised: Record<string, unknown> = { ...data };
  for (const field of URL_FIELDS) {
    if (typeof normalised[field] === 'string' && normalised[field]) {
      normalised[field] = absoluteUrl(normalised[field] as string, origin);
    }
  }

  const currentYear = new Date().getFullYear();
  const context = {
    ...normalised,
    brand: BRAND,
    origin: new URL(origin).origin,
    currentYear,
    subject: meta.subject,
    preheader: meta.preheader,
  };

  const bodyHtml = getCompiledTemplate(templateName)(context);
  const html = getCompiledTemplate('layout')({ ...context, body: bodyHtml });

  const text = (typeof data.text === 'string' && data.text.trim())
    ? data.text.trim()
    : generatePlainText(templateName, normalised, meta);

  return { html, text, subject: meta.subject };
}

function generatePlainText(
  templateName: string,
  data: Record<string, unknown>,
  meta: { subject: string },
): string {
  const year = new Date().getFullYear();
  const lines: string[] = [`=== AZENTIO | ${meta.subject.toUpperCase()} ===\n`];

  if (templateName === 'signin-otp') {
    lines.push(`Your single-use Azentio sign-in code is: ${data.otp}\n`);
    lines.push(`This code expires in 5 minutes and can only be used once.`);
    lines.push(`If you did not request this code, you can safely ignore this email.`);
  } else if (templateName === 'invitation') {
    lines.push(`You have been invited to join an Azentio workspace on the Azentio Intelligence & Collaboration Platform.`);
    if (data.orgName) lines.push(`Workspace: ${data.orgName}`);
    if (data.role) lines.push(`Role: ${data.role}`);
    lines.push(`Invitation Link: ${data.inviteUrl}`);
    lines.push(`Valid For: ${data.expiresInDays ?? 7} days (single-use link).`);
    lines.push(`\nNote: Joining an Azentio workspace does not consent to share proprietary client observations.`);
  } else if (templateName === 'notification') {
    if (data.heading) lines.push(String(data.heading));
    if (data.message) lines.push(String(data.message));
    if (data.actionUrl) lines.push(`\nReview in Portal: ${data.actionUrl}`);
  } else {
    if (data.title) lines.push(String(data.title));
    if (data.subtitle) lines.push(String(data.subtitle));
    if (Array.isArray(data.paragraphs)) {
      lines.push(...data.paragraphs.map(String));
    }
    if (data.actionUrl) lines.push(`\nAction Link: ${data.actionUrl}`);
  }

  lines.push(`\n---\n© ${year} Azentio Software Private Limited. All rights reserved.`);
  return lines.join('\n');
}

/** Workspace invitation email. */
export function renderInvitationEmail(args: {
  role: string;
  orgName?: string;
  inviteUrl: string;
  expiresInDays?: number;
  heading?: string;
  origin: string;
}): RenderResult {
  const roleDisplay = args.role.replace(/_/g, ' ');
  const subject = args.orgName
    ? `You are invited to join ${args.orgName} on Azentio`
    : 'You are invited to an Azentio workspace';

  return renderEmailTemplate(
    'invitation',
    {
      role: roleDisplay,
      orgName: args.orgName,
      inviteUrl: args.inviteUrl,
      expiresInDays: args.expiresInDays ?? 7,
      heading: args.heading ?? 'You are invited to an Azentio workspace',
    },
    {
      subject,
      preheader: `You have been invited to join ${args.orgName ?? 'Azentio'} as ${roleDisplay}. Review your single-use invitation.`,
    },
    args.origin,
  );
}

/** Activity notification email. `actionUrl` may be a path; it is resolved against `origin`. */
export function renderNotificationEmail(args: {
  subject: string;
  message: string;
  heading?: string;
  badge?: string;
  actionUrl?: string;
  actionLabel?: string;
  details?: Record<string, string>;
  origin: string;
}): RenderResult {
  return renderEmailTemplate(
    'notification',
    {
      heading: args.heading ?? args.subject,
      message: args.message,
      badge: args.badge ?? 'Portal Update',
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel ?? 'Open portal',
      details: args.details,
    },
    {
      subject: args.subject,
      preheader: args.message.slice(0, 100),
    },
    args.origin,
  );
}

/** Sign-in one-time-code email. */
export function renderSignInOtpEmail(args: {
  otp: string;
  email: string;
  origin: string;
}): RenderResult {
  return renderEmailTemplate(
    'signin-otp',
    {
      otp: args.otp,
      email: args.email,
    },
    {
      subject: 'Your Azentio sign-in code',
      preheader: `Your single-use sign-in code is ${args.otp}. It expires in 5 minutes.`,
    },
    args.origin,
  );
}
