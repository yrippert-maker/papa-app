/**
 * Smoke test: navigation and route mounting.
 * Catches regressions at the routing level.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('Navigation smoke', () => {
  it('renders NotFoundPage for unknown path (*)', () => {
    renderAt('/nope');
    expect(screen.getByText(/404|Page not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Evidence/i })).toBeInTheDocument();
  });

  it('mounts DaysPage at /days', () => {
    renderAt('/days');
    expect(screen.getByText(/Auditor Portal — Days/i)).toBeInTheDocument();
    expect(screen.getByText(/Date \(UTC\)/i)).toBeInTheDocument();
  });

  it('mounts MailInboxPage at /mail/inbox', () => {
    renderAt('/mail/inbox');
    expect(screen.getByText(/Mail inbox/i)).toBeInTheDocument();
  });

  it('mounts MailDetailPage at /mail/view', () => {
    renderAt('/mail/view');
    expect(screen.getByText(/Mail detail|Missing \?key/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /← Inbox/i })).toBeInTheDocument();
  });

  it('mounts ExceptionsPage at /exceptions', () => {
    renderAt('/exceptions');
    expect(screen.getByText(/Exception register/i)).toBeInTheDocument();
    expect(screen.getByText(/No exceptions in register/i)).toBeInTheDocument();
  });

  it('redirects / to /days', () => {
    renderAt('/');
    expect(screen.getByText(/Auditor Portal — Days/i)).toBeInTheDocument();
  });
});
