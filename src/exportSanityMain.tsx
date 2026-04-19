import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import ExportSanityPage from './exportSanityPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExportSanityPage />
  </StrictMode>,
);
