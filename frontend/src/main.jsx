import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useMemo } from 'react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { theme as baseTheme } from './theme/theme';
import { ThemeModeProvider, useThemeMode } from './context/ThemeModeContext';
import './styles.css';
import './styles/system.css';

function ThemedApp() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => createTheme({ ...baseTheme, palette: {
    ...baseTheme.palette, mode,
    background: mode === 'light' ? { default: '#f2f7fc', paper: '#ffffff' } : { default: '#071126', paper: '#0d1934' },
    text: mode === 'light' ? { primary: '#122746', secondary: '#586b86' } : { primary: '#f4f7ff', secondary: '#91a0ba' },
  } }), [mode]);
  return <ThemeProvider theme={theme}><CssBaseline /><AuthProvider><App /></AuthProvider></ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeModeProvider><ThemedApp /></ThemeModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
