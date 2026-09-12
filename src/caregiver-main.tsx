import React from 'react';
import ReactDOM from 'react-dom/client';
import CaregiverApp from './CaregiverApp';
import './index.css';
import { initMobileBridge } from './services/mobileBridgeService';

// Initialize native mobile bridge if running in Capacitor
initMobileBridge();

ReactDOM.createRoot(document.getElementById('caregiver-root')!).render(
  <React.StrictMode>
    <CaregiverApp />
  </React.StrictMode>,
);
