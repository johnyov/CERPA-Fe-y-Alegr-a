import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  CheckCircle2, 
  Scan, 
  Flashlight, 
  ZoomIn, 
  Camera,
  ChevronRight,
  Loader2,
  Link as LinkIcon,
  Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { analyzeBookImage } from '../services/geminiService';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { useLanguage } from '../contexts/LanguageContext';

export const Scanner = () => {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentUrl = window.location.href;

  const handleManualScan = async () => {
    if (!manualUrl) return;
    setLoading(true);
    // Simulate scan
    setTimeout(() => {
      const result = { title: "Recurso Externo", isbn: manualUrl.substring(0, 15) };
      setRecentScans([result, ...recentScans]);
      setManualUrl('');
      setLoading(false);
    }, 1500);
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setLoading(true);
    const context = canvasRef.current.getContext('2d');
    if (context) {
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      const base64Image = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
      
      try {
        const result = await analyzeBookImage(base64Image);
        if (result.title) {
          // Save scan to Firestore
          try {
            await addDoc(collection(db, 'scans'), {
              uid: auth.currentUser?.uid,
              bookId: result.isbn || 'unknown',
              title: result.title,
              timestamp: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'scans');
          }
          
          setRecentScans([result, ...recentScans]);
        }
      } catch (error) {
        console.error("Error analyzing image:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Start camera
  React.useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => console.error("Error accessing camera:", err));
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-12">
        <h2 className="font-headline text-4xl font-extrabold text-primary mb-2 tracking-tight">{t('scanner.title')}</h2>
        <p className="font-body text-on-surface-variant text-lg opacity-80 mb-8">{t('scanner.subtitle')}</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-surface-container rounded-xl">
            <h3 className="font-headline text-xl font-bold text-primary mb-3">{t('scanner.instructions')}</h3>
            <p className="text-sm text-on-surface leading-relaxed mb-4">
              {t('scanner.instructions_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm font-medium text-on-surface-variant">
                <CheckCircle2 className="text-primary" size={18} />
                {t('scanner.lighting')}
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-on-surface-variant">
                <CheckCircle2 className="text-primary" size={18} />
                {t('scanner.no_reflections')}
              </div>
            </div>
          </div>

          <div className="p-6 bg-primary-fixed rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-primary-fixed-variant mb-1">{t('scanner.status')}</p>
              <p className="font-headline text-lg font-bold text-primary">
                {loading ? t('scanner.analyzing') : t('scanner.scanning')}
              </p>
            </div>
            <div className={cn("animate-pulse", loading && "animate-spin")}>
              {loading ? <Loader2 className="text-primary" size={32} /> : <Scan className="text-primary" size={32} />}
            </div>
          </div>

          <div className="p-6 bg-surface-container rounded-xl text-center">
            <h3 className="font-headline text-lg font-bold text-primary mb-4">{t('scanner.page_qr')}</h3>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm mb-3">
              <QRCodeCanvas 
                value={currentUrl} 
                size={160}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/logo.png",
                  x: undefined,
                  y: undefined,
                  height: 24,
                  width: 24,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">{t('scanner.share_desc')}</p>
          </div>

          <div className="p-6 bg-surface-container rounded-xl">
            <h3 className="font-headline text-lg font-bold text-primary mb-4">{t('scanner.manual_input')}</h3>
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder={t('scanner.manual_placeholder')}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary transition-all"
                />
                <LinkIcon className="absolute left-3 top-3 text-on-surface-variant" size={16} />
              </div>
              <button 
                onClick={handleManualScan}
                disabled={!manualUrl || loading}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {t('scanner.scan_link')}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black aspect-[4/3] group">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="scanner-frame w-64 h-64 md:w-80 md:h-80 relative flex items-center justify-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/40 shadow-[0_0_15px_#570013] animate-scan"></div>
                <button 
                  onClick={handleCapture}
                  disabled={loading}
                  className="absolute inset-4 border border-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-primary/10 backdrop-blur-[2px] disabled:opacity-50"
                >
                  <Camera className="text-white opacity-80" size={48} />
                </button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                <span className="text-white text-xs font-medium tracking-widest">LIVE FEED</span>
              </div>
              <div className="flex gap-4">
                <button className="text-white/80 hover:text-white"><Flashlight size={20} /></button>
                <button className="text-white/80 hover:text-white"><ZoomIn size={20} /></button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="font-headline text-lg font-bold text-on-surface mb-4">{t('scanner.recent_scans')}</h4>
            <div className="space-y-4">
              {recentScans.length > 0 ? recentScans.map((scan, i) => (
                <div key={i} className="bg-surface-container-lowest p-4 rounded-xl flex items-center gap-4 hover:bg-surface-container-high transition-colors cursor-pointer">
                  <div className="w-12 h-16 bg-surface-container rounded-sm overflow-hidden flex-shrink-0">
                    <img src="https://picsum.photos/seed/scan/100/150" alt="Book" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary">{scan.title}</p>
                    <p className="text-xs text-on-surface-variant">ISBN: {scan.isbn || 'N/A'} • {t('scanner.just_scanned')}</p>
                  </div>
                  <ChevronRight className="text-primary" size={20} />
                </div>
              )) : (
                <p className="text-sm text-on-surface-variant italic">{t('scanner.no_scans')}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
