import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Search, 
  QrCode, 
  Download, 
  Eye, 
  Star,
  Filter,
  Grid,
  List as ListIcon,
  BookOpen,
  Lightbulb
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { CATEGORIES, PRIMARIA_LEVELS, MEDIA_TECNICA_LEVELS } from '../constants';
import { handleBookDownload } from '../lib/download-utils';

import { useAuth } from '../contexts/AuthContext';

export const Catalog = () => {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [books, setBooks] = useState<any[]>([]);
  const [filter, setFilter] = useState('Todos');
  const [academicLevel, setAcademicLevel] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const tips = [
    t('catalog.tip.1'),
    t('catalog.tip.2'),
    t('catalog.tip.3'),
    t('catalog.tip.4')
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'books'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(booksData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'books');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [tips.length]);

  const filteredBooks = books.filter(book => {
    const title = book.title || '';
    const author = book.author || '';
    const matchesCategory = filter === 'Todos' || book.category === filter;
    const matchesLevel = academicLevel === 'Todos' || book.academicLevel === academicLevel;
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesLevel && matchesSearch;
  });

  // Dynamic recommendations
  const recommendedBooks = books
    .filter(book => {
      if (userData?.role === 'student' && userData?.grade) {
        // If student, recommend books for their grade
        return book.academicLevel === userData.grade;
      }
      if (userData?.role === 'teacher') {
        // If teacher, recommend maybe higher level or specific categories
        return book.category === 'DPOSA' || book.category === 'Proyecto';
      }
      return true;
    })
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  const categories = ['Todos', ...CATEGORIES];
  const primariaLevels = PRIMARIA_LEVELS;
  const mediaTecnicaLevels = MEDIA_TECNICA_LEVELS;

  return (
    <div className="editorial-asymmetry">
      <section className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-3xl sm:text-5xl font-bold tracking-tight text-primary mb-2">{t('catalog.title')}</h2>
          <p className="font-body text-on-surface-variant text-base sm:text-lg max-w-2xl">{t('catalog.subtitle')}</p>
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('catalog.search.placeholder')}
            className="w-full bg-surface-container-high border-none rounded-2xl py-3 sm:py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all shadow-sm"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="md:col-span-2 bg-primary/5 rounded-3xl p-8 flex items-center gap-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Lightbulb size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">{t('catalog.tip_of_day')}</span>
            </div>
            <p className="text-xl font-headline font-bold text-on-surface leading-tight">
              "{tips[currentTipIndex]}"
            </p>
          </div>
          <img 
            src="https://picsum.photos/seed/reading/400/200" 
            alt="Reading" 
            className="absolute right-0 top-0 h-full w-1/3 object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="bg-secondary/5 rounded-3xl p-8 flex flex-col justify-center">
          <h4 className="text-sm font-bold text-secondary mb-1">{t('catalog.digital_resources')}</h4>
          <p className="text-xs text-on-surface-variant">{t('catalog.digital_resources_desc')}</p>
        </div>
      </div>

      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="font-headline text-3xl font-bold text-primary">{t('catalog.featured')}</h3>
          
          <div className="flex flex-wrap gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/10">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  filter === cat 
                    ? "bg-primary text-white shadow-md" 
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {cat === 'Todos' ? t('catalog.filter.all') : (
                  cat === 'General' ? t('add_book.category.general') :
                  cat === 'Valores y Ciudadanía' ? t('add_book.category.values') :
                  cat === 'Empleabilidad' ? t('add_book.category.employability') :
                  cat === 'Ciencias I' ? t('add_book.category.science1') :
                  cat === 'Ciencias II' ? t('add_book.category.science2') :
                  cat === 'Lenguaje y Comunicación' ? t('add_book.category.language') :
                  cat === 'Sociales' ? t('add_book.category.social') : cat
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredBooks.length > 0 ? filteredBooks.map((book, i) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-surface-container-lowest rounded-xl overflow-hidden transition-all duration-300 hover:bg-surface-container-high border-b-4 border-transparent hover:border-primary"
            >
              <div className="aspect-[3/4] relative overflow-hidden bg-surface-variant">
                <img 
                  src={book.coverUrl || `https://picsum.photos/seed/${book.id}/400/600`} 
                  alt={book.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
              </div>
              <div className="p-6">
                <h4 className="font-headline text-xl font-bold text-on-surface mb-1 group-hover:tracking-wider transition-all">{book.title}</h4>
                <p className="text-on-surface-variant text-sm mb-4">Por {book.author}</p>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
                    <BookOpen size={14} />
                    {book.stock || 0} {t('catalog.stock')}
                  </div>
                  <div className="h-1 w-1 bg-outline-variant rounded-full"></div>
                  <div className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-tighter">
                    {book.category === 'General' ? t('add_book.category.general') :
                     book.category === 'Valores y Ciudadanía' ? t('add_book.category.values') :
                     book.category === 'Empleabilidad' ? t('add_book.category.employability') :
                     book.category === 'Ciencias I' ? t('add_book.category.science1') :
                     book.category === 'Ciencias II' ? t('add_book.category.science2') :
                     book.category === 'Lenguaje y Comunicación' ? t('add_book.category.language') :
                     book.category === 'Sociales' ? t('add_book.category.social') : (book.category || t('catalog.no_category'))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {book.academicLevel && (
                    <div className="px-3 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-bold uppercase inline-block">
                      {book.academicLevel}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    to={`/book/${book.id}`}
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
          )) : (
            <div className="col-span-full p-12 text-center text-on-surface-variant">
              {t('catalog.no_books')}
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface-container-low rounded-2xl p-10 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h3 className="font-headline text-3xl font-bold text-primary mb-8">{t('catalog.recommended')}</h3>
          <div className="flex flex-col md:flex-row gap-8">
            {recommendedBooks.length > 0 ? recommendedBooks.map((book) => (
              <Link 
                key={book.id}
                to={`/book/${book.id}`}
                className="flex-1 flex gap-6 items-center p-4 bg-surface-container-lowest rounded-xl group cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="w-24 h-32 flex-shrink-0 bg-surface-variant rounded shadow-sm overflow-hidden">
                  <img 
                    src={book.coverUrl || `https://picsum.photos/seed/${book.id}/200/300`} 
                    alt={book.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
                <div>
                  <h5 className="font-headline text-lg font-bold text-on-surface leading-tight group-hover:text-primary transition-colors">{book.title}</h5>
                  <p className="text-on-surface-variant text-sm">{book.author}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Star size={14} className="text-primary fill-primary" />
                    <span className="text-xs font-bold text-primary">4.9</span>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="w-full text-center py-8 text-on-surface-variant">
                {t('catalog.no_books')}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
