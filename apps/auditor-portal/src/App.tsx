import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/AppLayout';
import { DaysPage } from './pages/DaysPage';
import { DayPage } from './pages/DayPage';
import { EntryPage } from './pages/EntryPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { MailInboxPage } from './pages/MailInboxPage';
import { MailDetailPage } from './pages/MailDetailPage';
import { DocumentPage } from './pages/DocumentPage';
import { MailAllowlistPage } from './pages/MailAllowlistPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/days" replace />} />

        <Route element={<AppLayout />}>
          <Route path="days" element={<DaysPage />} />
          <Route path="day/:date" element={<DayPage />} />
          <Route path="entry" element={<EntryPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="mail/inbox" element={<MailInboxPage />} />
          <Route path="mail/view" element={<MailDetailPage />} />
          <Route path="documents/:docId" element={<DocumentPage />} />
          <Route path="settings/mail-allowlist" element={<MailAllowlistPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
