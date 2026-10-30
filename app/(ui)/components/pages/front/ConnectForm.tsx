'use client';

import { useState } from 'react';
import { CheckField, EMAIL_RE, SelectField, SubmitButton, TextAreaField, TextField } from './fields';
import NoBackendNotice from './NoBackendNotice';

const COUNTRIES = [
  'Bahrain', 'Bangladesh', 'Egypt', 'India', 'Indonesia', 'Jordan', 'Kenya', 'Kuwait', 'Malaysia', 'Nigeria', 'Oman', 'Pakistan',
  'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Africa', 'Sri Lanka', 'United Arab Emirates', 'United Kingdom', 'United States', 'Other',
];
const ENQUIRY = ['Request a demo', 'Sales', 'Support', 'Partnership'];

const EMPTY = { first: '', last: '', email: '', phone: '', title: '', company: '', country: '', enquiry: '', comments: '', consent: false };
type Values = typeof EMPTY;
type Errors = Partial<Record<keyof Values, string>>;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.first.trim()) e.first = 'Enter your first name.';
  if (!v.last.trim()) e.last = 'Enter your last name.';
  if (!v.email.trim()) e.email = 'Enter your business email.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address, like name@company.com.';
  if (v.phone.trim() && !/^[+\d][\d\s().-]{6,}$/.test(v.phone.trim())) e.phone = 'Enter a valid phone number, or leave it blank.';
  if (!v.company.trim()) e.company = 'Enter your company.';
  if (!v.country) e.country = 'Choose your country.';
  if (!v.enquiry) e.enquiry = 'Choose what your enquiry is about.';
  if (v.comments.length > 1000) e.comments = 'Keep comments under 1,000 characters.';
  if (!v.consent) e.consent = 'Please tick to acknowledge the privacy notice.';
  return e;
}

export default function ConnectForm() {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const set = <K extends keyof Values>(k: K) => (val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length === 0) setDone(true);
    else document.getElementById(Object.keys(found)[0])?.focus();
  };

  if (done) return <NoBackendNotice onReset={() => { setV(EMPTY); setDone(false); }} />;

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-line bg-surface p-6 shadow-soft md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Your details</h2>
      <p className="mt-1 text-sm text-muted">Fields marked * are required.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <TextField id="first" label="First name" value={v.first} onChange={set('first')} error={errors.first} required autoComplete="given-name" />
        <TextField id="last" label="Last name" value={v.last} onChange={set('last')} error={errors.last} required autoComplete="family-name" />
        <div className="sm:col-span-2">
          <TextField id="email" label="Business email" type="email" value={v.email} onChange={set('email')} error={errors.email} required autoComplete="email" placeholder="name@company.com" />
        </div>
        <TextField id="phone" label="Phone number" type="tel" value={v.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" hint="Include your country code, for example +971." />
        <TextField id="title" label="Job title" value={v.title} onChange={set('title')} autoComplete="organization-title" />
        <TextField id="company" label="Company" value={v.company} onChange={set('company')} error={errors.company} required autoComplete="organization" />
        <SelectField id="country" label="Country" value={v.country} onChange={set('country')} error={errors.country} options={COUNTRIES} required />
        <div className="sm:col-span-2">
          <SelectField id="enquiry" label="Enquiry type" value={v.enquiry} onChange={set('enquiry')} error={errors.enquiry} options={ENQUIRY} required />
        </div>
        <div className="sm:col-span-2">
          <TextAreaField id="comments" label="Comments" value={v.comments} onChange={set('comments')} error={errors.comments} maxLength={1000} hint="Please do not include confidential or customer data." />
        </div>
        <div className="sm:col-span-2">
          <CheckField id="consent" checked={v.consent} onChange={set('consent')} error={errors.consent}>
            I acknowledge the privacy notice
          </CheckField>
        </div>
      </div>
      <div className="mt-7">
        <SubmitButton>Submit enquiry</SubmitButton>
      </div>
    </form>
  );
}
