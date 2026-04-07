import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { History as HistoryIcon, BookOpen, Eye, Loader2, QrCode, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { deleteDoc } from 'firebase/firestore';

const History = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'scans'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const historyData = [];
      for (const historyDoc of snapshot.docs) {
        const data = historyDoc.data();
        const bookRef = doc(db, 'books', data.bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
          historyData.push({
            id: historyDoc.id,
            bookId: data.bookId,
            interactionType: data.type || 'scan',
            timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
            ...bookSnap.data()
          });
        }
      }
      setHistory(historyData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scans', id));
    } catch (error) {
      console.error("Error deleting history item:", error);
    }
  };

  const filteredHistory = history.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <HistoryIcon size={24} />
            </div>
            <h2 className="font-headline text-4xl font-bold text-primary">{t('nav.history')}</h2>
          </div>
          <p className="text-on-surface-variant">{t('history.subtitle')}</p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('history.search.placeholder')}
            className="w-full bg-surface-container-high border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={20} />
        </div>
      </header>

      {filteredHistory.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredHistory.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-6 hover:bg-surface-container-high transition-colors group"
              >
                <div className="w-16 h-20 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                  <img 
                    src={item.coverUrl || `https://picsum.photos/seed/${item.bookId}/200/300`} 
                    alt={item.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.interactionType === 'read' ? (
                      <BookOpen size={14} className="text-primary" />
                    ) : (
                      <QrCode size={14} className="text-secondary" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                      {item.interactionType === 'read' ? t('history.interaction.read') : t('history.interaction.scan')}
                    </span>
                  </div>
                  <h4 className="font-headline text-lg font-bold text-on-surface truncate group-hover:text-primary transition-colors">{item.title}</h4>
                  <p className="text-on-surface-variant text-sm truncate">{item.author}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-on-surface-variant">
                    {item.timestamp.toLocaleDateString()}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/60">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link 
                    to={`/book/${item.bookId}`}
                    className="p-3 bg-surface-container-highest text-primary rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95"
                    title={t('dashboard.view')}
                  >
                    <Eye size={20} />
                  </Link>
                  <button 
                    onClick={() => deleteHistoryItem(item.id)}
                    className="p-3 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                    title={t('history.action.delete')}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-[2.5rem] p-12 text-center border border-outline-variant/10">
          <div className="w-24 h-24 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant/20">
            <HistoryIcon size={48} />
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">{t('history.empty_title')}</h3>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">
            {t('history.empty_desc')}
          </p>
          <Link to="/catalog" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md">
            <BookOpen size={18} />
            {t('favorites.explore')}
          </Link>
        </div>
      )}
    </div>
  );
};

export default History;
