import { redirect } from 'next/navigation';

/**
 * /portal → redirects to role-appropriate dashboard or workspace selection.
 * Actual authorization happens in the target page via the DAL.
 */
export default function PortalIndexPage() {
  // Placeholder: once auth is wired (M1), resolve session and redirect
  // to /portal/employee, /portal/client, /workspace/select, etc.
  redirect('/login');
}