import React, { useState } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Moon, 
  Sun, 
  HelpCircle, 
  ChevronRight,
  Mail,
  Camera,
  LogOut,
  Smartphone,
  Database,
  IdCard,
  Settings as SettingsIcon,
  BookOpen,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteAccount as firebaseDeleteAccount } from '../services/authService';

export const Settings = () => {
  const { userData, user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { language, setLanguage, getLanguageLabel, t } = useLanguage();
  const [notifications, setNotifications] = useState(userData?.notifications ?? true);
  const [updatingRole, setUpdatingRole] = useState(false);

  const handleToggleNotifications = async () => {
    if (!user) return;
    const newValue = !notifications;
    setNotifications(newValue);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { notifications: newValue });
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editName, setEditName] = useState(userData?.displayName || '');
  const [editPhoto, setEditPhoto] = useState(userData?.photoUrl || '');
  const [editGrade, setEditGrade] = useState(userData?.grade || '');
  const [editSection, setEditSection] = useState(userData?.section || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const primariaLevels = ['1er Grado', '2do Grado', '3er Grado', '4to Grado', '5to Grado', '6to Grado'];
  const mediaTecnicaLevels = ['1er Año', '2do Año', '3er Año', '4to Año', '5to Año'];

  const handleUpdateRole = async (newRole: string) => {
    if (!user) return;
    setUpdatingRole(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updates: any = { role: newRole };
      // Clear grade if not student
      if (newRole !== 'student') {
        updates.grade = '';
      }
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        displayName: editName,
        photoUrl: editPhoto,
        grade: editGrade,
        section: editSection
      });
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await firebaseDeleteAccount();
    } catch (error: any) {
      if (error.message === 'REAUTH_REQUIRED') {
        setDeleteError(t('settings.error.reauth'));
      } else {
        setDeleteError(error.message || t('settings.error.delete_failed'));
      }
      setIsDeleting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhoto(reader.result as string);
        // If not in modal, save immediately
        if (!showEditModal && user) {
          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, { photoUrl: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = () => {
    setEditName(userData?.displayName || '');
    setEditPhoto(userData?.photoUrl || '');
    setEditGrade(userData?.grade || '');
    setEditSection(userData?.section || '');
    setShowEditModal(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim() || !user) return;
    
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        uid: user.uid,
        userEmail: user.email,
        text: reportText,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setReportSuccess(true);
      setReportText('');
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
      }, 2000);
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const sections = [
    {
      title: '',
      items: [
        { 
          icon: Mail, 
          label: t('settings.item.email'), 
          description: t('settings.item.email.desc'), 
          action: t('settings.action.verified') 
        },
        { 
          icon: IdCard, 
          label: t('settings.item.role'), 
          description: userData?.role ? t(`settings.role.${userData.role}` as any) : t('settings.role.student'),
          isRoleSelector: true
        },
      ]
    },
    {
      title: t('settings.section.preferences'),
      items: [
        { 
          icon: darkMode ? Moon : Sun, 
          label: t('settings.item.dark_mode'), 
          description: t('settings.item.dark_mode.desc'),
          toggle: true,
          value: darkMode,
          onToggle: toggleDarkMode
        },
        { 
          icon: Bell, 
          label: t('settings.item.notifications'), 
          description: t('settings.item.notifications.desc'),
          toggle: true,
          value: notifications,
          onToggle: handleToggleNotifications
        },
        { 
          icon: Globe, 
          label: t('settings.item.language'), 
          description: getLanguageLabel(language), 
          action: t('settings.action.change'),
          onClick: () => setShowLanguageModal(true)
        },
        { 
          icon: FileText, 
          label: t('settings.item.reports'), 
          description: t('settings.item.reports.desc'),
          onClick: () => setShowReportModal(true)
        },
      ]
    },
    {
      title: t('settings.section.security'),
      items: [
        { icon: Shield, label: t('settings.item.privacy'), description: t('settings.item.privacy.desc') },
        { icon: Database, label: t('settings.item.storage'), description: t('settings.item.storage.desc') },
        { 
          icon: Shield, 
          label: t('settings.item.delete_account'), 
          description: t('settings.item.delete_account.desc'),
          onClick: () => setShowDeleteConfirm(true),
          isDanger: true
        },
      ]
    },
    {
      title: t('settings.section.support'),
      items: [
        { icon: HelpCircle, label: t('settings.item.help'), description: t('settings.item.help.desc') },
        { 
          icon: BookOpen, 
          label: t('settings.item.credits'), 
          description: t('settings.item.credits.desc'),
          onClick: () => setShowCreditsModal(true)
        },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <SettingsIcon size={24} />
          </div>
          <h2 className="font-headline text-2xl sm:text-4xl font-bold text-primary">{t('settings.title')}</h2>
        </div>
        <p className="text-sm sm:text-base text-on-surface-variant">{t('settings.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Profile Summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface-container-low rounded-3xl p-6 sm:p-8 text-center border border-outline-variant/10 shadow-sm">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-full h-full rounded-full bg-surface-container-highest overflow-hidden border-4 border-primary/10 shadow-inner">
                {userData?.photoUrl ? (
                  <img src={userData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary">
                    <User size={48} />
                  </div>
                )}
              </div>
              <label className="absolute bottom-1 right-1 p-2.5 bg-primary text-white rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer">
                <Camera size={18} />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            
            <h3 className="font-headline text-2xl font-bold text-on-surface mb-1">{userData?.displayName || t('settings.placeholder.user')}</h3>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full">
                {userData?.role ? t(`settings.role.${userData.role}` as any) : t('settings.role.student')}
              </div>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={openEditModal}
                className="w-full py-3 px-4 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary-container transition-all shadow-md active:scale-[0.98]"
              >
                {t('settings.action.edit')}
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-3 px-4 text-red-500 font-bold text-sm rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> {t('nav.logout')}
              </button>
            </div>
          </div>

          <div className="mt-6 p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <h4 className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">{t('settings.status.server')}</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-on-surface-variant">{t('settings.status.version')}</span>
                <span className="font-mono bg-surface-container-highest px-2 py-0.5 rounded text-primary">v1.2.4-beta</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-on-surface-variant">{t('settings.status.server')}</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-600 dark:text-green-400">{t('settings.status.online')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="lg:col-span-2 space-y-8">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-4">
              <h3 className="font-label text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 ml-4">
                {section.title}
              </h3>
              <div className="bg-surface-container-low rounded-[2rem] overflow-hidden border border-outline-variant/10 shadow-sm">
                {section.items.map((item, iIdx) => (
                  <div 
                    key={iIdx}
                    className={cn(
                      "flex items-center justify-between p-5 hover:bg-surface-container-high transition-all cursor-pointer group",
                      iIdx !== section.items.length - 1 && "border-b border-outline-variant/5"
                    )}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                    }}
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform",
                        item.isDanger ? "bg-red-500/10 text-red-500" : "bg-surface-container-highest text-primary"
                      )}>
                        <item.icon size={22} />
                      </div>
                      <div>
                        <h4 className={cn(
                          "text-sm font-bold mb-0.5",
                          item.isDanger ? "text-red-500" : "text-on-surface"
                        )}>{item.label}</h4>
                        <p className="text-xs text-on-surface-variant">{item.description}</p>
                      </div>
                    </div>
                    
                    {item.toggle ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onToggle?.();
                        }}
                        className={cn(
                          "w-14 h-7 rounded-full p-1 transition-all duration-300 ease-in-out relative",
                          item.value ? "bg-primary" : "bg-surface-container-highest"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 bg-surface-container-lowest rounded-full shadow-lg transform transition-all duration-300 flex items-center justify-center",
                          item.value ? "translate-x-7" : "translate-x-0"
                        )}>
                          {item.label === t('settings.item.dark_mode') && (
                            item.value ? <Moon size={10} className="text-primary" /> : <Sun size={10} className="text-primary" />
                          )}
                        </div>
                      </button>
                    ) : item.isRoleSelector ? (
                      <select
                        value={userData?.role || 'student'}
                        disabled={updatingRole}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateRole(e.target.value)}
                        className="bg-surface-container-highest border-none rounded-lg py-1.5 px-3 text-xs font-bold text-primary focus:ring-2 focus:ring-primary transition-all cursor-pointer appearance-none"
                      >
                        <option value="student">{t('settings.role.student')}</option>
                        <option value="teacher">{t('settings.role.teacher')}</option>
                        <option value="other">{t('settings.role.other')}</option>
                      </select>
                    ) : item.isGradeSelector ? (
                      <select
                        value={userData?.grade || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (!user) return;
                          const userRef = doc(db, 'users', user.uid);
                          updateDoc(userRef, { grade: e.target.value });
                        }}
                        className="bg-surface-container-highest border-none rounded-lg py-1.5 px-3 text-xs font-bold text-primary focus:ring-2 focus:ring-primary transition-all cursor-pointer appearance-none"
                      >
                        <option value="" disabled>{t('settings.placeholder.grade')}</option>
                        <optgroup label={t('catalog.primary')}>
                          {primariaLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </optgroup>
                        <optgroup label={t('catalog.secondary')}>
                          {mediaTecnicaLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </optgroup>
                      </select>
                    ) : item.action ? (
                      <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                        {item.action}
                      </span>
                    ) : (
                      <ChevronRight size={20} className="text-on-surface-variant/30 group-hover:translate-x-1 transition-transform" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-outline-variant/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FileText size={20} />
                </div>
                <h3 className="text-xl font-bold text-on-surface">{t('settings.item.reports')}</h3>
              </div>

              {reportSuccess ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-on-surface mb-2">{t('settings.report.success')}</h4>
                  <p className="text-sm text-on-surface-variant">{t('settings.report.success_desc')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitReport} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                      {t('settings.report.label')}
                    </label>
                    <textarea
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder={t('settings.report.placeholder')}
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-primary transition-all min-h-[150px] resize-none"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                    >
                      {t('settings.action.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReport || !reportText.trim()}
                      className="flex-1 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary-container transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmittingReport ? '...' : <><Send size={16} /> {t('settings.report.submit')}</>}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
        {showLanguageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-outline-variant/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Globe size={20} />
                </div>
                <h3 className="text-xl font-bold text-on-surface">{t('settings.modal.language')}</h3>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'default', label: t('settings.language.default') },
                  { id: 'es-LA', label: 'Español (Latinoamérica)' },
                  { id: 'en', label: 'English' }
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setLanguage(lang.id as any);
                      setShowLanguageModal(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl transition-all",
                      language === lang.id 
                        ? "bg-primary text-white shadow-lg" 
                        : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                    )}
                  >
                    <span className="font-bold text-sm">{lang.label}</span>
                    {language === lang.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowLanguageModal(false)}
                className="w-full mt-8 py-3 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                {t('settings.action.cancel')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-outline-variant/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <User size={20} />
                </div>
                <h3 className="text-xl font-bold text-on-surface">{t('settings.modal.edit_profile')}</h3>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative w-24 h-24 mb-4">
                    <div className="w-full h-full rounded-full bg-surface-container-highest overflow-hidden border-2 border-primary/20">
                      {editPhoto ? (
                        <img src={editPhoto} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary/40">
                          <User size={32} />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                      <Camera size={14} />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                    {t('settings.label.name')}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('settings.placeholder.name')}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                      {t('settings.label.grade')}
                    </label>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer"
                    >
                      <option value="">{t('settings.placeholder.grade')}</option>
                      <optgroup label={t('catalog.primary')}>
                        {primariaLevels.map(l => <option key={l} value={l}>{l}</option>)}
                      </optgroup>
                      <optgroup label={t('catalog.secondary')}>
                        {mediaTecnicaLevels.map(l => <option key={l} value={l}>{l}</option>)}
                      </optgroup>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                      {t('settings.label.section')}
                    </label>
                    <input
                      type="text"
                      value={editSection}
                      onChange={(e) => setEditSection(e.target.value)}
                      placeholder={t('settings.placeholder.section')}
                      className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                  >
                    {t('settings.action.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary-container transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? '...' : t('settings.action.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreditsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border border-outline-variant/10 text-center relative overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                  <BookOpen size={40} />
                </div>
                
                <h3 className="text-2xl font-bold text-primary mb-6">{t('settings.credits.title')}</h3>
                
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-on-surface">{t('settings.credits.made_by')}</p>
                    <p className="text-sm text-on-surface-variant font-medium">{t('settings.credits.made_for')}</p>
                  </div>
                  
                  <div className="h-px w-12 bg-outline-variant/20 mx-auto" />
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-surface-container-highest/50 rounded-2xl">
                      <p className="text-sm font-bold text-primary mb-1">{t('settings.credits.author')}</p>
                      <p className="text-xs text-on-surface-variant italic">{t('settings.credits.support')}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowCreditsModal(false)}
                  className="mt-10 w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-container transition-all shadow-lg active:scale-95"
                >
                  {t('settings.action.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-outline-variant/10 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{t('settings.modal.logout_title')}</h3>
              <p className="text-sm text-on-surface-variant mb-8">{t('settings.modal.logout_desc')}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  {t('settings.action.cancel')}
                </button>
                <button 
                  onClick={logout}
                  className="flex-1 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md active:scale-95"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-low rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-outline-variant/10 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Shield size={32} />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{t('settings.modal.delete_title')}</h3>
              <p className="text-sm text-on-surface-variant mb-6">
                {t('settings.modal.delete_desc')}
              </p>
              
              {deleteError && (
                <div className="mb-6 p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl">
                  {deleteError}
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="w-full py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? t('settings.action.deleting') : t('settings.action.delete_confirm')}
                </button>
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  className="w-full py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  {t('settings.action.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
