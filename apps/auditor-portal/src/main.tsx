import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DaysPage } from './pages/DaysPage';
import { DayPage } from './pages/DayPage';
import { EntryPage } from './pages/EntryPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { MailInboxPage } from './pages/MailInboxPage';
import { MailDetailPage } from './pages/MailDetailPage';
import { DocumentPage } from './pages/DocumentPage';
import { MailAllowlistPage } from './pages/MailAllowlistPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/days" replace />} />
        <Route path="/days" element={<DaysPage />} />
        <Route path="/day/:date" element={<DayPage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/exceptions" element={<ExceptionsPage />} />
        <Route path="/mail/inbox" element={<MailInboxPage />} />
        <Route path="/mail/view" element={<MailDetailPage />} />
        <Route path="/documents/:docId" element={<DocumentPage />} />
        <Route path="/settings/mail-allowlist" element={<MailAllowlistPage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
