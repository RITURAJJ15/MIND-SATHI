import React from 'react';
import ReactDOM from 'react-dom/client';
import CaregiverApp from './CaregiverApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('caregiver-root')!).render(
  <React.StrictMode>
    <CaregiverApp />
  </React.StrictMode>,
);
