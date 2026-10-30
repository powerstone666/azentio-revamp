/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import AiraMarkdown from '@/app/(ui)/components/public/AiraMarkdown';

describe('AiraMarkdown', () => {
  it('renders markdown headings at the in-card heading levels', () => {
    render(<AiraMarkdown text={'## Overview\n\n### Details\n\n#### Small print'} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Small print' })).toBeInTheDocument();
  });

  it('renders bullet and numbered lists as list elements', () => {
    render(<AiraMarkdown text={'- first point\n- second point\n\n1. step one\n2. step two'} />);
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(lists[0].tagName).toBe('UL');
    expect(lists[1].tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders bold text as strong emphasis', () => {
    render(<AiraMarkdown text={'This is **important** stuff.'} />);
    expect(screen.getByText('important', { selector: 'strong' })).toBeInTheDocument();
  });

  // BUG: AiraMarkdown uses react-markdown without remark-gfm, so GFM pipe tables are never parsed and the
  // `table` component override in app/(ui)/components/public/AiraMarkdown.tsx is unreachable. Expected: a real table.
  it.failing('renders markdown tables as real tables inside a horizontally scrollable wrapper', () => {
    render(<AiraMarkdown text={'| Product | Market |\n| --- | --- |\n| AMLOCK | Banking |'} />);
    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('columnheader', { name: 'Product' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Banking' })).toBeInTheDocument();
  });

  it('routes internal links through the app router link with a trailing arrow', () => {
    render(<AiraMarkdown text={'See [Solutions](/solutions) for more.'} />);
    const link = screen.getByRole('link', { name: /Solutions/ });
    expect(link).toHaveAttribute('href', '/solutions');
    expect(link).not.toHaveAttribute('target');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('opens external links in a new tab with safe rel attributes', () => {
    render(<AiraMarkdown text={'Read the [vendor docs](https://example.com/docs).'} />);
    const link = screen.getByRole('link', { name: 'vendor docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('turns a [S1] citation into a link to the matching source', () => {
    render(
      <AiraMarkdown
        text={'Screening runs in real time [S1].'}
        sources={[{ title: 'AMLOCK overview', url: '/products/amlock' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'S1' })).toHaveAttribute('href', '/products/amlock');
  });

  it('leaves a [S2] citation as plain text when there is no matching source', () => {
    render(
      <AiraMarkdown
        text={'Only one source exists [S2].'}
        sources={[{ title: 'AMLOCK overview', url: '/products/amlock' }]}
      />,
    );
    expect(screen.queryByRole('link', { name: 'S2' })).not.toBeInTheDocument();
    expect(screen.getByText(/Only one source exists \[S2\]\./)).toBeInTheDocument();
  });

  it('does not render raw HTML from the text', () => {
    const { container } = render(
      <AiraMarkdown text={'Hello <img src="x" onerror="alert(1)"> <script>alert(2)</script> world'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
