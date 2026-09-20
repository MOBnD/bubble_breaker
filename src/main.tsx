import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdventureProvider } from './state/AdventureContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdventureProvider>
      <App />
    </AdventureProvider>
  </React.StrictMode>,
);
