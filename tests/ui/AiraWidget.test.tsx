/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiraWidget from '@/app/(ui)/components/public/AiraWidget';
import { bodyOf, deferred, installFetch, jsonResponse } from './helpers';

// GSAP is decorative. The mock runs the reduced-motion branch only and applies its end state
// (visibility/opacity) immediately, so the dialog's open/closed state is what users would see.
jest.mock('@/app/(ui)/motion/gsap', () => {
  // The factory is hoisted above imports, so React must be required here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react');
  const applyAutoAlpha = (el: HTMLElement | null, vars: Record<string, unknown>) => {
    if (!el || !('autoAlpha' in vars)) return;
    el.style.opacity = String(vars.autoAlpha);
    el.style.visibility = vars.autoAlpha === 0 ? 'hidden' : 'visible';
  };
  const timeline = () => {
    const tl: Record<string, unknown> = {};
    tl.to = () => tl;
    return tl;
  };
  return {
    gsap: {
      to: jest.fn(),
      fromTo: jest.fn(),
      set: (el: HTMLElement | null, vars: Record<string, unknown>) => applyAutoAlpha(el, vars),
      timeline,
      matchMedia: () => ({
        add: (query: string, fn: () => void) => {
          if (query === '(prefers-reduced-motion: reduce)') fn();
        },
      }),
    },
    // Re-applies the end state on every render, mirroring how the real hook reruns on dependency changes.
    useGSAP: (callback: () => void) => {
      useEffect(() => {
        callback();
      });
    },
  };
});

const CONSENT_KEY = 'aira_external_ai_consent';
const PLACEHOLDER = 'Ask AIRA about products, portals...';
const CONSENT_TEXT = /allow the message and recent chat to be processed/;

let fetchCtl: ReturnType<typeof installFetch>;

beforeAll(() => {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  window.sessionStorage.clear();
  fetchCtl = installFetch();
});

afterEach(() => {
  fetchCtl.restore();
});

async function openAira(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open AIRA assistant' }));
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), text);
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('AiraWidget', () => {
  it('opens from the launcher and closes again with the close button', async () => {
    const user = userEvent.setup();
    render(<AiraWidget />);
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toHaveClass('pointer-events-none');

    await openAira(user);
    expect(dialog).toHaveClass('pointer-events-auto');

    await user.click(screen.getByRole('button', { name: 'Close AIRA chat' }));
    expect(dialog).toHaveClass('pointer-events-none');
  });

  it('focuses the message box once the assistant opens', async () => {
    const user = userEvent.setup();
    render(<AiraWidget />);
    await openAira(user);
    await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveFocus());
  });

  it('shows the AIRA greeting before any question is asked', () => {
    render(<AiraWidget />);
    expect(screen.getByText(/Azentio's website guide/, { exact: false })).toBeInTheDocument();
  });

  it('shows the external AI consent notice until the visitor ticks it', async () => {
    const user = userEvent.setup();
    render(<AiraWidget />);
    await openAira(user);

    expect(screen.getByText(CONSENT_TEXT)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: CONSENT_TEXT }));

    expect(screen.queryByText(CONSENT_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText('External AI enabled')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CONSENT_KEY)).toBe('true');
  });

  it('sends allow_external_processing as false when the visitor has not consented', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ answer: 'Local answer.' }));
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'What is AMLOCK?');

    await screen.findByText('Local answer.');
    expect(fetchCtl.fetchMock).toHaveBeenCalledWith(
      '/api/v1/aira/chat',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    );
    expect(bodyOf(fetchCtl.fetchMock)).toMatchObject({ message: 'What is AMLOCK?', allow_external_processing: false });
  });

  it('sends allow_external_processing as true after the visitor has consented', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ answer: 'Answer.' }));
    render(<AiraWidget />);
    await openAira(user);
    await user.click(screen.getByRole('checkbox', { name: CONSENT_TEXT }));
    await ask(user, 'Tell me about iMAL');

    await screen.findByText('Answer.');
    expect(bodyOf(fetchCtl.fetchMock)).toMatchObject({ message: 'Tell me about iMAL', allow_external_processing: true });
  });

  it('remembers consent for the session so the notice stays hidden on reopen', async () => {
    window.sessionStorage.setItem(CONSENT_KEY, 'true');
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ answer: 'Answer.' }));
    render(<AiraWidget />);
    await openAira(user);

    expect(screen.queryByText(CONSENT_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText('External AI enabled')).toBeInTheDocument();
    await ask(user, 'Hello there');
    await screen.findByText('Answer.');
    expect(bodyOf(fetchCtl.fetchMock)).toMatchObject({ allow_external_processing: true });
  });

  it('withdraws consent with the Change link and brings the notice back', async () => {
    window.sessionStorage.setItem(CONSENT_KEY, 'true');
    const user = userEvent.setup();
    render(<AiraWidget />);
    await openAira(user);

    await user.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByText(CONSENT_TEXT)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it('renders the default suggested topics', async () => {
    const user = userEvent.setup();
    render(<AiraWidget />);
    await openAira(user);
    expect(screen.getByRole('button', { name: /How does AMLOCK sanctions screening work\?/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Technology & architecture/ })).toBeInTheDocument();
  });

  it('sends a suggested topic as the question when it is clicked', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ answer: 'Hub answer.' }));
    render(<AiraWidget />);
    await openAira(user);
    await user.click(screen.getByRole('button', { name: /What is the Collective Learning Hub\?/ }));

    await screen.findByText('Hub answer.');
    expect(bodyOf(fetchCtl.fetchMock).message).toBe('What is the Collective Learning Hub?');
    expect(screen.getByText('What is the Collective Learning Hub?', { selector: 'p' })).toBeInTheDocument();
  });

  it('replaces the suggested topics with the ones the API returns, up to five', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(
      jsonResponse({ answer: 'Done.', suggestedQueries: ['Q one', 'Q two', 'Q three', 'Q four', 'Q five', 'Q six'] }),
    );
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Anything');
    await screen.findByText('Done.');

    expect(screen.getByRole('button', { name: /Q five/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Q six/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AMLOCK sanctions/ })).not.toBeInTheDocument();
  });

  it('shows a writing indicator and disables the composer while an answer is pending', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchCtl.fetchMock.mockReturnValueOnce(pending.promise);
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Slow question');

    expect(await screen.findByText('AIRA is writing...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled();

    pending.resolve(jsonResponse({ answer: 'Finally.' }));
    await screen.findByText('Finally.');
    expect(screen.queryByText('AIRA is writing...')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeEnabled();
  });

  it('renders the assistant answer as markdown', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(
      jsonResponse({ answer: 'It is **fast** and see the [Solutions](/solutions) page.' }),
    );
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'How fast?');

    await screen.findByText('fast', { selector: 'strong' });
    expect(screen.getByRole('link', { name: /Solutions/ })).toHaveAttribute('href', '/solutions');
  });

  it('links [S1] citations to the source returned with the answer', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answer: 'Screening runs in real time [S1].',
        sources: [{ title: 'AMLOCK overview', category: 'Product', url: '/products/amlock' }],
      }),
    );
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'AMLOCK?');

    expect(await screen.findByRole('link', { name: 'S1' })).toHaveAttribute('href', '/products/amlock');
  });

  it('ignores sources whose URL is not a site-relative path', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answer: 'Claim from elsewhere [S1].',
        sources: [{ title: 'Outside', category: 'Web', url: 'https://elsewhere.example/page' }],
      }),
    );
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Anything external?');

    await screen.findByText(/Claim from elsewhere/);
    expect(screen.queryByRole('link', { name: 'S1' })).not.toBeInTheDocument();
  });

  it('shows the Solutions fallback when the API returns an empty answer', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ answer: '' }));
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Unknown topic');

    expect(await screen.findByRole('link', { name: /Solutions/ })).toHaveAttribute('href', '/solutions');
    expect(screen.getByText(/couldn't locate specific information/)).toBeInTheDocument();
  });

  it('shows a connection error message when the chat request fails', async () => {
    const user = userEvent.setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchCtl.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Will this fail?');

    expect(await screen.findByText(/Sorry, I encountered a temporary connection issue/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Solutions/ })).toHaveAttribute('href', '/solutions');
    consoleError.mockRestore();
  });

  it('shows the same connection error when the network request rejects', async () => {
    const user = userEvent.setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchCtl.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'Offline question');

    expect(await screen.findByText(/Sorry, I encountered a temporary connection issue/)).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('sends the prior conversation as history, without the greeting', async () => {
    const user = userEvent.setup();
    fetchCtl.fetchMock
      .mockResolvedValueOnce(jsonResponse({ answer: 'First answer.' }))
      .mockResolvedValueOnce(jsonResponse({ answer: 'Second answer.' }));
    render(<AiraWidget />);
    await openAira(user);
    await ask(user, 'First question');
    await screen.findByText('First answer.');
    await ask(user, 'Second question');
    await screen.findByText('Second answer.');

    expect(bodyOf(fetchCtl.fetchMock, 1).history).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer.' },
    ]);
  });

  it('keeps the send button disabled for an empty message', async () => {
    const user = userEvent.setup();
    render(<AiraWidget />);
    await openAira(user);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), '   ');
    expect(send).toBeDisabled();
    expect(fetchCtl.fetchMock).not.toHaveBeenCalled();
  });
});
