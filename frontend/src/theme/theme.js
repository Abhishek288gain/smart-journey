import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2b8cff', light: '#59b8ff', dark: '#1768d0' },
    secondary: { main: '#34d8c0', light: '#79f0d9', dark: '#149a94' },
    background: { default: '#071126', paper: '#0d1934' },
    success: { main: '#55dcae' },
    warning: { main: '#ffb020' },
    error: { main: '#ff5d73' },
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: { fontWeight: 800 }, h4: { fontWeight: 800 }, h5: { fontWeight: 750 },
    button: { textTransform: 'none', fontWeight: 700 }
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCard: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(145,170,216,.13)', borderRadius: 20, boxShadow: '0 18px 55px rgba(0,0,0,.2)' } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 11, fontWeight: 750, letterSpacing: '.01em' } } },
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
  }
});
