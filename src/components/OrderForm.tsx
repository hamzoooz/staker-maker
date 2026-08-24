import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Camera, 
  Trash2, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Phone, 
  Search, 
  AlertCircle, 
  Lock, 
  Loader2,
  RefreshCw,
  Zap,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react';
import { POPULAR_COUNTRIES, STICKER_PACKAGES, STICKER_STYLES } from '../data/constants.js';
import { CountryCodeItem, Order, StickerStyleId } from '../types/index.js';
import { CardPaymentModal } from './CardPaymentModal.js';

interface OrderFormProps {
  lang: 'en' | 'ar';
  selectedStyle: StickerStyleId;
  onStyleChange: (styleId: StickerStyleId) => void;
  onOrderCreated: (order: Order, checkoutUrl?: string) => void;
  onOpenPrivacy: () => void;
  isAdmin?: boolean;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  lang,
  selectedStyle,
  onStyleChange,
  onOrderCreated,
  onOpenPrivacy,
  isAdmin = false,
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
  const [pendingCardOrder, setPendingCardOrder] = useState<Order | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

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
      // On mobile devices, fallback to native camera file input
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

      // Check admin auth token
      const adminToken = localStorage.getItem('stickerai_admin_token');
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: formData,
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order. Please try again.');
      }

      const createdOrder: Order = orderData.order;

      // If created by Admin or free bypass
      if (orderData.isAdminOrder || createdOrder.paymentStatus === 'paid') {
        onOrderCreated(createdOrder);
        return;
      }

      if (orderData.checkoutUrl) {
        window.location.href = orderData.checkoutUrl;
        return;
      }

      // Fallback
      onOrderCreated(createdOrder, orderData.checkoutUrl);
    } catch (err: any) {
      console.error('Order submission failed:', err);
      setErrorMessage(err.message || 'Something went wrong while creating your order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="order-section" className="py-10 sm:py-16 bg-slate-50 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-900 text-[11px] sm:text-xs font-black mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? 'AI Sticker Studio' : 'استوديو الملصقات الذكية'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
            {lang === 'en' ? 'Create Your 12 Stickers' : 'اصنع حزمة الـ 12 ملصقاً الخاصة بك'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
            {lang === 'en'
              ? 'Upload your photo, select a style, and receive your WhatsApp pack in seconds.'
              : 'ارفع صورتك، اختر نمط الرسم، واحصل على حزمة ملصقاتك في ثوانٍ.'}
          </p>
        </div>

        {/* Admin VIP Mode Alert */}
        {isAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 text-white flex items-center justify-between shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/40">
                <Zap className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                  {lang === 'en' ? 'Admin VIP Mode Active' : 'وضع الأدمن المميز مفعّل'}
                </h4>
                <p className="text-xs text-slate-300">
                  {lang === 'en' ? 'Unlimited Free Generations ($0.00)' : 'توليد غير محدود ومجاني 100%'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black border border-emerald-500/30">
              FREE VIP
            </span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleOrderSubmit} className="space-y-6 sm:space-y-8">
          
          {/* STEP 1: UPLOAD PHOTO */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/90 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                  1
                </span>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-slate-900">
                    {lang === 'en' ? 'Upload your selfie' : 'ارفع صورة سيلفي'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {lang === 'en' ? 'Clear photo where your face is visible' : 'صورة واضحة يظهر فيها وجهك بوضوح'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                JPG, PNG
              </span>
            </div>

            {/* Hidden native file inputs */}
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
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50'
                }`}
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <h4 className="text-xs sm:text-base font-extrabold text-slate-900">
                  {lang === 'en' ? 'Tap to choose photo from gallery' : 'اضغط لاختيار صورة من الألبوم'}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {lang === 'en' ? 'Or drag and drop photo here' : 'أو اسحب وأفلت الصورة هنا'}
                </p>

                {/* Camera Snap Button */}
                <div className="mt-3.5 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{lang === 'en' ? 'Take Selfie Photo' : 'التقاط سيلفي مباشر'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Camera View */}
            {isCameraActive && (
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 aspect-square max-w-sm mx-auto flex flex-col items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3.5 py-2 rounded-xl bg-slate-900/80 text-white text-xs font-bold backdrop-blur-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg"
                  >
                    Snap Photo
                  </button>
                </div>
              </div>
            )}

            {/* Photo Validation Loading State */}
            {isValidating && (
              <div className="p-10 rounded-2xl bg-indigo-50/50 border border-indigo-200 text-center flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <h4 className="text-sm font-extrabold text-slate-900">
                  {lang === 'en' ? 'Detecting face & validating photo...' : 'جاري التحقق من ملامح الوجه...'}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === 'en' ? 'This ensures your portrait is suitable for character generation.' : 'هذا يضمن أن الصورة الشخصية مناسبة لتوليد الستيكرات.'}
                </p>
              </div>
            )}

            {/* Photo Preview & Live Sticker Sample */}
            {photoPreview && !isValidating && (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="relative rounded-3xl overflow-hidden bg-slate-100 border-2 border-indigo-500/40 shadow-lg">
                  <img src={photoPreview} alt="Selfie preview" className="w-full h-56 object-cover" />
                  <div className="absolute top-2.5 right-2.5 flex items-center space-x-2">
                    <button
                       type="button"
                       onClick={() => {
                         setPhotoPreview(null);
                         setPhotoFile(null);
                         setValidationSuccess(false);
                       }}
                       className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer shadow-md"
                       title="Remove Photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-2.5 inset-x-2.5 bg-slate-950/80 backdrop-blur-md rounded-2xl p-2.5 text-white flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-[11px]">
                        {lang === 'en' ? 'Photo Ready for Stickers' : 'تم اختيار الصورة وجاهزة لتوليد الملصقات'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ✓ {lang === 'en' ? 'Verified Face' : 'تم التحقق من الوجه'}
                    </span>
                  </div>
                </div>

                {/* Mini Preview Strip */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-slate-900">
                      <img src={photoPreview} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-indigo-950">
                        {lang === 'en' ? 'Personalized Likeness' : 'تطبيق ملامحك على الستيكرات'}
                      </p>
                      <p className="text-[10px] text-indigo-700">
                        {lang === 'en' ? 'Your detected face will be used to generate your custom stickers' : 'سيتم استخدام الوجه المستخلص لتوليد ملصقاتك المخصصة'}
                      </p>
                    </div>
                  </div>
                  <div className="flex -space-x-1.5 text-sm">
                    <span className="p-1 rounded-full bg-white shadow-xs border border-slate-100">😍</span>
                    <span className="p-1 rounded-full bg-white shadow-xs border border-slate-100">🤣</span>
                    <span className="p-1 rounded-full bg-white shadow-xs border border-slate-100">🥳</span>
                    <span className="p-1 rounded-full bg-white shadow-xs border border-slate-100">👍</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CHOOSE ART STYLE */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/90 space-y-4 sm:space-y-6">
            <div className="flex items-center space-x-2.5 sm:space-x-3">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                2
              </span>
              <div>
                <h3 className="text-sm sm:text-lg font-black text-slate-900">
                  {lang === 'en' ? 'Select Art Style' : 'اختر نمط الرسم'}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {lang === 'en' ? 'How should your cartoon character look?' : 'كيف تريد أن تظهر شخصيتك في الستيكرات؟'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {STICKER_STYLES.map((st) => (
                <div
                  key={st.id}
                  onClick={() => onStyleChange(st.id)}
                  className={`relative rounded-2xl p-3 sm:p-4 border-2 transition-all cursor-pointer flex flex-col justify-between active:scale-98 ${
                    selectedStyle === st.id
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <span className="text-2xl sm:text-3xl mb-1.5 block">{st.sampleEmoji}</span>
                    <h4 className="text-xs font-black text-slate-950">
                      {lang === 'en' ? st.name : st.nameAr || st.name}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {lang === 'en' ? st.description : st.descriptionAr || st.description}
                    </p>
                  </div>
                  {selectedStyle === st.id && (
                    <div className="mt-2 w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center self-end">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* STEP 3: OPTIONAL WHATSAPP NUMBER */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/90 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                  3
                </span>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-slate-900">
                    {lang === 'en' ? 'WhatsApp Number (Optional)' : 'رقم الواتساب (اختياري)'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {lang === 'en' ? 'Leave blank to view & download directly' : 'اتركه فارغاً لتنزيل الملصقات وإضافتها مباشرة'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                {lang === 'en' ? 'Optional' : 'اختياري'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              {/* Country Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCountryPickerOpen(!isCountryPickerOpen)}
                  className="w-full sm:w-48 px-3.5 py-3 rounded-xl border border-slate-300 bg-white flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="truncate">{selectedCountry.name}</span>
                  </div>
                  <span className="font-mono text-indigo-600 font-bold ml-1 shrink-0">
                    {selectedCountry.dialCode}
                  </span>
                </button>

                {isCountryPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2 space-y-1">
                    <div className="sticky top-0 bg-white pb-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none"
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
                        className="p-2 rounded-xl text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between"
                      >
                        <span>{c.flag} {c.name}</span>
                        <span className="font-mono text-indigo-600 font-bold">{c.dialCode}</span>
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
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {phoneError && (
              <p className="text-xs text-rose-600 font-semibold">{phoneError}</p>
            )}
          </div>

          {/* STEP 4: PACKAGE SUMMARY & CHECKOUT */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 border border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold text-indigo-400 tracking-wider uppercase">
                  Starter Pack
                </span>
                <h3 className="text-lg sm:text-2xl font-black mt-0.5">
                  {lang === 'en' ? 'Personalized AI Stickers Pack' : 'حزمة الملصقات الذكية المخصصة'}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  {lang === 'en' ? '12 Unique Expressions • High Quality Transparent Stickers' : '١٢ تعبيراً فريداً مخصصاً • ملصقات شفافة بجودة عالية'}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl sm:text-3xl font-black text-white">$0.99</span>
                  <span className="text-[11px] text-slate-400">+ $0.20 fee</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-emerald-400 block font-black">Total: $1.19 USD</span>
              </div>
            </div>

            {/* Submit CTA */}
            <div>
              <button
                type="submit"
                disabled={isLoading || isValidating || !validationSuccess}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-75 text-white font-black text-sm sm:text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{lang === 'en' ? 'Generating My Stickers...' : 'جاري توليد ملصقاتي المخصصة...'}</span>
                  </>
                ) : isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{lang === 'en' ? 'Validating Photo...' : 'جاري التحقق من الصورة...'}</span>
                  </>
                ) : !validationSuccess ? (
                  <span>{lang === 'en' ? 'Please upload a valid face photo' : 'يرجى رفع صورة وجه صالحة'}</span>
                ) : isAdmin ? (
                  <>
                    <Zap className="w-5 h-5 text-amber-300" />
                    <span>{lang === 'en' ? 'Generate 12 Stickers (Free Admin VIP)' : 'توليد ١٢ ملصقاً مخصصاً (مجاني للأدمن)'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>{lang === 'en' ? 'Generate My Stickers' : 'توليد ملصقاتي المخصصة'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-[10px] sm:text-[11px] text-slate-400">
                <span>🔒 256-bit Encrypted</span>
                <span>•</span>
                <span>Direct WhatsApp Pack Addition</span>
                <span>•</span>
                <span>Instant Delivery</span>
              </div>
            </div>

          </div>

        </form>

      </div>

      {/* Card Payment Modal */}
      {pendingCardOrder && (
        <CardPaymentModal
          isOpen={isCardModalOpen}
          order={pendingCardOrder}
          lang={lang}
          onClose={() => setIsCardModalOpen(false)}
          onPaymentSuccess={(updated) => {
            setIsCardModalOpen(false);
            onOrderCreated(updated);
          }}
        />
      )}

    </section>
  );
};
