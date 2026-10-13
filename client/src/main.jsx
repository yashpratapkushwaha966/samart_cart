import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { MenuProvider } from './context/MenuContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './index.css';

const googleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const tree = (
  <BrowserRouter>
    <ThemeProvider><ToastProvider><AuthProvider><CartProvider><MenuProvider><App /></MenuProvider></CartProvider></AuthProvider></ToastProvider></ThemeProvider>
  </BrowserRouter>
);
createRoot(document.getElementById('root')).render(
  <React.StrictMode>{googleId ? <GoogleOAuthProvider clientId={googleId}>{tree}</GoogleOAuthProvider> : tree}</React.StrictMode>
);
