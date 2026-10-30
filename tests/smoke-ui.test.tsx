/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import AiraMarkdown from '@/app/(ui)/components/public/AiraMarkdown';

describe('jest harness (jsdom + ESM markdown)', () => {
  it('renders markdown and routes internal links', () => {
    render(<AiraMarkdown text={'## Title\n\n- **bold** item\n\nSee [Solutions](/solutions).'} />);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Solutions/ })).toHaveAttribute('href', '/solutions');
  });
});
