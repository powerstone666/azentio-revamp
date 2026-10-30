/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignOutButton } from '@/app/(ui)/components/portal/onboarding/SignOutButton';
import { deferred, installFetch, jsonResponse, watchNavigation } from './helpers';

const SIGN_OUT_URL = '/api/v1/auth/sign-out';

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

describe('SignOutButton', () => {
  it('renders the default Sign out label', () => {
    render(<SignOutButton />);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });

  it('uses the label it is given', () => {
    render(<SignOutButton variant="link" label="Not now, sign out" />);
    expect(screen.getByRole('button', { name: 'Not now, sign out' })).toBeInTheDocument();
  });

  it('posts a JSON body so the auth server accepts the sign-out request', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(nav.attempted()).toBe(true));
    expect(fetchCtl.fetchMock).toHaveBeenCalledWith(SIGN_OUT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: 'include',
    });
  });

  it('navigates away only after the sign-out request succeeds', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 415 }));
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(nav.attempted()).toBe(false);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });

  it('shows the same error and stays put when the network request fails', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(nav.attempted()).toBe(false);
  });

  it('disables the button and shows Signing out while the request is pending', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchCtl.fetchMock.mockReturnValueOnce(pending.promise);
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Signing out…' })).toBeDisabled();
    pending.resolve(jsonResponse({}));
    await waitFor(() => expect(nav.attempted()).toBe(true));
  });
});
