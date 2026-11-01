import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Box className="center-page"><CircularProgress /></Box>;
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
