'use client';

import { useState } from 'react';
import { CheckField, EMAIL_RE, TextAreaField, TextField, SubmitButton } from './fields';
import NoBackendNotice from './NoBackendNotice';

const SKILLS = ['Data science', 'Engineering', 'Design', 'Domain expertise'];
const TEAM = ['Solo', 'Team'];

const EMPTY = { name: '', email: '', org: '', role: '', team: '', idea: '', consent: false };
type Values = typeof EMPTY;
type Errors = Partial<Record<keyof Values | 'skills', string>>;

function validate(v: Values, skills: string[]): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Enter your full name.';
  if (!v.email.trim()) e.email = 'Enter your work email.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address, like name@company.com.';
  if (!v.org.trim()) e.org = 'Enter your organisation.';
  if (!v.role.trim()) e.role = 'Enter your role.';
  if (!v.team) e.team = 'Tell us if you are joining solo or as a team.';
  if (skills.length === 0) e.skills = 'Pick at least one skill.';
  if (v.idea.length > 800) e.idea = 'Keep this under 800 characters.';
  if (!v.consent) e.consent = 'Please tick to acknowledge the privacy notice.';
  return e;
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-az-error">
      {message}
    </p>
  );
}

export default function HackathonForm() {
  const [v, setV] = useState<Values>(EMPTY);
  const [skills, setSkills] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const set = <K extends keyof Values>(k: K) => (val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const toggle = (s: string) => {
    setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
    if (errors.skills) setErrors((p) => ({ ...p, skills: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(v, skills);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setDone(true);
      return;
    }
    const first = Object.keys(found)[0];
    const target = first === 'skills' ? 'skill-data' : first === 'team' ? 'team-solo' : first;
    document.getElementById(target)?.focus();
  };

  if (done) {
    return (
      <NoBackendNotice
        onReset={() => {
          setV(EMPTY);
          setSkills([]);
          setErrors({});
          setDone(false);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-line bg-surface p-6 shadow-soft md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Your details</h2>
      <p className="mt-1 text-sm text-muted">Fields marked * are required.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <TextField id="name" label="Full name" value={v.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
        <TextField id="email" label="Work email" type="email" value={v.email} onChange={set('email')} error={errors.email} required autoComplete="email" placeholder="name@company.com" />
        <TextField id="org" label="Organisation" value={v.org} onChange={set('org')} error={errors.org} required autoComplete="organization" />
        <TextField id="role" label="Role" value={v.role} onChange={set('role')} error={errors.role} required autoComplete="organization-title" />

        <div className="sm:col-span-2">
          <fieldset aria-describedby={errors.team ? 'team-error' : undefined}>
            <legend className="mb-2 text-sm font-medium text-ink">
              Team or solo <span aria-hidden className="text-az-error">*</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {TEAM.map((t, i) => {
                const on = v.team === t;
                return (
                  <label
                    key={t}
                    className={`focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-strong flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${on ? 'border-accent-strong bg-accent text-on-accent' : 'border-line bg-canvas text-muted hover:border-faint'}`}
                  >
                    <input
                      id={i === 0 ? 'team-solo' : undefined}
                      type="radio"
                      name="team"
                      value={t}
                      checked={on}
                      onChange={() => set('team')(t)}
                      className="sr-only"
                    />
                    {t}
                  </label>
                );
              })}
            </div>
            <ErrorText id="team-error" message={errors.team} />
          </fieldset>
        </div>

        <div className="sm:col-span-2">
          <fieldset aria-describedby={errors.skills ? 'skills-error' : undefined}>
            <legend className="mb-2 text-sm font-medium text-ink">
              Skills you bring <span aria-hidden className="text-az-error">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s, i) => {
                const on = skills.includes(s);
                return (
                  <label
                    key={s}
                    className={`focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-strong flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${on ? 'border-accent-strong bg-accent text-on-accent' : 'border-line bg-canvas text-muted hover:border-faint'}`}
                  >
                    <input
                      id={i === 0 ? 'skill-data' : undefined}
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggle(s)}
                    />
                    {s}
                  </label>
                );
              })}
            </div>
            <ErrorText id="skills-error" message={errors.skills} />
          </fieldset>
        </div>

        <div className="sm:col-span-2">
          <TextAreaField id="idea" label="What would you like to build?" value={v.idea} onChange={set('idea')} error={errors.idea} maxLength={800} hint="A sentence or two is plenty. Do not include confidential or customer data." />
        </div>
        <div className="sm:col-span-2">
          <CheckField id="consent" checked={v.consent} onChange={set('consent')} error={errors.consent}>
            I acknowledge the privacy notice and agree to be contacted about the hackathon.
          </CheckField>
        </div>
      </div>
      <div className="mt-7">
        <SubmitButton>Register interest</SubmitButton>
      </div>
    </form>
  );
}
