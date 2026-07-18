import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './Home';
import { PublicView } from './PublicView';
import { AdminApp } from './AdminApp';
import { Manage } from './Manage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TvView } from './TvView';
import { TableView } from './TableView';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:slug" element={<PublicView />} />
        <Route path="/sprava" element={<Manage />} />
        <Route path="/t/:slug/admin" element={<AdminApp />} />
        <Route path="/t/:slug/tv" element={<TvView />} />
        <Route path="/t/:slug/stol" element={<TableView />} />
      </Routes>
    </BrowserRouter></ErrorBoundary>
  </StrictMode>
);
