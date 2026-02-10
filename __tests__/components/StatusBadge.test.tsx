/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders status text', () => {
    render(<StatusBadge status="ok" />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('uses custom label', () => {
    render(<StatusBadge status="due_soon" label="Скоро" />);
    expect(screen.getByText('Скоро')).toBeInTheDocument();
  });

  it('maps ok to success variant', () => {
    const { container } = render(<StatusBadge status="ok" />);
    expect(container.querySelector('.badge-success')).toBeInTheDocument();
  });

  it('maps overdue to error variant', () => {
    const { container } = render(<StatusBadge status="overdue" />);
    expect(container.querySelector('.badge-error')).toBeInTheDocument();
  });

  it('maps pending to warning variant', () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(container.querySelector('.badge-warning')).toBeInTheDocument();
  });

  it('uses explicit variant over status mapping', () => {
    const { container } = render(<StatusBadge status="custom" variant="info" />);
    expect(container.querySelector('.badge-primary')).toBeInTheDocument();
  });
});
