import React, { useEffect, useState } from 'react';
import { Download, Search, BookOpen, Trash2, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const Downloads = () => {
  const { t } = useLanguage();
  const [downloadedBooks, setDownloadedBooks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
    setDownloadedBooks(downloads);
  }, []);

  const removeDownload = (id: string) => {
    const downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
    const newDownloads = downloads.filter((d: any) => d.id !== id);
    localStorage.setItem('downloads', JSON.stringify(newDownloads));
    setDownloadedBooks(newDownloads);
  };

  const filteredDownloads = downloadedBooks.filter(book => 
    book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <Download size={24} />
            </div>
            <h2 className="font-headline text-4xl font-bold text-primary">{t('nav.downloads')}</h2>
          </div>
          <p className="text-on-surface-variant">{t('downloads.subtitle')}</p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('downloads.search.placeholder')}
            className="w-full bg-surface-container-high border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={20} />
        </div>
      </header>

      {filteredDownloads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDownloads.map((book) => (
            <div key={book.id} className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10 flex gap-4 group">
              <div className="w-24 h-32 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                <img 
                  src={book.coverUrl || `https://picsum.photos/seed/${book.id}/200/300`} 
                  alt={book.title} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <h4 className="font-bold text-on-surface line-clamp-2 mb-1">{book.title}</h4>
                  <p className="text-xs text-on-surface-variant italic">{book.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link 
                    to={`/book/${book.id}`}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                    title={t('downloads.view_book')}
                  >
                    <Eye size={16} />
                  </Link>
                  <Link 
                    to={`/book/${book.id}`}
                    state={{ openReader: true }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                    title={t('downloads.read_offline')}
                  >
                    <BookOpen size={14} /> {t('downloads.read_offline')}
                  </Link>
                  <button 
                    onClick={() => removeDownload(book.id)}
                    className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-auto"
                    title={t('downloads.remove')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-[2.5rem] p-12 text-center border border-outline-variant/10">
          <div className="w-24 h-24 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant/20">
            <Download size={48} />
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">{t('downloads.empty_title')}</h3>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">
            {t('downloads.empty_desc')}
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

export default Downloads;
