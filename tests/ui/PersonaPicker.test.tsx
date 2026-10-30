/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonaPicker from '@/app/(ui)/components/portal/PersonaPicker';
import { ACCESS } from '@/app/(config)/personas';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
}));

const EMAIL_LABEL = 'Work email';

function cardFor(name: string) {
  return screen.getByRole('heading', { name, level: 5 }).closest('li') as HTMLElement;
}

function mailboxValue() {
  return (screen.getByRole('textbox', { name: EMAIL_LABEL }) as HTMLInputElement).value;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
});

describe('PersonaPicker', () => {
  it('groups the demo personas under their headings', () => {
    render(<PersonaPicker />);
    expect(screen.getByRole('heading', { name: 'Demo personas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Azentio staff', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Client users', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edge cases', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dana Whitfield', level: 5 })).toBeInTheDocument();
  });

  it('shows a Can list and a Cannot list on each persona card', () => {
    render(<PersonaPicker />);
    const card = within(cardFor('Dana Whitfield'));
    expect(card.getByText('Can')).toBeInTheDocument();
    expect(card.getByText('Cannot')).toBeInTheDocument();
    expect(card.getByText('Employee dashboard and Playground')).toBeInTheDocument();
    expect(card.getByText('See any client’s private content')).toBeInTheDocument();
  });

  it('labels a denied persona card with the denial status', () => {
    render(<PersonaPicker />);
    expect(within(cardFor('Omar Rahim')).getByText('Real sign-in would deny')).toBeInTheDocument();
    expect(within(cardFor('Dana Whitfield')).getByText('Limited access')).toBeInTheDocument();
  });

  it('sorts the full-access admin first within the staff group', () => {
    render(<PersonaPicker />);
    const staffSection = screen.getByRole('heading', { name: 'Azentio staff', level: 4 }).closest('section') as HTMLElement;
    const names = within(staffSection).getAllByRole('heading', { level: 5 }).map((h) => h.textContent);
    expect(names[0]).toBe('Sunita Varghese');
  });

  it('signs an allowed persona in and sends them to their destination', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.click(within(cardFor('Dana Whitfield')).getByRole('button', { name: 'Sign in as Dana →' }));

    expect(mockPush).toHaveBeenCalledWith('/portal/employee');
    expect(document.cookie).toContain('azentio_mock_persona=dana.whitfield%40azentio.com');
  });

  it('sends a client persona to the client portal', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.click(within(cardFor('Amira Haddad')).getByRole('button', { name: 'Sign in as Amira →' }));
    expect(mockPush).toHaveBeenCalledWith('/portal/client');
  });

  it('sends the multi-organisation persona to the workspace selector', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.click(within(cardFor('Priya Natarajan')).getByRole('button', { name: 'Sign in as Priya →' }));
    expect(mockPush).toHaveBeenCalledWith('/workspace/select');
  });

  it('does not sign in a denied persona and shows the denial reason instead', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.click(within(cardFor('Omar Rahim')).getByRole('button', { name: 'Try signing in as Omar' }));

    const input = screen.getByRole('textbox', { name: EMAIL_LABEL });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(ACCESS['omar.rahim@sandune-finance.example'].summary);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mailboxValue()).toBe('omar.rahim@sandune-finance.example');
  });

  it('signs in when a known work email is typed and submitted', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.type(screen.getByRole('textbox', { name: EMAIL_LABEL }), 'sunita.varghese@azentio.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockPush).toHaveBeenCalledWith('/portal/admin');
  });

  it('normalises the typed email before matching a persona', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.type(screen.getByRole('textbox', { name: EMAIL_LABEL }), '  Tomas.Reiniger@AZENTIO.com ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockPush).toHaveBeenCalledWith('/portal/product-owner');
  });

  it('asks for a work email when the form is submitted empty', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a work email address')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the specific error for an unprovisioned @azentio.com email', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.type(screen.getByRole('textbox', { name: EMAIL_LABEL }), 'nobody.new@azentio.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      screen.getByText('Verified @azentio.com email but not provisioned. Real sign-in denies the portal.'),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a generic not-found error for an unknown email', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    await user.type(screen.getByRole('textbox', { name: EMAIL_LABEL }), 'stranger@example.org');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Couldn’t find your account. Choose a demo persona below.')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('clears the error as soon as the visitor edits the email', async () => {
    const user = userEvent.setup();
    render(<PersonaPicker />);
    const input = screen.getByRole('textbox', { name: EMAIL_LABEL });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a work email address')).toBeInTheDocument();

    await user.type(input, 'a');
    expect(screen.queryByText('Enter a work email address')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
