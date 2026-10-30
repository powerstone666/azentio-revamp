/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RolePicker } from '@/app/(ui)/components/portal/onboarding/RolePicker';
import { bodyOf, deferred, installFetch, jsonResponse, watchNavigation } from './helpers';

const ONBOARDING_URL = '/api/v1/onboarding';
const WORKSPACES_URL = '/api/v1/workspaces';
const EMAIL = 'amira.haddad@harborline-bank.example';
const SUBMIT = 'Join the demo with this role';

let fetchCtl: ReturnType<typeof installFetch>;
let nav: ReturnType<typeof watchNavigation>;

beforeEach(() => {
  fetchCtl = installFetch();
  nav = watchNavigation();
});

afterEach(() => {
  nav.restore();
  fetchCtl.restore();
});

function roleRadio(label: string) {
  const heading = screen.getByRole('heading', { name: label, level: 3 });
  return within(heading.closest('label') as HTMLElement).getByRole('radio');
}

describe('RolePicker', () => {
  it('shows the signed-in email and both role groups', () => {
    render(<RolePicker email={EMAIL} />);
    expect(screen.getByText(EMAIL, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Client side', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Azentio side', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Client administrator', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product owner', level: 3 })).toBeInTheDocument();
  });

  it('allows exactly one role: choosing another role replaces the first', async () => {
    const user = userEvent.setup();
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    expect(roleRadio('Client member')).toBeChecked();

    await user.click(screen.getByRole('heading', { name: 'Product owner', level: 3 }));
    expect(roleRadio('Product owner')).toBeChecked();
    expect(roleRadio('Client member')).not.toBeChecked();
  });

  it('keeps the create button disabled until at least one role is chosen', async () => {
    const user = userEvent.setup();
    render(<RolePicker email={EMAIL} />);
    const submit = screen.getByRole('button', { name: SUBMIT });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('heading', { name: 'Azentio employee', level: 3 }));
    expect(submit).toBeEnabled();
  });

  it('creates the chosen roles and opens the portal when the person has one workspace', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { workspaces: [{ membership_id: 'mem-1', role: 'client_member' }] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(nav.attempted()).toBe(true));
    expect(fetchCtl.fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchCtl.fetchMock.mock.calls[0][0]).toBe(ONBOARDING_URL);
    expect(bodyOf(fetchCtl.fetchMock, 0)).toEqual({ roles: ['client_member'] });
    expect(fetchCtl.fetchMock.mock.calls[1][0]).toBe(WORKSPACES_URL);
    expect(bodyOf(fetchCtl.fetchMock, 1)).toEqual({ membership_id: 'mem-1' });
  });

  it('sends only the one chosen role', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { workspaces: [{ membership_id: 'a', role: 'x' }] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('heading', { name: 'Product owner', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(nav.attempted()).toBe(true));
    expect(bodyOf(fetchCtl.fetchMock, 0)).toEqual({ roles: ['product_owner'] });
  });

  it('sends the person to choose a workspace without auto-selecting when they have several', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { workspaces: [{ membership_id: 'a', role: 'x' }, { membership_id: 'b', role: 'y' }] } }),
    );
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(nav.attempted()).toBe(true));
    expect(fetchCtl.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the API error message when role creation fails', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Demo roles are full' }, { ok: false, status: 409 }));
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Demo roles are full');
    expect(nav.attempted()).toBe(false);
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
  });

  it('falls back to a generic message when the failed response has no readable body', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    });
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not set up your demo workspace.');
  });

  it('explains what to do when the workspace cannot be opened after roles were created', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { workspaces: [{ membership_id: 'mem-1', role: 'x' }] } }))
      .mockResolvedValueOnce(jsonResponse({ error: 'nope' }, { ok: false, status: 500 }));
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your workspace was created but could not be opened. Choose it on the next page.',
    );
    expect(nav.attempted()).toBe(false);
  });

  it('shows Setting up while the request is in flight and disables the button', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchCtl.fetchMock.mockReturnValueOnce(pending.promise);
    render(<RolePicker email={EMAIL} />);
    await user.click(screen.getByRole('heading', { name: 'Client member', level: 3 }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByRole('button', { name: 'Setting up…' })).toBeDisabled();
    pending.resolve(jsonResponse({ data: { workspaces: [] } }));
    await waitFor(() => expect(nav.attempted()).toBe(true));
  });

  it('has no way to add more roles or jump to other workspaces', () => {
    render(<RolePicker email={EMAIL} />);
    expect(screen.queryByRole('button', { name: 'Go to my workspaces' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Add roles/i)).not.toBeInTheDocument();
  });

  it('offers a sign-out escape hatch next to the create button', () => {
    render(<RolePicker email={EMAIL} />);
    expect(screen.getByRole('button', { name: 'Not now, sign out' })).toBeEnabled();
  });
});
