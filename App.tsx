import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ModalProvider } from './contexts/ModalContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Catalog } from './pages/Catalog';
import { Scanner } from './pages/Scanner';
import { BookDetails } from './pages/BookDetails';
import { Settings } from './pages/Settings';
import Favorites from './pages/Favorites';
import History from './pages/History';
import Downloads from './pages/Downloads';
import { Login } from './pages/Login';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ModalProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
                <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
                <Route path="/book/:id" element={<ProtectedRoute><BookDetails /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Router>
          </ModalProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
