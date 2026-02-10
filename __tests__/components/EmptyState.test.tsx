/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Нет данных" />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EmptyState title="Пусто" description="Добавьте первый элемент" />);
    expect(screen.getByText('Добавьте первый элемент')).toBeInTheDocument();
  });

  it('renders action button', () => {
    render(
      <EmptyState
        title="Нет записей"
        action={<button type="button">Добавить</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<EmptyState title="Пусто" icon={<span data-testid="icon">📭</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
