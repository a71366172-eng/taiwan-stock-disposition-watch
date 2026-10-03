import React from 'react';
import {createRoot} from 'react-dom/client';
import '../app/globals.css';
import '../app/dashboard.css';
import '../app/disposition.css';
import '../app/trading-theme.css';
import '../app/compare.css';
import {StaticApp} from './static-app';

createRoot(document.getElementById('root')!).render(<React.StrictMode><StaticApp/></React.StrictMode>);
