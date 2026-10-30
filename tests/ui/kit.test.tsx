/** @jest-environment jsdom */
import type { FormEvent } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, EmptyState, PageHeader, PillButton, PillLink, StatTile, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { IdeaStatusBadge, ObsStatus, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { STATE_LABEL, type IdeaStatus, type ObsState } from '@/app/(config)/mock/portal';

describe('portal kit: layout pieces', () => {
  it('renders the page title as the only h1 and shows the description', () => {
    render(<PageHeader title="Client workspace" description="Observations for your organisation." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Client workspace' })).toBeInTheDocument();
    expect(screen.getByText('Observations for your organisation.')).toBeInTheDocument();
  });

  it('renders breadcrumbs with links for earlier crumbs and plain text for the current page', () => {
    render(
      <PageHeader
        title="Members"
        crumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'Harborline', href: '/portal/client' },
          { label: 'Members' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal');
    expect(within(nav).getByRole('link', { name: 'Harborline' })).toHaveAttribute('href', '/portal/client');
    expect(within(nav).queryByRole('link', { name: 'Members' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Members')).toBeInTheDocument();
  });

  it('places action controls in the header', () => {
    render(<PageHeader title="Ideas" actions={<PillLink href="/portal/ideas/new">New idea</PillLink>} />);
    expect(screen.getByRole('link', { name: 'New idea' })).toHaveAttribute('href', '/portal/ideas/new');
  });

  it('wraps its content in a card', () => {
    render(<Card>Quarterly figures</Card>);
    expect(screen.getByText('Quarterly figures')).toBeInTheDocument();
  });

  it('renders a stat tile with its value, label and hint', () => {
    render(<StatTile label="Open reports" value={7} hint="Updated today" />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Open reports')).toBeInTheDocument();
    expect(screen.getByText('Updated today')).toBeInTheDocument();
  });

  it('renders an empty state with a title, body and optional action', () => {
    render(
      <EmptyState
        title="No observations yet"
        body="Write the first one to start learning."
        action={<PillLink href="/portal/observations/new">Write one</PillLink>}
      />,
    );
    expect(screen.getByText('No observations yet')).toBeInTheDocument();
    expect(screen.getByText('Write the first one to start learning.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write one' })).toBeInTheDocument();
  });

  it('marks demo pages as synthetic data', () => {
    render(<SyntheticNote />);
    expect(screen.getByText(/All data on this page is synthetic/)).toBeInTheDocument();
  });

  it('renders a table with column headers and body cells', () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th>Organisation</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>Harborline</Td>
            <Td>Active</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Organisation' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Harborline' })).toBeInTheDocument();
    expect(screen.getByRole('table').parentElement).toHaveClass('overflow-x-auto');
  });
});

describe('portal kit: buttons and links', () => {
  it('renders a pill link that points at its destination', () => {
    render(<PillLink href="/portal/client">Open client portal</PillLink>);
    expect(screen.getByRole('link', { name: 'Open client portal' })).toHaveAttribute('href', '/portal/client');
  });

  it('renders an enabled pill button by default', () => {
    render(<PillButton>Save</PillButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('disables a pill button when asked to', () => {
    render(<PillButton disabled>Save</PillButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not submit a surrounding form from a disabled pill button', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((e: FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PillButton type="submit" disabled>Send</PillButton>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the surrounding form from an enabled submit pill button', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((e: FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PillButton type="submit">Send</PillButton>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('defaults pill buttons to type button so they do not submit forms by accident', () => {
    render(<PillButton>Toggle</PillButton>);
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('type', 'button');
  });
});

describe('portal kit: status badges', () => {
  it.each(Object.keys(STATE_LABEL) as ObsState[])('labels the %s observation state with text, not colour alone', (state) => {
    render(<ObsStatus state={state} />);
    expect(screen.getByText(STATE_LABEL[state])).toBeInTheDocument();
  });

  const ideaStatuses: IdeaStatus[] = ['Proposed', 'Under review', 'Planned', 'In progress', 'Released', 'Not proceeding'];
  it.each(ideaStatuses)('labels the "%s" idea status with its text', (status) => {
    render(<IdeaStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('renders a generic pill with its children and a tone', () => {
    render(<Pill tone="red">Suspended content</Pill>);
    const pill = screen.getByText('Suspended content');
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('bg-az-error');
  });
});
