import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where, 
  getDoc, 
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useModal } from '../contexts/ModalContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BookOpen, 
  Clock,
  Eye,
  Trash2,
  Search,
  Bell,
  TrendingUp,
  Plus,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  FileText,
  Settings as SettingsIcon,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { openAddBookModal } = useModal();
  const navigate = useNavigate();
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [continueReading, setContinueReading] = useState<any[]>([]);
  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBooks: 0, newBooks: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Stats listener
    const booksRef = collection(db, 'books');
    const unsubscribeBooks = onSnapshot(booksRef, (snapshot) => {
      const allBooks = snapshot.docs.map(doc => doc.data());
      setStats(prev => ({ ...prev, totalBooks: allBooks.length }));
    });

    // New arrivals
    const qNew = query(collection(db, 'books'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeNew = onSnapshot(qNew, (snapshot) => {
      const books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewArrivals(books);
      setStats(prev => ({ ...prev, newBooks: books.length }));
    });

    // Recent activity and continue reading
    const scansQuery = query(
      collection(db, 'scans'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribeScans = onSnapshot(scansQuery, async (snapshot) => {
      const scansData = [];
      const continueReadingData: any[] = [];
      const seenBookIds = new Set();

      for (const scanDoc of snapshot.docs) {
        const data = scanDoc.data();
        const bookRef = doc(db, 'books', data.bookId);
        const bookSnap = await getDoc(bookRef);
        
        if (bookSnap.exists()) {
          const bookData = { id: bookSnap.id, ...bookSnap.data() };
          scansData.push({
            id: scanDoc.id,
            bookId: data.bookId,
            type: data.type || 'scan',
            timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
            book: bookData
          });

          if (data.type === 'read' && !seenBookIds.has(data.bookId) && continueReadingData.length < 3) {
            continueReadingData.push(bookData);
            seenBookIds.add(data.bookId);
          }
        }
      }
      setRecentActions(scansData);
      setContinueReading(continueReadingData);
      setLoading(false);
    });

    return () => {
      unsubscribeBooks();
      unsubscribeNew();
      unsubscribeScans();
    };
  }, [user]);

  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scans', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `scans/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <Link to="/settings" className="relative group flex-shrink-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-primary/20 group-hover:border-primary transition-all">
              <img 
                src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 bg-green-500 border-2 sm:border-4 border-surface rounded-full"></div>
          </Link>
          <div className="min-w-0">
            <h2 className="font-headline text-xl sm:text-3xl font-extrabold text-primary tracking-tight truncate">
              {t('dashboard.welcome')}, {user?.displayName?.split(' ')[0] || 'Usuario'}!
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {t('dashboard.status.online')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative group flex-1 sm:flex-none">
            <input 
              type="text" 
              placeholder={t('catalog.search.placeholder')}
              className="bg-surface-container-high border-none rounded-2xl py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 sm:pr-6 text-sm w-full sm:w-64 focus:ring-2 focus:ring-primary transition-all shadow-sm"
            />
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 group-focus-within:text-primary transition-colors" size={16} />
          </div>
          <button className="p-2.5 sm:p-3 bg-surface-container-high text-on-surface-variant rounded-2xl hover:bg-surface-variant transition-all relative">
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-surface"></span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-10">
          {/* Continue Reading */}
          {continueReading.length > 0 && (
            <section>
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-outline-variant/30"></div>
                <h3 className="font-headline text-xl font-bold text-primary px-4 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={20} />
                  {t('dashboard.continue_reading')}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-outline-variant/30"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {continueReading.map((book, i) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/book/${book.id}`, { state: { openReader: true } })}
                  >
                    <div className="bg-surface-container-low rounded-3xl p-4 border border-outline-variant/10 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5">
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-4 shadow-md group-hover:shadow-lg transition-all">
                        <img 
                          src={book.coverUrl || `https://picsum.photos/seed/${book.id}/300/400`} 
                          alt={book.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h4 className="font-bold text-on-surface truncate mb-1 group-hover:text-primary transition-colors">{book.title}</h4>
                      <p className="text-xs text-on-surface-variant truncate">{book.author}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Stats Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-primary-container text-on-primary-container p-6 rounded-[2rem] shadow-sm flex items-center gap-4 group hover:scale-[1.02] transition-transform">
              <div className="p-4 bg-white/20 rounded-2xl group-hover:rotate-12 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm font-medium opacity-80">{t('dashboard.stats.total_books')}</p>
                <h4 className="text-3xl font-black">{stats.totalBooks.toLocaleString()}</h4>
              </div>
            </div>
            <div className="bg-tertiary-container text-on-tertiary-container p-6 rounded-[2rem] shadow-sm flex items-center gap-4 group hover:scale-[1.02] transition-transform">
              <div className="p-4 bg-white/20 rounded-2xl group-hover:rotate-12 transition-transform">
                <Plus size={24} />
              </div>
              <div>
                <p className="text-sm font-medium opacity-80">{t('dashboard.stats.new_arrivals')}</p>
                <h4 className="text-3xl font-black">{stats.newBooks}</h4>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
                <Clock size={24} />
                {t('dashboard.recent_activity')}
              </h3>
              <Link to="/history" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                {t('dashboard.view_all')} <ChevronRight size={16} />
              </Link>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {recentActions.map((activity, i) => (
                  <motion.div 
                    key={activity.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-4 group hover:bg-surface-container-high transition-all"
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                      <img 
                        src={activity.book.coverUrl || `https://picsum.photos/seed/${activity.bookId}/100/150`} 
                        alt={activity.book.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                        {activity.type === 'read' ? t('history.interaction.read') : t('history.interaction.scan')}
                      </p>
                      <h4 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">{activity.book.title}</h4>
                      <p className="text-xs text-on-surface-variant">
                        {activity.timestamp.toLocaleDateString()} • {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link 
                        to={`/book/${activity.bookId}`}
                        className="p-2 bg-surface-container-highest text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                      >
                        <ChevronRight size={20} />
                      </Link>
                      <button 
                        onClick={() => setDeleteConfirm(activity.id)}
                        className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {recentActions.length === 0 && (
                <div className="text-center py-12 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant">
                  <p className="text-on-surface-variant">{t('history.empty_title')}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Content */}
        <div className="lg:col-span-4 space-y-8">
          {/* New Arrivals */}
          <section className="bg-surface-container-low rounded-[2.5rem] p-8 border border-outline-variant/10">
            <h3 className="font-headline text-xl font-bold text-primary mb-6 flex items-center gap-2">
              <TrendingUp size={20} />
              {t('dashboard.stats.new_arrivals')}
            </h3>
            <div className="space-y-6">
              {newArrivals.map((book) => (
                <Link 
                  key={book.id} 
                  to={`/book/${book.id}`}
                  className="flex gap-4 group"
                >
                  <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-all">
                    <img 
                      src={book.coverUrl || `https://picsum.photos/seed/${book.id}/200/300`} 
                      alt={book.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h4 className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{book.title}</h4>
                    <p className="text-xs text-on-surface-variant truncate">{book.author}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-tighter">
                      {t('dashboard.view')} <ArrowRight size={10} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* System Status / Reports */}
          <section className="bg-gradient-to-br from-primary to-primary-container text-white rounded-[2.5rem] p-8 shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{t('settings.report.title')}</h3>
                  <p className="text-xs opacity-80">Beta v1.0.4</p>
                </div>
              </div>
              <p className="text-sm opacity-90 mb-6 leading-relaxed">
                {t('login.beta.desc').split('.')[0]}.
              </p>
              <Link 
                to="/settings"
                className="w-full py-4 bg-white text-primary font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all active:scale-95 shadow-lg"
              >
                <FileText size={18} />
                {t('settings.item.reports')}
              </Link>
            </div>
          </section>

          {/* Quick Settings & Admin Actions */}
          <section className="bg-surface-container-low rounded-[2.5rem] p-8 border border-outline-variant/10">
            <h3 className="font-headline text-xl font-bold text-primary mb-6 flex items-center gap-2">
              <SettingsIcon size={20} />
              {t('dashboard.available_actions')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {isAdmin && (
                <button 
                  onClick={openAddBookModal}
                  className="col-span-2 p-4 bg-primary text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
                >
                  <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                  <span className="font-bold">{t('nav.add_book')}</span>
                </button>
              )}
              <Link to="/settings" className="p-4 bg-surface-container-high rounded-2xl flex flex-col items-center gap-2 hover:bg-primary hover:text-white transition-all group">
                <SettingsIcon size={24} className="group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-xs font-bold">{t('nav.settings')}</span>
              </Link>
              <Link to="/history" className="p-4 bg-surface-container-high rounded-2xl flex flex-col items-center gap-2 hover:bg-primary hover:text-white transition-all group">
                <Clock size={24} />
                <span className="text-xs font-bold">{t('nav.history')}</span>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-outline-variant/20"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-headline text-2xl font-bold text-primary text-center mb-2">
                {t('dashboard.delete_activity_title')}
              </h3>
              <p className="text-on-surface-variant text-center mb-8">
                {t('dashboard.delete_activity_confirm')}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-variant transition-all"
                >
                  {t('settings.action.cancel')}
                </button>
                <button 
                  onClick={() => handleDeleteActivity(deleteConfirm)}
                  className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  {t('history.action.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
