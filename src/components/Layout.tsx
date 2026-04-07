import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Tags, 
  Users, 
  Building2, 
  QrCode, 
  UserCircle, 
  Settings, 
  LogOut, 
  Plus,
  Search,
  Bell,
  ScanLine,
  Heart,
  History,
  Download,
  Menu,
  X
} from 'lucide-react';
import { APP_NAME, INSTITUTION_NAME, SCHOOL_NAME, LOGO_URL, LOGO_FALLBACK } from '../constants';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useModal } from '../contexts/ModalContext';
import { AddBookModal } from './AddBookModal';

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const { isAddBookModalOpen, openAddBookModal, closeAddBookModal } = useModal();

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.area'), path: '/' },
    { icon: BookOpen, label: t('nav.books'), path: '/catalog' },
    { icon: Heart, label: t('nav.favorites'), path: '/favorites' },
    { icon: History, label: t('nav.history'), path: '/history' },
    { icon: Download, label: t('nav.downloads'), path: '/downloads' },
    { icon: QrCode, label: t('nav.qr'), path: '/scanner' },
  ];

  const bottomItems = [
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={cn(
        "h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-primary/5 flex flex-col py-6 z-50 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex flex-col items-center gap-4 flex-1">
            <div className="w-24 h-24 lg:w-32 lg:h-32 flex items-center justify-center overflow-hidden">
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
            <div className="text-center">
              <h1 className="font-headline text-xl lg:text-2xl font-black text-primary leading-tight">{APP_NAME}</h1>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-on-surface-variant">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-all duration-200 font-medium text-sm",
                location.pathname === item.path 
                  ? "bg-primary-fixed text-primary border-l-4 border-primary font-bold" 
                  : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 mt-auto space-y-4">
          {isAdmin && (
            <button 
              onClick={() => {
                openAddBookModal();
                if (window.innerWidth < 1024) onClose();
              }}
              className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              {t('nav.add_book')}
            </button>
          )}
          
          <div className="pt-4 border-t border-primary/10">
            {bottomItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-all duration-200 font-medium text-sm text-on-surface-variant hover:bg-surface-container-high",
                  location.pathname === item.path && "text-primary font-bold"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <AddBookModal 
        isOpen={isAddBookModalOpen} 
        onClose={closeAddBookModal} 
      />
    </>
  );
};

const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { userData } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="flex justify-between items-center w-full px-4 lg:px-8 py-4 sticky top-0 bg-surface/80 backdrop-blur-md shadow-sm z-30 lg:ml-0">
      <div className="flex items-center gap-4 lg:gap-8">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-headline text-lg lg:text-2xl font-black text-primary truncate max-w-[120px] lg:max-w-none">{INSTITUTION_NAME}</span>
          <span className="text-secondary font-bold text-lg hidden sm:inline">|</span>
          <span className="font-headline text-sm lg:text-xl font-bold text-secondary hidden sm:inline">{APP_NAME}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6 flex-1 justify-end lg:max-w-md">
        <div className="relative w-full max-w-[200px] sm:max-w-none hidden sm:block">
          <input 
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-12 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest text-sm transition-all" 
            placeholder={t('topbar.search')}
            type="text"
          />
          <Search className="absolute left-3 top-2 text-on-surface-variant" size={16} />
          <button className="absolute right-3 top-1.5 text-primary hover:scale-110 transition-transform">
            <ScanLine size={18} />
          </button>
        </div>
        
        <button className="p-2 text-on-surface-variant hover:text-primary transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
        </button>

        <Link to="/settings" className="h-9 w-9 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20 flex-shrink-0">
          {userData?.photoUrl ? (
            <img src={userData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <UserCircle className="w-full h-full text-on-surface-variant" />
          )}
        </Link>
      </div>
    </header>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="p-4 lg:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};
