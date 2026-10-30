/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModes } from '@/app/(ui)/components/portal/signin/LoginModes';
import { installFetch } from './helpers';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
}));

let fetchCtl: ReturnType<typeof installFetch>;

beforeEach(() => {
  fetchCtl = installFetch();
});

afterEach(() => {
  fetchCtl.restore();
});

describe('LoginModes', () => {
  it('opens on the real login tab by default', () => {
    render(<LoginModes />);
    expect(screen.getByRole('tab', { name: 'Real login' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Demo login' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('textbox', { name: 'Work email' })).toHaveAttribute('id', 'real-email');
  });

  it('switches to the demo personas when the demo tab is chosen', async () => {
    const user = userEvent.setup();
    render(<LoginModes />);
    await user.click(screen.getByRole('tab', { name: 'Demo login' }));

    expect(screen.getByRole('tab', { name: 'Demo login' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Demo personas' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Work email' })).toHaveAttribute('id', 'email');
  });

  it('switches back to the real login form from the demo tab', async () => {
    const user = userEvent.setup();
    render(<LoginModes />);
    await user.click(screen.getByRole('tab', { name: 'Demo login' }));
    await user.click(screen.getByRole('tab', { name: 'Real login' }));

    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Demo personas' })).not.toBeInTheDocument();
  });
});
