import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, signUpWithEmail, loginWithEmail } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogIn, UserPlus, Mail, Lock, User, ArrowRight, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_NAME, INSTITUTION_NAME, LOGO_URL, LOGO_FALLBACK } from '../constants';
import { cn } from '../lib/utils';

export const Login = () => {
  const { user, showPermissionsStep, setShowPermissionsStep, showBetaWelcome, setShowBetaWelcome } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !showPermissionsStep) {
      navigate('/');
    }
  }, [user, navigate, showPermissionsStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name, role);
        // setShowPermissionsStep is handled by AuthContext
      } else {
        await loginWithEmail(email, password);
        navigate('/');
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(t('login.error.not_allowed'));
      } else {
        setError(err.message || t('login.error.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      setShowPermissionsStep(false);
      navigate('/');
    } catch (err) {
      console.error("Permission denied:", err);
      // Even if denied, we let them in, they just won't be able to scan
      setShowPermissionsStep(false);
      navigate('/');
    }
  };

  if (showBetaWelcome) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-surface-container-lowest p-10 rounded-3xl shadow-2xl text-center border border-primary/10"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <AlertCircle size={40} />
          </div>
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">{t('login.beta.welcome')}</h2>
          <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
            {t('login.beta.desc')}
          </p>
          
          <button 
            onClick={() => setShowBetaWelcome(false)}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg"
          >
            {t('login.beta.action')}
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </div>
    );
  }

  if (showPermissionsStep) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-surface-container-lowest p-10 rounded-3xl shadow-2xl text-center border border-primary/10"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <Shield size={40} />
          </div>
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">{t('login.permissions.welcome', { name: name || user?.displayName || 'Usuario' })}</h2>
          <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
            {t('login.permissions.desc')}
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={handleRequestPermissions}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg"
            >
              {t('login.permissions.action')}
              <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => {
                setShowPermissionsStep(false);
                navigate('/');
              }}
              className="w-full py-3 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
            >
              {t('login.permissions.later')}
            </button>
          </div>
          
          <div className="mt-8 p-4 bg-surface-container-low rounded-2xl text-left">
            <div className="flex gap-3 items-start">
              <div className="p-1.5 bg-green-500/10 text-green-500 rounded-lg">
                <Shield size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface uppercase tracking-wider mb-0.5">{t('login.permissions.privacy_title')}</p>
                <p className="text-[10px] text-on-surface-variant">{t('login.permissions.privacy_desc')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // AuthContext will handle showPermissionsStep if it's a new user
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError(t('login.error.popup_blocked'));
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignore cancelled requests
      } else {
        setError(err.message || t('login.error.google'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-surface-container-lowest p-6 sm:p-10 rounded-2xl shadow-2xl text-center border border-primary/5">
        <div className="w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center p-4 mx-auto mb-6 overflow-hidden">
          <img 
            src={LOGO_URL} 
            alt={INSTITUTION_NAME} 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = LOGO_FALLBACK;
            }}
          />
        </div>
        <h1 className="font-headline text-3xl sm:text-5xl font-black text-primary mb-2">{APP_NAME}</h1>
        <p className="text-on-surface-variant text-xs sm:text-sm font-medium mb-8">{t('login.subtitle')}</p>
        
        <div className="flex bg-surface-container-low p-1 rounded-xl mb-8">
          <button 
            onClick={() => setIsSignUp(false)}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              !isSignUp ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {t('login.tab.login')}
          </button>
          <button 
            onClick={() => setIsSignUp(true)}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              isSignUp ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {t('login.tab.signup')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isSignUp && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{t('login.label.name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('login.placeholder.name')}
                    required
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{t('login.label.role')}</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="student">{t('settings.role.student')}</option>
                  <option value="teacher">{t('settings.role.teacher')}</option>
                  <option value="other">{t('settings.role.other')}</option>
                </select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{t('login.label.email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.placeholder.email')}
                required
                className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{t('login.label.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.placeholder.password')}
                required
                className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-10 pr-12 text-sm focus:ring-2 focus:ring-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-bold ml-1">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg disabled:opacity-50"
          >
            {loading ? t('login.action.processing') : (isSignUp ? t('login.action.signup') : t('login.action.login'))}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-container-lowest px-4 text-slate-400 font-bold">{t('login.divider')}</span>
          </div>
        </div>
        
        <button 
          onClick={handleGoogleSignIn}
          className="w-full py-4 px-6 bg-surface-container-lowest border-2 border-outline-variant/30 rounded-xl font-bold text-on-surface flex items-center justify-center gap-3 hover:bg-surface-container-low transition-all active:scale-95 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          {t('login.action.google')}
        </button>
        
        <p className="mt-8 text-[10px] text-on-surface-variant opacity-60 leading-relaxed">
          {t('login.privacy_policy')}
        </p>
      </div>
    </div>
  );
};
