import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Camera,
  Trash2,
  Sparkles,
  ArrowRight,
  Search,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { POPULAR_COUNTRIES, STICKER_STYLES } from '../data/constants.js';
import { CountryCodeItem, Order, StickerStyleId } from '../types/index.js';

interface OrderFormProps {
  lang: 'en' | 'ar';
  selectedStyle: StickerStyleId;
  onStyleChange: (styleId: StickerStyleId) => void;
  onOrderCreated: (order: Order) => void;
  onOpenPrivacy: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  lang,
  selectedStyle,
  onStyleChange,
  onOrderCreated,
}) => {
  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Phone state (OPTIONAL)
  const [selectedCountry, setSelectedCountry] = useState<CountryCodeItem>(POPULAR_COUNTRIES[0]);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Form submission state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Face validation states
  const [isValidating, setIsValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const validateUploadedImage = async (file: File | string) => {
    setIsValidating(true);
    setValidationSuccess(false);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      if (typeof file === 'string') {
        formData.append('photoBase64', file);
      } else {
        formData.append('photo', file);
      }

      const res = await fetch('/api/validate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || (lang === 'en' ? 'Face detection failed. Please upload a clear portrait.' : 'فشل التحقق من ملامح الوجه. يرجى رفع صورة شخصية واضحة.'));
      }

      if (data.croppedUrl) {
        setPhotoPreview(data.croppedUrl);
        setPhotoFile(null);
      }
      setValidationSuccess(true);
    } catch (err: any) {
      console.error('Validation failed:', err);
      setErrorMessage(err.message || (lang === 'en' ? 'Face detection failed. Please upload a clear portrait.' : 'فشل التحقق من ملامح الوجه. يرجى رفع صورة شخصية واضحة.'));
      setPhotoPreview(null);
      setPhotoFile(null);
      setValidationSuccess(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Camera stream ref
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsCameraActive(true);
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraActive(false);
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setErrorMessage(lang === 'en' ? 'Please select a photo from your gallery.' : 'يرجى اختيار صورة من ألبوم الصور.');
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPhotoPreview(dataUrl);
      setPhotoFile(null);
      validateUploadedImage(dataUrl);
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleFile = (file: File) => {
    setErrorMessage(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage(lang === 'en' ? 'Please upload a JPG, JPEG, PNG, or WEBP image.' : 'يرجى رفع صورة بصيغة JPG أو PNG أو WEBP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage(lang === 'en' ? 'File size exceeds 15 MB limit. Please choose a smaller photo.' : 'حجم الصورة يتجاوز 15 ميجابايت.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
      validateUploadedImage(file);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const filteredCountries = POPULAR_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch) ||
      (c.nameAr && c.nameAr.includes(countrySearch))
  );

  const validatePhone = (): boolean => {
    const raw = phoneNumber.replace(/[^0-9]/g, '');
    if (raw && raw.length < 5) {
      setPhoneError(lang === 'en' ? 'Please enter a valid phone number or leave blank.' : 'يرجى إدخال رقم صحيح أو تركه فارغاً.');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!photoPreview) {
      setErrorMessage(lang === 'en' ? 'Please upload or take a selfie photo before continuing.' : 'يرجى رفع أو التقاط صورة سيلفي أولاً.');
      return;
    }

    if (!validatePhone()) {
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      if (phoneNumber.trim()) {
        formData.append('phone', `${selectedCountry.dialCode}${phoneNumber.replace(/[^0-9]/g, '')}`);
        formData.append('countryCode', selectedCountry.code);
      }
      formData.append('style', selectedStyle);

      if (photoFile) {
        formData.append('photo', photoFile);
      } else if (photoPreview) {
        formData.append('photoBase64', photoPreview);
      }

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to generate stickers. Please try again.');
      }

      onOrderCreated(orderData.order);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'Something went wrong while starting generation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="order-section" className="py-12 sm:py-20 bg-[#030014] border-t border-slate-800/60 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none ambient-cyan opacity-20" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[11px] sm:text-xs font-black mb-2.5 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang === 'en' ? 'AI Sticker Studio' : 'استوديو الذكاء الاصطناعي'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {lang === 'en' ? 'Generate Your Free AI Stickers' : 'توليد ملصقاتك بالذكاء الاصطناعي مجاناً'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">
            {lang === 'en'
              ? 'Upload your selfie, choose an artistic style, and watch AI build your WhatsApp stickers.'
              : 'ارفع صورتك الشخصية، اختر الستايل المفضل لديك، وشاهد الذكاء الاصطناعي يبني ملصقاتك.'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs sm:text-sm flex items-start space-x-3 backdrop-blur-xs">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleOrderSubmit} className="space-y-8">
          
          {/* STEP 1: UPLOAD PHOTO */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  1
                </span>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-white">
                    {lang === 'en' ? 'Upload your selfie' : 'ارفع صورة سيلفي'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {lang === 'en' ? 'Clear photo where your face is visible' : 'صورة واضحة يظهر فيها وجهك بوضوح'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
                JPG, PNG, WEBP
              </span>
            </div>

            {/* Hidden inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />

            {/* Upload Area */}
            {!photoPreview && !isCameraActive && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center group ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/5 scale-[0.99]'
                    : 'border-slate-800 hover:border-indigo-500/70 hover:bg-slate-900/30'
                }`}
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-indigo-500/20 shadow-inner">
                  <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <h4 className="text-xs sm:text-base font-extrabold text-slate-200">
                  {lang === 'en' ? 'Tap to choose photo from gallery' : 'اضغط لاختيار صورة من الألبوم'}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  {lang === 'en' ? 'Or drag and drop photo here' : 'أو اسحب وأفلت الصورة هنا'}
                </p>

                {/* Camera Snap Button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700 shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'en' ? 'Take Live Selfie' : 'التقاط صورة حية'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Camera View */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-w-xs mx-auto flex flex-col items-center justify-center border border-slate-800 shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-bold border border-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg cursor-pointer"
                  >
                    Snap Photo
                  </button>
                </div>
              </div>
            )}

            {/* Photo Validation / Face Scanning Animation */}
            {isValidating && (
              <div className="relative p-10 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 text-center flex flex-col items-center justify-center space-y-4 overflow-hidden min-h-[220px]">
                {/* Laser Scanning line effect */}
                <div className="absolute left-0 w-full h-[3px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-scanner opacity-80" />
                
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin z-10" />
                <h4 className="text-sm font-extrabold text-white z-10">
                  {lang === 'en' ? 'Scanning photo & verifying face...' : 'جاري فحص ملامح الوجه بالذكاء الاصطناعي...'}
                </h4>
                <p className="text-xs text-slate-400 z-10">
                  {lang === 'en' ? 'Detecting features to generate your unique sticker identity.' : 'نقوم بتحديد الملامح لتثبيت هوية الشخصية الكرتونية.'}
                </p>
              </div>
            )}

            {/* Photo Preview & scanning laser overlay if verified */}
            {photoPreview && !isValidating && (
              <div className="space-y-4 max-w-sm mx-auto">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl aspect-square flex items-center justify-center">
                  <img src={photoPreview} alt="Selfie preview" className="w-full h-full object-cover" />
                  
                  {/* Gentle scanline glow on loaded image */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none" />

                  <div className="absolute top-2.5 right-2.5">
                    <button
                       type="button"
                       onClick={() => {
                         setPhotoPreview(null);
                         setPhotoFile(null);
                         setValidationSuccess(false);
                       }}
                       className="p-2 rounded-xl bg-slate-950/80 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-lg border border-slate-800"
                       title="Remove Photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-2.5 inset-x-2.5 bg-slate-950/90 backdrop-blur-md rounded-xl p-2.5 text-white flex items-center justify-between text-[11px] border border-slate-800">
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold">
                        {lang === 'en' ? 'Face Verified' : 'تم التحقق من الوجه'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      AI READY
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CHOOSE STYLE */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  2
                </span>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-white">
                    {lang === 'en' ? 'Select Sticker Style' : 'اختر نمط الملصقات'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {lang === 'en' ? 'Choose the art style for your stickers' : 'اختر الطابع الفني واللون العام لملصقاتك'}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid of Styles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STICKER_STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onStyleChange(style.id)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/50 scale-[1.02]'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${style.previewColor} shadow-inner`}>
                      {style.sampleEmoji}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-black block">
                        {lang === 'en' ? style.name : style.nameAr}
                      </span>
                      <span className="text-[9px] opacity-60 block line-clamp-1 max-w-[120px]">
                        {lang === 'en' ? style.description : style.descriptionAr}
                      </span>
                    </div>
                    {style.badge && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-cyan-500 text-slate-950 font-black">
                        {style.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: OPTIONAL WHATSAPP NUMBER */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  3
                </span>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-white">
                    {lang === 'en' ? 'WhatsApp Number (Optional)' : 'رقم الواتساب (اختياري)'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {lang === 'en' ? 'Leave blank to view and download directly' : 'اتركه فارغاً لعرض وتحميل الملصقات مباشرة من المتصفح'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                {lang === 'en' ? 'Optional' : 'اختياري'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Country Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCountryPickerOpen(!isCountryPickerOpen)}
                  className="w-full sm:w-48 px-3.5 py-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-300 cursor-pointer shadow-sm hover:border-slate-700"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="truncate">{selectedCountry.name}</span>
                  </div>
                  <span className="font-mono text-indigo-400 font-bold ml-1 shrink-0">
                    {selectedCountry.dialCode}
                  </span>
                </button>

                {isCountryPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 z-50 p-2 space-y-1">
                    <div className="sticky top-0 bg-slate-900 pb-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 outline-none"
                        />
                      </div>
                    </div>
                    {filteredCountries.map((c) => (
                      <div
                        key={c.code}
                        onClick={() => {
                          setSelectedCountry(c);
                          setIsCountryPickerOpen(false);
                        }}
                        className="p-2 rounded-xl text-xs hover:bg-slate-800 text-slate-300 cursor-pointer flex items-center justify-between"
                      >
                        <span>{c.flag} {c.name}</span>
                        <span className="font-mono text-indigo-400 font-bold">{c.dialCode}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone Input */}
              <div className="flex-1 relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={selectedCountry.formatPlaceholder || '55 123 4567'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 text-sm font-medium focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
                />
              </div>
            </div>

            {phoneError && (
              <p className="text-xs text-rose-500 font-semibold">{phoneError}</p>
            )}
          </div>

          {/* GENERATE CTA BUTTON */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-850">
            <div>
              <button
                type="submit"
                disabled={isLoading || isValidating || !validationSuccess}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] disabled:opacity-50 text-white font-black text-sm sm:text-lg shadow-lg shadow-indigo-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer border border-indigo-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{lang === 'en' ? 'Generating My Stickers...' : 'جاري توليد ملصقاتك بالذكاء الاصطناعي...'}</span>
                  </>
                ) : isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{lang === 'en' ? 'Scanning Photo...' : 'جاري فحص الصورة الشخصية...'}</span>
                  </>
                ) : !validationSuccess ? (
                  <span>{lang === 'en' ? 'Please upload a face photo' : 'يرجى رفع صورة وجه صحيحة أولاً'}</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <span>{lang === 'en' ? 'Generate My Free AI Stickers' : 'توليد ملصقاتي مجاناً بالذكاء الاصطناعي'}</span>
                    <ArrowRight className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-[10px] sm:text-[11px] text-slate-500">
                <span>🛡️ Secure Processing</span>
                <span>•</span>
                <span>✨ 4 Unique Expression Pack</span>
                <span>•</span>
                <span>⚡ Instant Web & WhatsApp Access</span>
              </div>
            </div>
          </div>

        </form>

      </div>
    </section>
  );
};
