/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgContinueButton } from '@/app/(ui)/components/portal/signin/OrgContinueButton';
import { bodyOf, deferred, installFetch, jsonResponse, watchNavigation } from './helpers';

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

describe('OrgContinueButton', () => {
  it('offers Select workspace by default', () => {
    render(<OrgContinueButton membershipId="m-1" />);
    expect(screen.getByRole('button', { name: 'Select workspace' })).toBeEnabled();
  });

  it('offers Continue for the workspace that is already active', () => {
    render(<OrgContinueButton membershipId="m-1" active />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('selects the workspace by membership id, then navigates away from the page', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<OrgContinueButton membershipId="mem-42" />);
    await user.click(screen.getByRole('button', { name: 'Select workspace' }));

    await waitFor(() => expect(nav.attempted()).toBe(true));
    expect(fetchCtl.fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(bodyOf(fetchCtl.fetchMock)).toEqual({ membership_id: 'mem-42' });
  });

  it('shows Selecting and disables the button while the request is in flight', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchCtl.fetchMock.mockReturnValueOnce(pending.promise);
    render(<OrgContinueButton membershipId="mem-1" />);
    await user.click(screen.getByRole('button', { name: 'Select workspace' }));

    expect(await screen.findByRole('button', { name: 'Selecting…' })).toBeDisabled();
    pending.resolve(jsonResponse({ ok: true }));
    await waitFor(() => expect(nav.attempted()).toBe(true));
  });

  it('explains when the workspace is no longer available and re-enables the button', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'gone' }, { ok: false, status: 403 }));
    render(<OrgContinueButton membershipId="mem-1" />);
    await user.click(screen.getByRole('button', { name: 'Select workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This workspace is no longer available to your account.');
    expect(nav.attempted()).toBe(false);
    expect(screen.getByRole('button', { name: 'Select workspace' })).toBeEnabled();
  });

  it('shows the network error message when the request fails outright', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockRejectedValueOnce(new Error('Network down'));
    render(<OrgContinueButton membershipId="mem-1" />);
    await user.click(screen.getByRole('button', { name: 'Select workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(nav.attempted()).toBe(false);
  });
});
