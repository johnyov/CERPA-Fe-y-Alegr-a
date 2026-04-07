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
import { analyzePdfFile, analyzePdfFromUrl } from '../services/pdfImportAnalysis';
import {
  CATEGORIES,
  CerpaCategory,
  getEducationalStageFromLevel,
  normalizeAcademicLevel,
  normalizeCerpaCategory,
  PRIMARIA_LEVELS,
  MEDIA_TECNICA_LEVELS,
} from '../constants';
import type { TranslationKey } from '../lib/translations';

const MATERIA_LABEL_KEY: Record<CerpaCategory, TranslationKey> = {
  General: 'add_book.category.general',
  'Valores y Ciudadanía': 'add_book.category.values',
  Empleabilidad: 'add_book.category.employability',
  'Ciencias I': 'add_book.category.science1',
  'Ciencias II': 'add_book.category.science2',
  'Lenguaje y Comunicación': 'add_book.category.language',
  Sociales: 'add_book.category.social',
  'Labor Social': 'add_book.category.labor_social',
  'Bienestar Socio Emocional': 'add_book.category.bienestar',
  Proyecto: 'add_book.category.proyecto',
  DPOSA: 'add_book.category.dposa',
};

type BulkCatalogRow = {
  file: File;
  coverUrl: string;
  totalPages: number;
  title: string;
  author: string;
  publisher: string;
  pages: number;
  category: CerpaCategory;
  academicLevel: string;
  educationalStage: string;
  year: number;
  description: string;
  isbn: string;
  language: string;
};

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
  const [analyzingLocalPdf, setAnalyzingLocalPdf] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isCancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pdfAnalysisAbortRef = useRef<AbortController | null>(null);
  
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: '' as 'uploading' | 'analyzing' | '' });
  const [bulkCatalogStep, setBulkCatalogStep] = useState<'pick' | 'review'>('pick');
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkCatalogRow[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    category: 'General',
    academicLevel: '3er Año',
    educationalStage: 'Media Técnica',
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
      pdfAnalysisAbortRef.current?.abort();
      setPassword('');
      setShowPassword(false);
      setError('');
      setPdfFile(null);
      setBulkFiles([]);
      setBulkCatalogStep('pick');
      setBulkPreviewRows([]);
      setImportMode('single');
      setAnalyzingLocalPdf(false);
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
      const { coverUrl, totalPages, metadata } = await analyzePdfFromUrl(file.url);

      if (metadata) {
        const academicLevel = normalizeAcademicLevel(metadata.academicLevel);
        const educationalStage =
          typeof metadata.educationalStage === 'string' &&
          (metadata.educationalStage === 'Primaria' || metadata.educationalStage === 'Media Técnica')
            ? metadata.educationalStage
            : getEducationalStageFromLevel(academicLevel) || 'Media Técnica';
        setFormData({
          title: metadata.title || file.name.replace('.pdf', ''),
          author: metadata.author || '',
          isbn: metadata.isbn || '',
          description: metadata.description || '',
          category: normalizeCerpaCategory(metadata.category),
          academicLevel,
          educationalStage,
          year: metadata.year || new Date().getFullYear(),
          pages:
            typeof metadata.pages === 'number' && metadata.pages > 0
              ? metadata.pages
              : totalPages,
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
          coverUrl: coverUrl || '',
          pages: totalPages || prev.pages
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
    const file = e.target.files?.[0];
    if (!file) return;

    pdfAnalysisAbortRef.current?.abort();
    const ac = new AbortController();
    pdfAnalysisAbortRef.current = ac;

    setPdfFile(file);
    setFormData(prev => ({
      ...prev,
      title: prev.title || file.name.replace('.pdf', ''),
    }));

    void (async () => {
      setAnalyzingLocalPdf(true);
      try {
        const { coverUrl, totalPages, metadata } = await analyzePdfFile(file, ac.signal);
        if (ac.signal.aborted) return;

        if (metadata) {
          setFormData(prev => {
            const academicLevel = normalizeAcademicLevel(
              metadata.academicLevel || prev.academicLevel
            );
            const educationalStage =
              typeof metadata.educationalStage === 'string' &&
              (metadata.educationalStage === 'Primaria' ||
                metadata.educationalStage === 'Media Técnica')
                ? metadata.educationalStage
                : getEducationalStageFromLevel(academicLevel) || 'Media Técnica';
            return {
              ...prev,
              title: metadata.title || file.name.replace('.pdf', ''),
              author: metadata.author || prev.author,
              isbn: metadata.isbn || prev.isbn,
              description: metadata.description || prev.description,
              category: normalizeCerpaCategory(metadata.category || prev.category),
              academicLevel,
              educationalStage,
              year: typeof metadata.year === 'number' ? metadata.year : prev.year,
              pages:
                typeof metadata.pages === 'number' && metadata.pages > 0
                  ? metadata.pages
                  : totalPages || prev.pages,
              language: metadata.language || prev.language,
              publisher: metadata.publisher || prev.publisher,
              coverUrl: coverUrl || prev.coverUrl,
            };
          });
        } else {
          setFormData(prev => ({
            ...prev,
            pages: totalPages || prev.pages,
            coverUrl: coverUrl || prev.coverUrl,
          }));
        }
      } catch (err) {
        if (err instanceof Error && (err.message === 'Aborted' || err.name === 'AbortError')) {
          return;
        }
        console.error('Error analyzing uploaded PDF:', err);
      } finally {
        if (!ac.signal.aborted) {
          setAnalyzingLocalPdf(false);
        }
      }
    })();

    e.target.value = '';
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
      setBulkFiles(prev => [...prev, ...newFiles]);
      setBulkCatalogStep('pick');
      setBulkPreviewRows([]);
      e.target.value = '';
    }
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearBulkFiles = () => {
    setBulkFiles([]);
    setBulkCatalogStep('pick');
    setBulkPreviewRows([]);
  };

  const updateBulkPreviewRow = (index: number, patch: Partial<BulkCatalogRow>) => {
    setBulkPreviewRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleBulkAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkFiles.length === 0) return;
    setLoading(true);
    isCancelledRef.current = false;
    setImportProgress({ current: 0, total: bulkFiles.length, phase: 'analyzing' });
    const rows: BulkCatalogRow[] = [];
    try {
      for (let i = 0; i < bulkFiles.length; i++) {
        if (isCancelledRef.current) break;
        setImportProgress((prev) => ({ ...prev, current: i + 1, phase: 'analyzing' }));
        const file = bulkFiles[i];
        let coverUrl = '';
        let totalPages = 0;
        let metadata = null as Awaited<ReturnType<typeof analyzePdfFile>>['metadata'];
        try {
          const result = await analyzePdfFile(file);
          coverUrl = result.coverUrl;
          totalPages = result.totalPages;
          metadata = result.metadata;
        } catch (err) {
          console.warn('Could not extract or analyze:', file.name, err);
        }
        const pages =
          metadata && typeof metadata.pages === 'number' && metadata.pages > 0
            ? metadata.pages
            : totalPages;
        const academicLevel = normalizeAcademicLevel(
          metadata?.academicLevel || t('add_book.imported_level')
        );
        const educationalStage =
          metadata &&
          typeof metadata.educationalStage === 'string' &&
          (metadata.educationalStage === 'Primaria' ||
            metadata.educationalStage === 'Media Técnica')
            ? metadata.educationalStage
            : getEducationalStageFromLevel(academicLevel) || 'Media Técnica';
        rows.push({
          file,
          coverUrl,
          totalPages,
          title: metadata?.title || file.name.replace(/\.pdf$/i, ''),
          author: metadata?.author || '',
          publisher: metadata?.publisher || '',
          pages,
          category: normalizeCerpaCategory(metadata?.category),
          academicLevel,
          educationalStage,
          year:
            typeof metadata?.year === 'number' ? metadata.year : new Date().getFullYear(),
          description: metadata?.description || '',
          isbn: metadata?.isbn || '',
          language: metadata?.language || 'Español',
        });
      }
      if (!isCancelledRef.current) {
        setBulkPreviewRows(rows);
        setBulkCatalogStep('review');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'books');
    } finally {
      setLoading(false);
      setImportProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleBulkConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkPreviewRows.length === 0) return;
    setLoading(true);
    isCancelledRef.current = false;
    setImportProgress({ current: 0, total: bulkPreviewRows.length, phase: 'uploading' });
    try {
      const booksRef = collection(db, 'books');
      for (let i = 0; i < bulkPreviewRows.length; i++) {
        if (isCancelledRef.current) break;
        const row = bulkPreviewRows[i];
        setImportProgress((prev) => ({ ...prev, current: i + 1, phase: 'uploading' }));

        let pdfUrl = '';
        try {
          const storageRef = ref(storage, `pdfs/${Date.now()}_${row.file.name}`);
          const uploadResult = await uploadBytes(storageRef, row.file);
          pdfUrl = await getDownloadURL(uploadResult.ref);
        } catch (uploadErr) {
          if (isCancelledRef.current) break;
          console.error('Upload failed for:', row.file.name, uploadErr);
          continue;
        }

        if (isCancelledRef.current) break;

        const category = normalizeCerpaCategory(row.category);
        const academicLevel = normalizeAcademicLevel(
          row.academicLevel || t('add_book.imported_level')
        );
        const educationalStage =
          row.educationalStage === 'Primaria' || row.educationalStage === 'Media Técnica'
            ? row.educationalStage
            : getEducationalStageFromLevel(academicLevel) || 'Media Técnica';
        await addDoc(booksRef, {
          title: row.title || row.file.name.replace(/\.pdf$/i, ''),
          author: row.author || t('add_book.imported_author'),
          category,
          academicLevel,
          educationalStage,
          publisher: row.publisher || 'N/A',
          description: row.description || '',
          year: row.year || new Date().getFullYear(),
          pages: row.pages > 0 ? row.pages : row.totalPages || 0,
          stock: 1,
          pdfUrl,
          isbn: row.isbn || '',
          language: row.language || 'Español',
          coverUrl:
            row.coverUrl ||
            'https://images.unsplash.com/photo-1543005157-86fc40027773?q=80&w=800&auto=format&fit=crop',
          createdAt: new Date().toISOString(),
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

      const academicLevel = normalizeAcademicLevel(formData.academicLevel);
      const educationalStage =
        formData.educationalStage === 'Primaria' ||
        formData.educationalStage === 'Media Técnica'
          ? formData.educationalStage
          : getEducationalStageFromLevel(academicLevel) || 'Media Técnica';
      const finalData = {
        ...formData,
        category: normalizeCerpaCategory(formData.category),
        academicLevel,
        educationalStage,
        pdfUrl: pdfUrl,
        createdAt: new Date().toISOString(),
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
        educationalStage: 'Media Técnica',
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
                  {(analyzingCloud || analyzingLocalPdf) && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Loader2 className="animate-spin" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-primary">
                          {analyzingCloud ? t('add_book.cloud.analyzing') : t('add_book.pdf.analyzing')}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {t('add_book.pdf.analyzing_sub')}
                        </p>
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
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.materia')}</label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: normalizeCerpaCategory(e.target.value),
                          })
                        }
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {t(MATERIA_LABEL_KEY[c])}
                          </option>
                        ))}
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
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                        {t('add_book.label.level_recommended')}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <select
                          value={formData.academicLevel}
                          onChange={(e) => {
                            const academicLevel = normalizeAcademicLevel(e.target.value);
                            setFormData({
                              ...formData,
                              academicLevel,
                              educationalStage:
                                getEducationalStageFromLevel(academicLevel) || 'Media Técnica',
                            });
                          }}
                          className="flex-1 w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                        >
                          <optgroup label={t('catalog.stage.primaria')}>
                            {PRIMARIA_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t('catalog.stage.media')}>
                            {MEDIA_TECNICA_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <span className="text-xs font-bold px-3 py-2 rounded-xl bg-secondary/15 text-secondary whitespace-nowrap">
                          {formData.educationalStage === 'Primaria'
                            ? t('catalog.stage.primaria')
                            : t('catalog.stage.media')}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.pages')}</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.pages || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pages: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">{t('add_book.label.year')}</label>
                      <input
                        type="number"
                        value={formData.year || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            year: parseInt(e.target.value, 10) || new Date().getFullYear(),
                          })
                        }
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
                      className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all min-h-[120px] resize-y"
                    />
                  </div>

                  {(pdfFile || formData.pdfUrl) && !analyzingLocalPdf && !analyzingCloud && (
                    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <Table size={18} />
                        <span className="text-sm font-bold">{t('add_book.catalog_preview_title')}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">{t('add_book.catalog_preview_hint')}</p>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.title')}</dt>
                          <dd className="text-on-surface mt-0.5">{formData.title || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.author')}</dt>
                          <dd className="text-on-surface mt-0.5">{formData.author || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.publisher')}</dt>
                          <dd className="text-on-surface mt-0.5">{formData.publisher || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.pages')}</dt>
                          <dd className="text-on-surface mt-0.5">{formData.pages > 0 ? formData.pages : '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.materia')}</dt>
                          <dd className="text-on-surface mt-0.5">{t(MATERIA_LABEL_KEY[normalizeCerpaCategory(formData.category)])}</dd>
                        </div>
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('book.label.educational_stage')}</dt>
                          <dd className="text-on-surface mt-0.5">
                            {formData.educationalStage === 'Primaria'
                              ? t('catalog.stage.primaria')
                              : t('catalog.stage.media')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.level')}</dt>
                          <dd className="text-on-surface mt-0.5">{formData.academicLevel || '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-on-surface-variant font-bold uppercase text-[10px]">{t('add_book.label.description')}</dt>
                          <dd className="text-on-surface mt-0.5 whitespace-pre-wrap line-clamp-6">{formData.description || '—'}</dd>
                        </div>
                      </dl>
                    </div>
                  )}

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
                      disabled={loading || analyzingLocalPdf || analyzingCloud}
                      className="flex-[2] py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                      {t('add_book.action.save')}
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={bulkCatalogStep === 'pick' ? handleBulkAnalyze : handleBulkConfirmSave}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    {bulkCatalogStep === 'pick' ? (
                      <>
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
                              'flex flex-col items-center justify-center gap-4 w-full bg-surface-container-highest border-2 border-dashed border-outline-variant/30 rounded-[2rem] py-12 px-4 text-sm text-on-surface-variant transition-all cursor-pointer',
                              loading
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:border-primary hover:text-primary'
                            )}
                          >
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                              <Upload size={32} />
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-base mb-1">{t('add_book.bulk_placeholder')}</p>
                              <p className="text-[10px] opacity-60 uppercase tracking-widest">
                                {t('add_book.import_info')}
                              </p>
                            </div>
                          </label>
                        </div>

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
                                    <div
                                      key={`${file.name}-${idx}`}
                                      className="flex items-center justify-between px-4 py-3 group hover:bg-primary/5 transition-colors"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                                          <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                          <p
                                            className="text-xs font-bold text-on-surface truncate"
                                            title={file.name}
                                          >
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
                                  {(bulkFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(
                                    2
                                  )}{' '}
                                  MB Total
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-lg font-bold text-on-surface">
                            {t('add_book.bulk_review_title')}
                          </h4>
                          <p className="text-xs text-on-surface-variant mt-1">
                            {t('add_book.bulk_review_hint')}
                          </p>
                        </div>
                        <div className="max-h-[min(52vh,420px)] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-primary/20">
                          {bulkPreviewRows.map((row, idx) => (
                            <div
                              key={`${row.file.name}-${idx}`}
                              className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3"
                            >
                              <div className="flex items-start gap-3">
                                {row.coverUrl ? (
                                  <img
                                    src={row.coverUrl}
                                    alt=""
                                    className="w-14 h-20 object-cover rounded-lg border border-outline-variant/20 shrink-0"
                                  />
                                ) : (
                                  <div className="w-14 h-20 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                    <FileText size={20} />
                                  </div>
                                )}
                                <p className="text-[10px] text-on-surface-variant break-all pt-1">
                                  {row.file.name}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.title')}
                                  </label>
                                  <input
                                    type="text"
                                    value={row.title}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, { title: e.target.value })
                                    }
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.author')}
                                  </label>
                                  <input
                                    type="text"
                                    value={row.author}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, { author: e.target.value })
                                    }
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.publisher')}
                                  </label>
                                  <input
                                    type="text"
                                    value={row.publisher}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, { publisher: e.target.value })
                                    }
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.pages')}
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={row.pages || ''}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, {
                                        pages: parseInt(e.target.value, 10) || 0,
                                      })
                                    }
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.level_recommended')}
                                  </label>
                                  <div className="flex flex-col xs:flex-row gap-2 items-stretch xs:items-center">
                                    <select
                                      value={row.academicLevel}
                                      onChange={(e) => {
                                        const academicLevel = normalizeAcademicLevel(e.target.value);
                                        updateBulkPreviewRow(idx, {
                                          academicLevel,
                                          educationalStage:
                                            getEducationalStageFromLevel(academicLevel) ||
                                            'Media Técnica',
                                        });
                                      }}
                                      className="flex-1 w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                    >
                                      <optgroup label={t('catalog.stage.primaria')}>
                                        {PRIMARIA_LEVELS.map((lvl) => (
                                          <option key={lvl} value={lvl}>
                                            {lvl}
                                          </option>
                                        ))}
                                      </optgroup>
                                      <optgroup label={t('catalog.stage.media')}>
                                        {MEDIA_TECNICA_LEVELS.map((lvl) => (
                                          <option key={lvl} value={lvl}>
                                            {lvl}
                                          </option>
                                        ))}
                                      </optgroup>
                                    </select>
                                    <span className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-secondary/15 text-secondary shrink-0 text-center">
                                      {row.educationalStage === 'Primaria'
                                        ? t('catalog.stage.primaria')
                                        : t('catalog.stage.media')}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.materia')}
                                  </label>
                                  <select
                                    value={row.category}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, {
                                        category: normalizeCerpaCategory(e.target.value),
                                      })
                                    }
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary"
                                  >
                                    {CATEGORIES.map((c) => (
                                      <option key={c} value={c}>
                                        {t(MATERIA_LABEL_KEY[c])}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    {t('add_book.label.description')}
                                  </label>
                                  <textarea
                                    value={row.description}
                                    onChange={(e) =>
                                      updateBulkPreviewRow(idx, { description: e.target.value })
                                    }
                                    rows={4}
                                    className="w-full bg-surface-container-highest border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-primary resize-y min-h-[80px]"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {loading && importProgress.total > 0 && (
                      <div className="space-y-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">
                              {importProgress.phase === 'analyzing'
                                ? t('add_book.bulk_analyzing', {
                                    current: importProgress.current,
                                    total: importProgress.total,
                                  })
                                : t('add_book.bulk_importing', {
                                    current: importProgress.current,
                                    total: importProgress.total,
                                  })}
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
                            animate={{
                              width: `${(importProgress.current / importProgress.total) * 100}%`,
                            }}
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
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsUnlocked(false)}
                      className="flex-1 py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                      disabled={loading}
                    >
                      {t('add_book.action.back')}
                    </button>
                    {bulkCatalogStep === 'review' && (
                      <button
                        type="button"
                        onClick={() => {
                          setBulkCatalogStep('pick');
                          setBulkPreviewRows([]);
                        }}
                        className="flex-1 py-4 text-sm font-bold text-on-surface hover:bg-surface-container-high rounded-xl transition-all border border-outline-variant/30"
                        disabled={loading}
                      >
                        {t('add_book.action.back_to_files')}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        (bulkCatalogStep === 'pick' ? bulkFiles.length === 0 : bulkPreviewRows.length === 0)
                      }
                      className="flex-[2] py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : bulkCatalogStep === 'pick' ? (
                        <Table size={20} />
                      ) : (
                        <Upload size={20} />
                      )}
                      {bulkCatalogStep === 'pick'
                        ? t('add_book.action.analyze_pdfs')
                        : t('add_book.action.confirm_catalog_save')}
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
