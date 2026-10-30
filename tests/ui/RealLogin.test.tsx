/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RealLogin } from '@/app/(ui)/components/portal/signin/RealLogin';
import { bodyOf, installFetch, jsonResponse, watchNavigation } from './helpers';

const SEND_URL = '/api/v1/auth/email-otp/send-verification-otp';
const VERIFY_URL = '/api/v1/auth/sign-in/email-otp';

let fetchCtl: ReturnType<typeof installFetch>;
let nav: ReturnType<typeof watchNavigation> | undefined;

beforeEach(() => {
  fetchCtl = installFetch();
});

afterEach(() => {
  nav?.restore();
  nav = undefined;
  fetchCtl.restore();
});

/** Sends a code for the given email and waits for the code step. */
async function reachCodeStep(user: ReturnType<typeof userEvent.setup>, email = 'amira.haddad@harborline-bank.example') {
  fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
  await user.type(screen.getByRole('textbox', { name: 'Work email' }), email);
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  await screen.findByRole('textbox', { name: 'Email code' });
}

describe('RealLogin email step', () => {
  it('asks for a work email before any code is sent', () => {
    render(<RealLogin />);
    expect(screen.getByRole('textbox', { name: 'Work email' })).toBeRequired();
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeEnabled();
  });

  it('requests a sign-in code for the lower-cased, trimmed address', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user, '  Amira.Haddad@Harborline-Bank.example ');

    expect(fetchCtl.fetchMock).toHaveBeenCalledWith(
      SEND_URL,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(bodyOf(fetchCtl.fetchMock)).toEqual({ email: 'amira.haddad@harborline-bank.example', type: 'sign-in' });
  });

  it('moves to the code step and shows the neutral confirmation message', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user);

    expect(screen.getByRole('status')).toHaveTextContent(
      'If this email is provisioned for an active workspace, a sign-in code is on its way.',
    );
    expect(screen.getByText('amira.haddad@harborline-bank.example', { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows an alert and stays on the email step when the code cannot be sent', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, { ok: false, status: 429 }));
    render(<RealLogin />);
    await user.type(screen.getByRole('textbox', { name: 'Work email' }), 'someone@example.org');
    await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a sign-in code. Check the address or try again later.',
    );
    expect(screen.getByRole('textbox', { name: 'Work email' })).toBeInTheDocument();
  });
});

describe('RealLogin code step', () => {
  it('keeps only digits and limits the code to six characters', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user);
    const code = screen.getByRole('textbox', { name: 'Email code' });

    await user.type(code, '12-a3 4567890');
    expect(code).toHaveValue('123456');
  });

  it('keeps verify disabled until six digits are entered', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user);
    const verify = screen.getByRole('button', { name: 'Verify and sign in' });
    expect(verify).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Email code' }), '12345');
    expect(verify).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Email code' }), '6');
    expect(verify).toBeEnabled();
  });

  it('verifies the code and starts the navigation into the portal', async () => {
    const user = userEvent.setup();
    nav = watchNavigation();
    render(<RealLogin />);
    await reachCodeStep(user);
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await user.type(screen.getByRole('textbox', { name: 'Email code' }), '482915');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => expect(nav!.attempted()).toBe(true));
    expect(fetchCtl.fetchMock).toHaveBeenLastCalledWith(
      VERIFY_URL,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(bodyOf(fetchCtl.fetchMock, 1)).toEqual({ email: 'amira.haddad@harborline-bank.example', otp: '482915' });
  });

  it('shows the rejection message and stays put when the code is wrong', async () => {
    const user = userEvent.setup();
    nav = watchNavigation();
    render(<RealLogin />);
    await reachCodeStep(user);
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid' }, { ok: false, status: 400 }));
    await user.type(screen.getByRole('textbox', { name: 'Email code' }), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code could not be verified. Check it and try again.');
    expect(nav.attempted()).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Email code' })).toBeInTheDocument();
  });

  it('returns to the email step with the Use a different email link', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user);
    await user.click(screen.getByRole('button', { name: 'Use a different email' }));

    expect(screen.getByRole('textbox', { name: 'Work email' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Email code' })).not.toBeInTheDocument();
  });

  it('resends a fresh code and starts a 30 second cooldown on the resend button', async () => {
    const user = userEvent.setup();
    render(<RealLogin />);
    await reachCodeStep(user);
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await user.click(screen.getByRole('button', { name: 'Resend code' }));

    expect(await screen.findByText('A fresh sign-in code has been sent to your email.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code in 30s' })).toBeDisabled();
    expect(fetchCtl.fetchMock).toHaveBeenLastCalledWith(SEND_URL, expect.objectContaining({ method: 'POST' }));
  });
});
