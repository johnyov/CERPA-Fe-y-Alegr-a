import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Download, 
  BookOpen, 
  Hash, 
  ChevronRight,
  ArrowRight,
  Volume2,
  Loader2,
  Heart
} from 'lucide-react';
import { cn } from '../lib/utils';
import { speakText } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { PdfViewer } from '../components/PdfViewer';
import { handleBookDownload } from '../lib/download-utils';
import { useAuth } from '../contexts/AuthContext';

export const BookDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [book, setBook] = useState<any>(null);
  const [relatedBooks, setRelatedBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'details' | 'reader'>('details');
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.openReader) {
      setViewMode('reader');
    }
  }, [location.state]);

  useEffect(() => {
    const checkDownloaded = () => {
      const downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
      setIsDownloaded(downloads.some((d: any) => d.id === id));
    };
    checkDownloaded();
  }, [id]);

  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !id) return;
      const q = query(
        collection(db, 'favorites'),
        where('uid', '==', user.uid),
        where('bookId', '==', id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setIsFavorite(true);
        setFavoriteId(snap.docs[0].id);
      } else {
        setIsFavorite(false);
        setFavoriteId(null);
      }
    };
    checkFavorite();
  }, [id, user]);

  const handleToggleFavorite = async () => {
    if (!user || !id) return;
    
    try {
      if (isFavorite && favoriteId) {
        await deleteDoc(doc(db, 'favorites', favoriteId));
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const docRef = await addDoc(collection(db, 'favorites'), {
          uid: user.uid,
          bookId: id,
          timestamp: serverTimestamp()
        });
        setIsFavorite(true);
        setFavoriteId(docRef.id);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const recordReadingHistory = async () => {
    if (!user || !id) return;
    try {
      await addDoc(collection(db, 'scans'), {
        uid: user.uid,
        bookId: id,
        timestamp: serverTimestamp(),
        type: 'read'
      });
    } catch (error) {
      console.error("Error recording history:", error);
    }
  };

  useEffect(() => {
    if (viewMode === 'reader') {
      recordReadingHistory();
    }
  }, [viewMode]);

  const handleDownload = () => {
    if (!book) return;
    handleBookDownload(book);
    setIsDownloaded(true);
  };

  useEffect(() => {
    const fetchBook = async () => {
      if (!id) return;
      const docRef = doc(db, 'books', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const bookData = { id: docSnap.id, ...docSnap.data() } as any;
        setBook(bookData);
        
        // Fetch related books
        if (bookData.category) {
          const q = query(
            collection(db, 'books'), 
            where('category', '==', bookData.category),
            limit(6)
          );
          const relatedSnap = await getDocs(q);
          const related = relatedSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(b => b.id !== id)
            .slice(0, 5);
          setRelatedBooks(related);
        }
      }
      setLoading(false);
    };
    fetchBook();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  if (!book) return <div className="text-center py-20">{t('book.not_found')}</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant mb-12">
        <button onClick={() => navigate('/catalog')} className="hover:text-primary transition-colors">{t('book.breadcrumb.library')}</button>
        <ChevronRight size={14} />
        <span className="hover:text-primary transition-colors">{book.category || 'Sin Categoría'}</span>
        <ChevronRight size={14} />
        <span className="font-bold text-primary">{book.title}</span>
      </nav>

      <div className="flex gap-4 pt-4 mb-8">
        <button 
          onClick={() => setViewMode('details')}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all",
            viewMode === 'details' ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
          )}
        >
          {t('book.section.details')}
        </button>
        <button 
          onClick={() => setViewMode('reader')}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all",
            viewMode === 'reader' ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
          )}
        >
          {t('book.action.read_online')}
        </button>
      </div>

      {viewMode === 'details' ? (
        <>
          <div className="grid lg:grid-cols-12 gap-16 items-start mb-24">
            <div className="lg:col-span-5 relative group">
              <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-xl transition-all duration-500 group-hover:scale-[1.02]">
                <img 
                  src={book.coverUrl || `https://picsum.photos/seed/${book.id}/800/1200`} 
                  alt={book.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10"></div>
            </div>

            <div className="lg:col-span-7">
              <div className="mb-8">
                <div className="flex flex-wrap gap-3 mb-6">
                  <span className="px-4 py-1.5 bg-secondary-fixed text-on-secondary-fixed-variant font-label text-xs font-bold rounded-full uppercase tracking-wider">
                    {book.category === 'General' ? t('add_book.category.general') :
                     book.category === 'Valores y Ciudadanía' ? t('add_book.category.values') :
                     book.category === 'Empleabilidad' ? t('add_book.category.employability') :
                     book.category === 'Ciencias I' ? t('add_book.category.science1') :
                     book.category === 'Ciencias II' ? t('add_book.category.science2') :
                     book.category === 'Lenguaje y Comunicación' ? t('add_book.category.language') :
                     book.category === 'Sociales' ? t('add_book.category.social') : (book.category || t('catalog.no_category'))}
                  </span>
                </div>
                <h1 className="font-headline text-3xl sm:text-5xl lg:text-6xl text-primary font-extrabold tracking-tight leading-tight mb-4">{book.title}</h1>
                <p className="font-headline text-xl sm:text-2xl italic text-on-surface-variant mb-6">{book.author}</p>
                
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-label text-on-surface-variant">
                  <span className="flex items-center gap-2">
                    <Hash className="text-primary" size={16} />
                    {t('book.label.isbn')}: {book.isbn || 'N/A'}
                  </span>
                  <span className="flex items-center gap-2">
                    <BookOpen className="text-primary" size={16} />
                    {book.stock || 0} {t('book.label.stock')}
                  </span>
                  {book.academicLevel && (
                    <span className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full font-bold text-[10px] uppercase">
                      {book.academicLevel}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button 
                  onClick={handleDownload}
                  className={cn(
                    "flex-1 py-5 px-8 rounded-lg font-bold text-lg tracking-wide flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                    isDownloaded 
                      ? "bg-green-600 text-white shadow-green-500/20" 
                      : "bg-gradient-to-r from-primary to-primary-container text-white shadow-primary/20 hover:opacity-90"
                  )}
                >
                  <Download size={20} />
                  {isDownloaded ? t('book.action.downloaded') : t('book.action.download')}
                </button>
                <button 
                  onClick={() => setViewMode('reader')}
                  className="flex-1 py-5 px-8 bg-surface-container-highest text-primary font-bold text-lg rounded-lg flex items-center justify-center gap-3 transition-all hover:bg-surface-variant active:scale-95"
                >
                  <BookOpen size={20} />
                  {t('book.action.read_online')}
                </button>
                <button 
                  onClick={handleToggleFavorite}
                  className={cn(
                    "py-5 px-8 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                    isFavorite 
                      ? "bg-red-500 text-white shadow-red-500/20" 
                      : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                  )}
                >
                  <Heart size={20} className={cn(isFavorite && "fill-current")} />
                  {t('book.action.favorite')}
                </button>
              </div>

              <div className="bg-surface-container-low p-8 rounded-xl relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-headline text-xl font-bold text-primary">{t('book.section.summary')}</h3>
                  <button 
                    onClick={() => speakText(book.description || t('book.summary.voice_empty'))}
                    className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                    title="Escuchar resumen"
                  >
                    <Volume2 size={20} />
                  </button>
                </div>
                <p className="text-on-surface-variant leading-relaxed mb-6 font-body">
                  {book.description || t('book.summary.empty')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-6 border-t border-outline-variant/30">
                  <div>
                    <p className="text-xs font-bold text-primary uppercase mb-1">{t('book.label.publisher')}</p>
                    <p className="text-sm">{book.publisher || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase mb-1">{t('book.label.year')}</p>
                    <p className="text-sm">{book.year || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase mb-1">{t('book.label.pages')}</p>
                    <p className="text-sm">{book.pages || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase mb-1">{t('book.label.language')}</p>
                    <p className="text-sm">{book.language || 'Español'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface-container-low rounded-3xl p-8 min-h-[800px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline text-2xl font-bold text-primary">{book.title}</h3>
            <button 
              onClick={() => setViewMode('details')}
              className="px-4 py-2 bg-surface-container-highest text-on-surface-variant font-bold rounded-lg hover:bg-surface-variant transition-colors"
            >
              {t('book.action.close_reader')}
            </button>
          </div>
          
          {book.pdfUrl ? (
            <PdfViewer url={book.pdfUrl} title={book.title} />
          ) : (
            <div className="flex-1 bg-surface-container-highest rounded-xl flex items-center justify-center border-2 border-dashed border-outline-variant/30">
              <div className="text-center p-12">
                <BookOpen size={64} className="mx-auto mb-4 text-primary/20" />
                <p className="text-on-surface-variant font-medium">{t('book.reader.not_available')}</p>
                <p className="text-xs text-on-surface-variant/60 mt-2">{t('book.reader.import_hint')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {relatedBooks.length > 0 && (
        <section className="mt-32">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-headline text-4xl text-primary font-bold mb-2">{t('book.section.related')}</h2>
              <div className="h-1 w-24 bg-primary"></div>
            </div>
            <button onClick={() => navigate('/catalog')} className="text-primary font-bold text-sm flex items-center gap-1 group">
              {t('book.action.view_all')}
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {relatedBooks.map(relBook => (
              <Link key={relBook.id} to={`/book/${relBook.id}`} className="group cursor-pointer">
                <div className="aspect-[3/4] bg-surface-container rounded-lg overflow-hidden mb-4 transition-all group-hover:bg-surface-container-high shadow-sm">
                  <img 
                    src={relBook.coverUrl || `https://picsum.photos/seed/${relBook.id}/300/400`} 
                    alt={relBook.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                </div>
                <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors line-clamp-1">{relBook.title}</h4>
                <p className="text-xs text-on-surface-variant italic line-clamp-1">{relBook.author}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
