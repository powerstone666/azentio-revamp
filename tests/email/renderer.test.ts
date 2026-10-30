import { BRAND } from '@/app/api/(services)/email/brand';
import {
  renderEmailTemplate,
  renderInvitationEmail,
  renderNotificationEmail,
  renderSignInOtpEmail,
} from '@/app/api/(services)/email/renderer';

const ORIGIN = 'https://portal.example.test';
const LOGO_CID = `cid:${BRAND.logoCid}`;
const ALLOWED_EXTERNAL = ['https://fonts.googleapis.com/', 'mailto:'];

/** Mirrors Handlebars' escaping of `{{value}}` output, which applies inside attribute values too. */
function hbsEscape(value: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;', '=': '&#x3D;' };
  return value.replace(/[&<>"'`=]/g, (ch) => map[ch]);
}

/** Every href/src value in the rendered HTML. */
function linkTargets(html: string): string[] {
  return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
}

const renderers: Array<[string, () => { html: string; text: string; subject: string }]> = [
  ['sign-in OTP', () => renderSignInOtpEmail({ otp: '482913', email: 'ana@example.test', origin: ORIGIN })],
  ['invitation', () => renderInvitationEmail({ role: 'client_admin', orgName: 'Acme', inviteUrl: '/invite/abc', origin: ORIGIN })],
  ['notification', () => renderNotificationEmail({ subject: 'Update', message: 'Something changed.', actionUrl: '/portal', origin: ORIGIN })],
  ['general', () => renderEmailTemplate('general', { title: 'Hello', paragraphs: ['One'] }, { subject: 'Hello' }, ORIGIN)],
];

describe.each(renderers)('%s email', (_name, render) => {
  it('leaves no unrendered Handlebars expressions', () => {
    expect(render().html).not.toContain('{{');
    expect(render().text).not.toContain('{{');
  });

  it('makes every link and image absolute on the origin, except fonts, mailto and the logo cid', () => {
    const targets = linkTargets(render().html);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const allowed = target.startsWith(ORIGIN) || target === LOGO_CID
        || ALLOWED_EXTERNAL.some((prefix) => target.startsWith(prefix));
      expect(allowed).toBe(true);
    }
  });

  it('references the logo by cid and never by a remote URL', () => {
    const { html } = render();
    expect(html).toContain(`src="${LOGO_CID}"`);
    expect(html).not.toMatch(/src="https?:\/\/[^"]*logo/i);
  });

  it('uses only BRAND hex colours', () => {
    const allowed = new Set(Object.values(BRAND).filter((v) => /^#[0-9a-f]{6}$/i.test(v)).map((v) => v.toLowerCase()));
    const used = [...render().html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    for (const hex of used) expect(allowed.has(hex)).toBe(true);
  });

  it('never mentions the azentio.ai domain', () => {
    expect(render().html).not.toContain('azentio.ai');
    expect(render().text).not.toContain('azentio.ai');
  });

  it('does not double-escape entities', () => {
    const { html } = render();
    expect(html).not.toContain('&amp;rarr;');
    expect(html).not.toContain('&amp;amp;');
  });

  it('includes the current year in the footer', () => {
    expect(render().html).toContain(`${new Date().getFullYear()} Azentio Software Private Limited`);
  });

  it('loads the Poppins stylesheet from Google Fonts', () => {
    expect(render().html).toContain(`href="${hbsEscape(BRAND.fontsUrl)}"`);
  });
});

describe('sign-in OTP email', () => {
  it('shows the code in the HTML body, the preheader and the plain text', () => {
    const result = renderSignInOtpEmail({ otp: '482913', email: 'ana@example.test', origin: ORIGIN });
    expect(result.html).toContain('482913');
    expect(result.text).toContain('482913');
    expect(result.html).toContain('Your single-use sign-in code is 482913');
  });

  it('uses the sign-in subject and names the recipient', () => {
    const result = renderSignInOtpEmail({ otp: '111222', email: 'ana@example.test', origin: ORIGIN });
    expect(result.subject).toBe('Your Azentio sign-in code');
    expect(result.html).toContain('ana@example.test');
  });

  it('states the 5 minute expiry in the plain text', () => {
    expect(renderSignInOtpEmail({ otp: '111222', email: 'a@b.test', origin: ORIGIN }).text).toContain('5 minutes');
  });
});

describe('invitation email', () => {
  it('shows workspace, role, validity and the invite link', () => {
    const result = renderInvitationEmail({
      role: 'client_admin', orgName: 'Acme Pharma', inviteUrl: `${ORIGIN}/invite/tok`, expiresInDays: 3, origin: ORIGIN,
    });
    expect(result.html).toContain('Acme Pharma');
    expect(result.html).toContain('client admin');
    expect(result.html).toContain('3 days, single use');
    expect(result.html).toContain(`href="${ORIGIN}/invite/tok"`);
    expect(result.text).toContain(`Invitation Link: ${ORIGIN}/invite/tok`);
    expect(result.text).toContain('Workspace: Acme Pharma');
    expect(result.text).toContain('Role: client admin');
  });

  it('defaults to a 7 day validity', () => {
    const result = renderInvitationEmail({ role: 'employee', inviteUrl: '/invite/x', origin: ORIGIN });
    expect(result.html).toContain('7 days, single use');
    expect(result.text).toContain('Valid For: 7 days');
  });

  it.each([
    ['with an org name', { orgName: 'Acme' }, 'You are invited to join Acme on Azentio'],
    ['without an org name', {}, 'You are invited to an Azentio workspace'],
  ])('uses the subject %s', (_label, extra, subject) => {
    expect(renderInvitationEmail({ role: 'employee', inviteUrl: '/invite/x', origin: ORIGIN, ...extra }).subject).toBe(subject);
  });

  it('resolves a path inviteUrl against the origin in both HTML and text', () => {
    const result = renderInvitationEmail({ role: 'employee', inviteUrl: '/invite/tok', origin: ORIGIN });
    expect(result.html).toContain(`${ORIGIN}/invite/tok`);
    expect(result.text).toContain(`${ORIGIN}/invite/tok`);
  });
});

describe('notification email', () => {
  it('uses the subject as the default heading and the default badge and button label', () => {
    const result = renderNotificationEmail({ subject: 'Report ready', message: 'Done.', actionUrl: '/portal', origin: ORIGIN });
    expect(result.subject).toBe('Report ready');
    expect(result.html).toContain('Report ready');
    expect(result.html).toContain('Portal Update');
    expect(result.html).toContain('Open portal');
  });

  it('renders the custom heading, badge, label and details', () => {
    const result = renderNotificationEmail({
      subject: 'Report ready',
      heading: 'Quarterly report',
      badge: 'Insights',
      message: 'Open it now.',
      actionUrl: '/portal/reports/1',
      actionLabel: 'View report',
      details: { Owner: 'Ravi', Due: '2026-11-30' },
      origin: ORIGIN,
    });
    expect(result.html).toContain('Quarterly report');
    expect(result.html).toContain('Insights');
    expect(result.html).toContain('View report');
    expect(result.html).toContain('Owner');
    expect(result.html).toContain('2026-11-30');
  });

  it.each([
    ['/portal', `${ORIGIN}/portal`],
    ['/portal/client/shared-learning/abc?tab=new', `${ORIGIN}/portal/client/shared-learning/abc?tab=new`],
    ['https://other.example.test/x', 'https://other.example.test/x'],
  ])('turns actionUrl %s into %s', (input, expected) => {
    const result = renderNotificationEmail({ subject: 'S', message: 'M', actionUrl: input, origin: ORIGIN });
    expect(result.html).toContain(`href="${hbsEscape(expected)}"`);
    expect(result.text).toContain(`Review in Portal: ${expected}`);
  });

  it('uses the message as the preheader', () => {
    const result = renderNotificationEmail({ subject: 'S', message: 'Short preheader text', origin: ORIGIN });
    expect(result.html).toContain('Short preheader text');
  });
});

describe('HTML escaping of user-supplied text', () => {
  const payload = '<script>alert(1)</script>';

  it.each([
    ['org name in the invitation', () => renderInvitationEmail({ role: 'employee', orgName: payload, inviteUrl: '/i', origin: ORIGIN })],
    ['notification message', () => renderNotificationEmail({ subject: 'S', message: payload, origin: ORIGIN })],
    ['notification heading', () => renderNotificationEmail({ subject: payload, message: 'M', origin: ORIGIN })],
    ['sign-in email address', () => renderSignInOtpEmail({ otp: '1', email: payload, origin: ORIGIN })],
  ])('escapes markup in %s', (_label, render) => {
    const { html } = render();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes an ampersand once', () => {
    const { html } = renderInvitationEmail({ role: 'employee', orgName: 'Acme & Co', inviteUrl: '/i', origin: ORIGIN });
    expect(html).toContain('Acme &amp; Co');
    expect(html).not.toContain('&amp;amp;');
  });

  it('keeps the raw text in the plain-text version', () => {
    const { text } = renderInvitationEmail({ role: 'employee', orgName: 'Acme & Co', inviteUrl: '/i', origin: ORIGIN });
    expect(text).toContain('Workspace: Acme & Co');
  });
});

describe('origin handling', () => {
  it.each([
    ['a trailing slash', 'https://portal.example.test/'],
    ['a path', 'https://portal.example.test/some/path?x=1'],
  ])('normalises an origin with %s to the bare origin', (_label, origin) => {
    const { html } = renderSignInOtpEmail({ otp: '1', email: 'a@b.test', origin });
    expect(html).toContain(`href="${ORIGIN}/login"`);
    expect(html).not.toContain('/some/path');
  });

  it.each([
    ['an empty origin', ''],
    ['a missing origin', undefined],
    ['a non-URL origin', 'portal'],
  ])('throws for %s', (_label, origin) => {
    expect(() => renderSignInOtpEmail({ otp: '1', email: 'a@b.test', origin: origin as string })).toThrow();
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,hi'],
    ['ftp://files.example.test/x'],
  ])('refuses the actionUrl %s', (actionUrl) => {
    expect(() => renderNotificationEmail({ subject: 'S', message: 'M', actionUrl, origin: ORIGIN })).toThrow();
  });
});

describe('plain-text version', () => {
  it('honours a custom text field, trimmed', () => {
    const result = renderEmailTemplate('general', { title: 'Hi', paragraphs: ['Body'], text: '  Custom plain text.  ' }, { subject: 'Hi' }, ORIGIN);
    expect(result.text).toBe('Custom plain text.');
  });

  it('falls back to generated text when the custom text is blank', () => {
    const result = renderEmailTemplate('general', { title: 'Hi', paragraphs: ['Body'], text: '   ' }, { subject: 'Hi' }, ORIGIN);
    expect(result.text).toContain('Body');
  });

  it('contains no HTML tags', () => {
    expect(renderNotificationEmail({ subject: 'S', message: 'M', actionUrl: '/portal', origin: ORIGIN }).text).not.toMatch(/<[a-z][^>]*>/i);
  });

  it('returns the subject from the render result', () => {
    expect(renderEmailTemplate('general', { title: 'T' }, { subject: 'Exact subject' }, ORIGIN).subject).toBe('Exact subject');
  });
});
