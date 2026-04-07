import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Search, BookOpen, Eye, Download, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { handleBookDownload } from '../lib/download-utils';

const Favorites = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'favorites'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const favoritesData = [];
      for (const favoriteDoc of snapshot.docs) {
        const data = favoriteDoc.data();
        const bookRef = doc(db, 'books', data.bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
          favoritesData.push({
            id: favoriteDoc.id,
            bookId: data.bookId,
            ...bookSnap.data()
          });
        }
      }
      setFavorites(favoritesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredFavorites = favorites.filter(book => 
    book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <Heart size={24} fill="currentColor" />
            </div>
            <h2 className="font-headline text-4xl font-bold text-primary">{t('nav.favorites')}</h2>
          </div>
          <p className="text-on-surface-variant">{t('favorites.subtitle')}</p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('favorites.search.placeholder')}
            className="w-full bg-surface-container-high border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={20} />
        </div>
      </header>

      {filteredFavorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredFavorites.map((book, i) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-surface-container-lowest rounded-xl overflow-hidden transition-all duration-300 hover:bg-surface-container-high border-b-4 border-transparent hover:border-primary shadow-sm"
            >
              <div className="aspect-[3/4] relative overflow-hidden bg-surface-variant">
                <img 
                  src={book.coverUrl || `https://picsum.photos/seed/${book.bookId}/400/600`} 
                  alt={book.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6">
                <h4 className="font-headline text-xl font-bold text-on-surface mb-1 group-hover:tracking-wider transition-all line-clamp-1">{book.title}</h4>
                <p className="text-on-surface-variant text-sm mb-4">Por {book.author}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    to={`/book/${book.bookId}`}
                    className="py-2.5 px-4 bg-surface-container-highest text-on-surface font-bold text-xs rounded-lg hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={14} /> {t('catalog.details')}
                  </Link>
                  <button 
                    onClick={() => handleBookDownload(book)}
                    className="py-2.5 px-4 bg-primary text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> {t('catalog.download')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-[2.5rem] p-12 text-center border border-outline-variant/10">
          <div className="w-24 h-24 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant/20">
            <Heart size={48} />
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">{t('favorites.empty_title')}</h3>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">
            {t('favorites.empty_desc')}
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

export default Favorites;
