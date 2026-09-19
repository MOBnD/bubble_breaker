import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { JourneyProvider } from './state/JourneyContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <JourneyProvider>
        <App />
      </JourneyProvider>
    </HashRouter>
  </React.StrictMode>,
);
