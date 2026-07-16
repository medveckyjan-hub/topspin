import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './Home';
import { PublicView } from './PublicView';
import { AdminApp } from './AdminApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:slug" element={<PublicView />} />
        <Route path="/t/:slug/admin" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
