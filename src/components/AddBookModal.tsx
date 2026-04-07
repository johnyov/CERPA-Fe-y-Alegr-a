import React, { useState, useEffect, useRef } from 'react';
import { X, Book, Lock, Loader2, Plus, Eye, EyeOff, FileText, Upload, Trash2, AlertCircle, Database, Table, Search as SearchIcon, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { useLanguage } from '../contexts/LanguageContext';
import { useModal } from '../contexts/ModalContext';
import { cn } from '../lib/utils';
import { CATEGORIES } from '../constants';
import { extractTextFromPdf } from '../lib/pdf-utils';
import { analyzeBookMetadata } from '../services/geminiService';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isUnlocked, setIsUnlocked } = useModal();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [importMode, setImportMode] = useState<'single' | 'bulk' | 'warehouse' | 'cloud'>('single');
  const [warehouseBooks, setWarehouseBooks] = useState<any[]>([]);
  const [cloudFiles, setCloudFiles] = useState<any[]>([]);
  const [cloudSearch, setCloudSearch] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [analyzingCloud, setAnalyzingCloud] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isCancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: '' as 'uploading' | 'analyzing' | '' });
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    category: 'General',
    academicLevel: '3er Año',
    year: new Date().getFullYear(),
    pages: 0,
    language: 'Español',
    stock: 1,
    publisher: '',
    pdfUrl: '',
    coverUrl: ''
  });

  // Reset local state when modal closes, but KEEP isUnlocked (managed by context)
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setPdfFile(null);
      setBulkFiles([]);
      setImportMode('single');
    }
  }, [isOpen]);

  // Fetch warehouse books or cloud files when mode changes
  useEffect(() => {
    if (importMode === 'warehouse' && isUnlocked) {
      fetchWarehouseBooks();
    } else if (importMode === 'cloud' && isUnlocked) {
      fetchCloudFiles();
    }
  }, [importMode, isUnlocked]);

  const fetchCloudFiles = async () => {
    setCloudLoading(true);
    try {
      const listRef = ref(storage, 'pdfs/');
      const res = await listAll(listRef);
      const files = await Promise.all(res.items.map(async (item) => ({
        name: item.name,
        fullPath: item.fullPath,
        url: await getDownloadURL(item)
      })));
      setCloudFiles(files);
    } catch (err) {
      console.error("Error fetching cloud files:", err);
    } finally {
      setCloudLoading(false);
    }
  };

  const handleSelectCloudFile = async (file: any) => {
    setAnalyzingCloud(true);
    setImportMode('single');
    try {
      const { text, coverUrl, totalPages } = await extractTextFromPdf(file.url);
      const metadata = await analyzeBookMetadata(text, totalPages);
      
      if (metadata) {
        setFormData({
          title: metadata.title || file.name.replace('.pdf', ''),
          author: metadata.author || '',
          isbn: metadata.isbn || '',
          description: metadata.description || '',
          category: metadata.category || 'General',
          academicLevel: metadata.academicLevel || '3er Año',
          year: metadata.year || new Date().getFullYear(),
          pages: metadata.pages || 0,
          language: metadata.language || 'Español',
          stock: 1,
          publisher: metadata.publisher || '',
          pdfUrl: file.url,
          coverUrl: coverUrl || ''
        });
      } else {
        setFormData(prev => ({
          ...prev,
          title: file.name.replace('.pdf', ''),
          pdfUrl: file.url,
          coverUrl: coverUrl || ''
        }));
      }
    } catch (err) {
      console.error("Error analyzing cloud file:", err);
      setFormData(prev => ({
        ...prev,
        title: file.name.replace('.pdf', ''),
        pdfUrl: file.url
      }));
    } finally {
      setAnalyzingCloud(false);
    }
  };

  const fetchWarehouseBooks = async () => {
    setWarehouseLoading(true);
    try {
      const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const booksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWarehouseBooks(booksData);
    } catch (err) {
      console.error("Error fetching warehouse books:", err);
      handleFirestoreError(err, OperationType.GET, 'books');
    } finally {
      setWarehouseLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!bookToDelete) return;
    setWarehouseLoading(true);
    try {
      await deleteDoc(doc(db, 'books', bookToDelete.id));
      setWarehouseBooks(prev => prev.filter(b => b.id !== bookToDelete.id));
      setShowDeleteConfirm(false);
      setBookToDelete(null);
    } catch (err) {
      console.error("Error deleting book:", err);
      handleFirestoreError(err, OperationType.DELETE, `books/${bookToDelete.id}`);
    } finally {
      setWarehouseLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'enriqueyalegria.cerpas1955') {
      setIsUnlocked(true);
      setError('');
    } else {
      setError(t('add_book.error.password'));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      
      setFormData(prev => ({
        ...prev,
        title: prev.title || file.name.replace('.pdf', ''),
      }));
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
      setBulkFiles(prev => [...prev, ...newFiles]);
      // Reset input value to allow selecting same files again if needed
      e.target.value = '';
    }
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearBulkFiles = () => {
    setBulkFiles([]);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkFiles.length === 0) return;
    setLoading(true);
    isCancelledRef.current = false;
    setImportProgress({ current: 0, total: bulkFiles.length, phase: 'uploading' });
    try {
      const booksRef = collection(db, 'books');
      for (let i = 0; i < bulkFiles.length; i++) {
        if (isCancelledRef.current) break;
        setImportProgress(prev => ({ ...prev, current: i + 1, phase: 'uploading' }));
        const file = bulkFiles[i];
        
        // 1. Extract Text & Cover (Local)
        let pdfData = { text: '', coverUrl: '', totalPages: 0 };
        try {
          pdfData = await extractTextFromPdf(file);
        } catch (err) {
          console.warn("Could not extract text from:", file.name);
        }

        if (isCancelledRef.current) break;

        // 2. Analyze with AI (Gemini)
        setImportProgress(prev => ({ ...prev, phase: 'analyzing' }));
        let metadata = null;
        if (pdfData.text) {
          metadata = await analyzeBookMetadata(pdfData.text, pdfData.totalPages);
        }

        if (isCancelledRef.current) break;

        // 3. Upload to Firebase Storage
        setImportProgress(prev => ({ ...prev, phase: 'uploading' }));
        let pdfUrl = '';
        try {
          const storageRef = ref(storage, `pdfs/${Date.now()}_${file.name}`);
          const uploadResult = await uploadBytes(storageRef, file);
          pdfUrl = await getDownloadURL(uploadResult.ref);
        } catch (uploadErr) {
          if (isCancelledRef.current) break;
          console.error("Upload failed for:", file.name, uploadErr);
          continue;
        }

        if (isCancelledRef.current) break;

        // 4. Save to Firestore
        await addDoc(booksRef, {
          title: metadata?.title || file.name.replace('.pdf', ''),
          author: metadata?.author || t('add_book.imported_author'),
          category: metadata?.category || 'General',
          academicLevel: metadata?.academicLevel || t('add_book.imported_level'),
          publisher: metadata?.publisher || 'N/A',
          description: metadata?.description || '',
          year: metadata?.year || new Date().getFullYear(),
          pages: pdfData.totalPages || 0,
          stock: 1,
          pdfUrl: pdfUrl,
          coverUrl: pdfData.coverUrl || 'https://images.unsplash.com/photo-1543005157-86fc40027773?q=80&w=800&auto=format&fit=crop',
          createdAt: new Date().toISOString()
        });
      }
      if (!isCancelledRef.current) {
        onClose();
        navigate('/catalog');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'books');
    } finally {
      setLoading(false);
      setImportProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let pdfUrl = formData.pdfUrl;
      if (pdfFile) {
        const storageRef = ref(storage, `pdfs/${Date.now()}_${pdfFile.name}`);
        const uploadResult = await uploadBytes(storageRef, pdfFile);
        pdfUrl = await getDownloadURL(uploadResult.ref);
      }

      const finalData = {
        ...formData,
        pdfUrl: pdfUrl,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'books'), finalData);
      onClose();
      navigate('/catalog');
      setFormData({
        title: '',
        author: '',
        isbn: '',
        description: '',
        category: 'General',
        academicLevel: '3er Año',
        year: new Date().getFullYear(),
        pages: 0,
        language: 'Español',
        stock: 1,
        publisher: '',
        pdfUrl: '',
        coverUrl: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'books');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-container-low rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-outline-variant/10 overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Book size={24} />
            </div>
            <h3 className="text-2xl font-bold text-on-surface">{t('add_book.title')}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-8 max-h-[80vh] overflow-y-auto">
          {!isUnlocked ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-sm mx-auto text-center py-6 sm:py-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Lock size={24} />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-on-surface">{t('add_book.protected_access')}</h4>
              <p className="text-xs sm:text-sm text-on-surface-variant mb-6">{t('add_book.password_desc')}</p>
              <div className="space-y-2 text-left">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('add_book.password_placeholder')}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {error && <p className="text-xs text-red-500 font-bold ml-1">{error}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  {t('settings.action.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md"
                >
                  {t('add_book.verify')}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex p-1 bg-surface-container-highest rounded-xl">
                <button
                  onClick={() => setImportMode('single')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    importMode === 'single' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant"
                  )}
                >
                  {t('add_book.manual')}
                </button>
                <button
                  onClick={() => setImportMode('bulk')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    importMode === 'bulk' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant"
                  )}
                >
                  {t('add_book.bulk')}
                </button>
                <button
                  onClick={() => setImportMode('warehouse')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    importMode === 'warehouse' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant"
                  )}
                >
                  <Database size={14} />
                  {t('add_book.warehouse')}
                </button>
                <button
                  onClick={() => setImportMode('cloud')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    importMode === 'cloud' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant"
                  )}
                >
                  <Cloud size={14} />
                  {t('add_book.cloud')}
                </button>
              </div>

              {importMode === 'cloud' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">{t('add_book.cloud')}</h4>
                      <p className="text-xs text-on-surface-variant">{t('add_book.cloud_desc')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={fetchCloudFiles}
                        className="p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded-lg"
                      >
                        <Loader2 className={cn("w-5 h-5", cloudLoading && "animate-spin")} />
                      </button>
                      <div className="relative flex-1 sm:flex-none">
                        <input
                          type="text"
                          value={cloudSearch}
                          onChange={(e) => setCloudSearch(e.target.value)}
                          placeholder={t('topbar.search')}
                          className="bg-surface-container-highest border-none rounded-lg py-2 pl-8 pr-4 text-xs focus:ring-2 focus:ring-primary w-full sm:w-48"
                        />
                        <SearchIcon className="absolute left-2.5 top-2.5 text-on-surface-variant" size={14} />
                      </div>
                    </div>
                  </div>

                  <div className="border border-outline-variant/20 rounded-xl overflow-hidden bg-white shadow-inner">
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-surface-container-highest border-b border-outline-variant/20">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary">{t('add_book.label.title')}</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary text-center">{t('add_book.label.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {cloudLoading ? (
                            <tr>
                              <td colSpan={2} className="px-4 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="animate-spin text-primary" size={32} />
                                  <span className="text-sm font-medium text-on-surface-variant">{t('add_book.cloud.syncing')}</span>
                                </div>
                              </td>
                            </tr>
                          ) : cloudFiles.filter(f => f.name.toLowerCase().includes(cloudSearch.toLowerCase())).length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-4 py-20 text-center text-sm text-on-surface-variant italic bg-surface-container-lowest">
                                {t('add_book.cloud.empty')}
                              </td>
                            </tr>
                          ) : (
                            cloudFiles
                              .filter(f => f.name.toLowerCase().includes(cloudSearch.toLowerCase()))
                              .map((file, idx) => (
                                <tr 
                                  key={file.fullPath} 
                                  className={cn(
                                    "transition-colors group",
                                    idx % 2 === 0 ? "bg-white" : "bg-surface-container-lowest/30",
                                    "hover:bg-primary/5"
                                  )}
                                >
                                  <td className="px-4 py-3 text-xs font-bold text-on-surface">
                                    <div className="flex items-center gap-2">
                                      <FileText size={16} className="text-primary/60" />
                                      <div className="truncate max-w-[300px]" title={file.name}>{file.name}</div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => handleSelectCloudFile(file)}
                                      className="px-4 py-1.5 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-primary-container transition-all shadow-sm"
                                    >
                                      {t('add_book.action.import')}
                                    </button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsUnlocked(false)}
                      className="w-full py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                    >
                      {t('add_book.action.back')}
                    </button>
                  </div>
                </div>
              ) : importMode === 'warehouse' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">{t('add_book.warehouse')}</h4>
                      <p className="text-xs text-on-surface-variant">{t('add_book.warehouse_desc')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={fetchWarehouseBooks}
                        className="p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-primary/10 rounded-lg"
                        title={t('add_book.warehouse.refresh')}
                      >
                        <Loader2 className={cn("w-5 h-5", warehouseLoading && "animate-spin")} />
                      </button>
                      <div className="relative flex-1 sm:flex-none">
                        <input
                          type="text"
                          value={warehouseSearch}
                          onChange={(e) => setWarehouseSearch(e.target.value)}
                          placeholder={t('topbar.search')}
                          className="bg-surface-container-highest border-none rounded-lg py-2 pl-8 pr-4 text-xs focus:ring-2 focus:ring-primary w-full sm:w-48"
                        />
                        <SearchIcon className="absolute left-2.5 top-2.5 text-on-surface-variant" size={14} />
                      </div>
                    </div>
                  </div>

                  <div className="border border-outline-variant/20 rounded-xl overflow-hidden bg-white shadow-inner">
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-surface-container-highest border-b border-outline-variant/20">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border-r border-outline-variant/10">{t('add_book.label.title')}</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border-r border-outline-variant/10">{t('add_book.label.author')}</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border-r border-outline-variant/10">{t('add_book.label.category')}</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border-r border-outline-variant/10 text-center">{t('add_book.label.level')}</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary text-center">{t('add_book.label.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {warehouseLoading ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="animate-spin text-primary" size={32} />
                                  <span className="text-sm font-medium text-on-surface-variant">{t('add_book.warehouse.syncing')}</span>
                                </div>
                              </td>
                            </tr>
                          ) : warehouseBooks.filter(b => 
                              b.title?.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
                              b.author?.toLowerCase().includes(warehouseSearch.toLowerCase())
                            ).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-20 text-center text-sm text-on-surface-variant italic bg-surface-container-lowest">
                                {t('add_book.warehouse.empty')}
                              </td>
                            </tr>
                          ) : (
                            warehouseBooks
                              .filter(b => 
                                b.title?.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
                                b.author?.toLowerCase().includes(warehouseSearch.toLowerCase())
                              )
                              .map((book, idx) => (
                                <tr 
                                  key={book.id} 
                                  onClick={() => {
                                    onClose();
                                    navigate(`/book/${book.id}`);
                                  }}
                                  className={cn(
                                    "transition-colors group cursor-pointer",
                                    idx % 2 === 0 ? "bg-white" : "bg-surface-container-lowest/30",
                                    "hover:bg-primary/5"
                                  )}
                                >
                                  <td className="px-4 py-2.5 text-xs font-bold text-on-surface border-r border-outline-variant/5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                      <div className="truncate" title={book.title}>{book.title}</div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-on-surface-variant border-r border-outline-variant/5">
                                    <div className="truncate" title={book.author}>{book.author}</div>
                                  </td>
                                  <td className="px-4 py-2.5 text-[10px] font-bold border-r border-outline-variant/5">
                                    <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-md uppercase">
                                      {book.category}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-[10px] text-on-surface-variant border-r border-outline-variant/5 text-center">{book.academicLevel}</td>
                                  <td className="px-4 py-2.5 text-xs text-center">
                                    <div className="flex items-center justify-center gap-3">
                                      {book.pdfUrl && (
                                        <FileText size={16} className="text-green-600" />
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookToDelete(book);
                                          setShowDeleteConfirm(true);
                                        }}
                                        className="p-1.5 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title={t('add_book.action.delete')}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                      <Eye size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full py-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-100"
                    >
                      {t('settings.action.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUnlocked(false)}
                      className="w-full py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                    >
                      {t('add_book.action.back')}
                    </button>
                  </div>
                </div>
              ) : importMode === 'single' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {analyzingCloud && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Loader2 className="animate-spin" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-primary">{t('add_book.cloud.analyzing')}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Extrayendo metadatos y portada...</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.coverUrl && (
                      <div className="col-span-full flex justify-center mb-4">
                        <div className="relative group">
                          <img 
                            src={formData.coverUrl} 
                            alt="Cover Preview" 
                            className="w-32 h-44 object-cover rounded-lg shadow-lg border-2 border-primary/20" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest">{t('add_book.label.cover')}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.title')}</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.author')}</label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData({...formData, author: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.isbn')}</label>
                      <input
                        type="text"
                        value={formData.isbn}
                        onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.category')}</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      >
                        <option value="General">{t('add_book.category.general')}</option>
                        <option value="Valores y Ciudadanía">{t('add_book.category.values')}</option>
                        <option value="Empleabilidad">{t('add_book.category.employability')}</option>
                        <option value="Ciencias I">{t('add_book.category.science1')}</option>
                        <option value="Ciencias II">{t('add_book.category.science2')}</option>
                        <option value="Lenguaje y Comunicación">{t('add_book.category.language')}</option>
                        <option value="Sociales">{t('add_book.category.social')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.publisher')}</label>
                      <input
                        type="text"
                        value={formData.publisher}
                        onChange={(e) => setFormData({...formData, publisher: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.level')}</label>
                      <input
                        type="text"
                        value={formData.academicLevel}
                        onChange={(e) => setFormData({...formData, academicLevel: e.target.value})}
                        placeholder="Ej. 4to Grado"
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.import_pdf')}</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className="flex items-center justify-center gap-3 w-full bg-surface-container-highest border-2 border-dashed border-outline-variant/30 rounded-xl py-6 px-4 text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
                      >
                        {pdfFile ? (
                          <>
                            <FileText size={24} className="text-primary" />
                            <span className="font-bold">{pdfFile.name}</span>
                          </>
                        ) : (
                          <>
                            <Upload size={24} />
                            <span className="font-medium">{t('add_book.placeholder.pdf')}</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.description')}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all h-24 resize-none"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      {t('settings.action.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUnlocked(false)}
                      className="flex-1 py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                    >
                      {t('add_book.action.back')}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                      {t('add_book.action.save')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBulkSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                        {t('add_book.bulk')}
                      </label>
                      {bulkFiles.length > 0 && !loading && (
                        <button
                          type="button"
                          onClick={clearBulkFiles}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors"
                        >
                          {t('add_book.action.delete')} {t('catalog.filter.all')}
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleBulkFileChange}
                        className="hidden"
                        id="bulk-pdf-upload"
                        disabled={loading}
                      />
                      <label
                        htmlFor="bulk-pdf-upload"
                        className={cn(
                          "flex flex-col items-center justify-center gap-4 w-full bg-surface-container-highest border-2 border-dashed border-outline-variant/30 rounded-[2rem] py-12 px-4 text-sm text-on-surface-variant transition-all cursor-pointer",
                          loading ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:text-primary"
                        )}
                      >
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                          <Upload size={32} />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-base mb-1">
                            {t('add_book.bulk_placeholder')}
                          </p>
                          <p className="text-[10px] opacity-60 uppercase tracking-widest">{t('add_book.import_info')}</p>
                        </div>
                      </label>
                    </div>

                    {/* Selected Files List */}
                    <AnimatePresence>
                      {bulkFiles.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden"
                        >
                          <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                            <div className="divide-y divide-outline-variant/10">
                              {bulkFiles.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="flex items-center justify-between px-4 py-3 group hover:bg-primary/5 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                                      <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-on-surface truncate" title={file.name}>
                                        {file.name}
                                      </p>
                                      <p className="text-[10px] text-on-surface-variant">
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                      </p>
                                    </div>
                                  </div>
                                  {!loading && (
                                    <button
                                      type="button"
                                      onClick={() => removeBulkFile(idx)}
                                      className="p-2 text-on-surface-variant hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-surface-container-highest px-4 py-2 flex justify-between items-center border-t border-outline-variant/20">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                              {bulkFiles.length} {t('add_book.files_selected')}
                            </span>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                              {(bulkFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB Total
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Progress Bar */}
                    {loading && (
                      <div className="space-y-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">
                              {t('add_book.bulk_importing', { current: importProgress.current, total: importProgress.total })}
                              {importProgress.phase === 'analyzing' && <span className="ml-2 text-primary/60">({t('add_book.cloud.analyzing')})</span>}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-primary">
                            {Math.round((importProgress.current / importProgress.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-primary" 
                            initial={{ width: 0 }}
                            animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="px-6 py-2 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-red-500 hover:text-white transition-all"
                          >
                            {t('settings.action.cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
                        <AlertCircle size={16} />
                        <p className="text-xs font-bold">{error}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsUnlocked(false)}
                      className="flex-1 py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                      disabled={loading}
                    >
                      {t('add_book.action.back')}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || bulkFiles.length === 0}
                      className="flex-[2] py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                      {t('add_book.action.import')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-outline-variant/10 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{t('add_book.modal.delete_title')}</h3>
              <p className="text-sm text-on-surface-variant mb-8">
                {t('add_book.modal.delete_desc', { title: bookToDelete?.title })}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setBookToDelete(null);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  {t('settings.action.cancel')}
                </button>
                <button 
                  onClick={handleDeleteBook}
                  className="flex-1 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md active:scale-95"
                >
                  {t('add_book.action.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-outline-variant/10 text-center"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{t('add_book.modal.cancel_title')}</h3>
              <p className="text-sm text-on-surface-variant mb-8">
                {t('add_book.modal.cancel_desc')}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  {t('add_book.action.no_continue')}
                </button>
                <button 
                  onClick={() => {
                    isCancelledRef.current = true;
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    setShowCancelConfirm(false);
                    setLoading(false);
                    onClose();
                  }}
                  className="flex-1 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md active:scale-95"
                >
                  {t('add_book.action.yes_cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
