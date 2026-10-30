'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface GrantRow {
  id: string; role: string; offering_id: string | null; org_id: string | null; org_name: string | null;
  display_name: string; email: string; granted_by_name: string; status: string; expires_at: string | null;
}
export interface EligibleEmployee { id: string; display_name: string; email: string; org_id: string; org_name: string }
export interface AdminOrgOption { id: string; name: string; type: string }
const field = 'rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export default function RoleGrantManager({ grants, employees, organizations }: { grants: GrantRow[]; employees: EligibleEmployee[]; organizations: AdminOrgOption[] }) {
  const router = useRouter();
  const [role, setRole] = useState('learning_moderator');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const azentioOrgs = organizations.filter((org) => org.type === 'azentio');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const expiresValue = String(form.get('expires_at') ?? '');
    const payload = {
      user_id: form.get('user_id'),
      role,
      org_id: role === 'portal_admin' || form.get('org_id') === 'platform' ? null : form.get('org_id'),
      offering_id: role === 'product_owner' ? form.get('offering_id') : null,
      expires_at: expiresValue ? new Date(expiresValue).toISOString() : null,
    };
    if (await send('/api/v1/admin/role-grants', 'POST', payload)) formElement.reset();
  }

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
      setMessage('Role grants updated.'); router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The request could not be completed.');
      return false;
    } finally { setBusy(false); }
  }

  const roleLabel = (value: string) => value.replaceAll('_', ' ');
  return <div className="space-y-6">
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-az-grey-bg bg-white p-5 md:grid-cols-5">
      <label className="text-sm font-medium text-az-navy">Employee<select name="user_id" required className={`${field} mt-1.5 w-full`}>{employees.map((employee) => <option key={`${employee.id}:${employee.org_id}`} value={employee.id}>{employee.display_name} · {employee.email} · {employee.org_name}</option>)}</select></label>
      <label className="text-sm font-medium text-az-navy">Grant<select name="role" value={role} onChange={(event) => setRole(event.target.value)} className={`${field} mt-1.5 w-full`}><option value="learning_moderator">Learning moderator</option><option value="content_publisher">Content publisher</option><option value="product_owner">Product owner</option><option value="portal_admin">Platform administrator</option></select></label>
      <label className="text-sm font-medium text-az-navy">Scope<select name="org_id" className={`${field} mt-1.5 w-full`} disabled={role === 'portal_admin'}><option value="platform">Platform wide</option>{azentioOrgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
      {role === 'product_owner' ? <label className="text-sm font-medium text-az-navy">Offering<select name="offering_id" required className={`${field} mt-1.5 w-full`}><option value="FAI">FAI</option><option value="Lending">Lending</option><option value="Digital">Digital</option><option value="AMLOCK">AMLOCK</option><option value="Factoring">Factoring</option><option value="Insurance">Insurance</option><option value="Orion">Orion</option></select></label> : <input type="hidden" name="offering_id" value="" />}
      <label className="text-sm font-medium text-az-navy">Expires at (optional)<input name="expires_at" type="datetime-local" className={`${field} mt-1.5 w-full`} /></label>
      <div className="md:col-span-5"><p className="mb-3 text-xs text-az-text-muted">Only verified employees are eligible. Portal administrator grants are platform-wide and self-grants are denied.</p><button disabled={busy || employees.length === 0} className="rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy disabled:opacity-50">Grant role</button>{message && <p role="status" className="mt-3 text-sm text-az-text">{message}</p>}</div>
    </form>
    <div className="overflow-x-auto rounded-2xl border border-az-grey-bg bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-az-grey-bg text-xs uppercase tracking-wide text-az-text-muted"><tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Grant</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Granted by</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{grants.map((grant) => <tr key={grant.id} className="border-b border-az-grey-bg last:border-0"><td className="px-4 py-3"><span className="font-semibold text-az-navy">{grant.display_name}</span><span className="mt-0.5 block text-xs text-az-text-muted">{grant.email}</span></td><td className="px-4 py-3 capitalize">{roleLabel(grant.role)}{grant.offering_id ? ` · ${grant.offering_id}` : ''}</td><td className="px-4 py-3">{grant.org_name ?? 'Platform wide'}</td><td className="px-4 py-3">{grant.granted_by_name}</td><td className="px-4 py-3 capitalize">{grant.status}{grant.expires_at ? ` · ${new Date(grant.expires_at).toLocaleDateString()}` : ''}</td><td className="px-4 py-3">{grant.status === 'active' && <button type="button" disabled={busy} onClick={() => void send(`/api/v1/admin/role-grants/${grant.id}`, 'DELETE')} className="font-semibold text-red-800 underline disabled:opacity-50">Revoke</button>}</td></tr>)}</tbody></table></div>
  </div>;
}
