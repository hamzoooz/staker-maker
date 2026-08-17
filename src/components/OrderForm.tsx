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
  RefreshCw
} from 'lucide-react';
import { POPULAR_COUNTRIES, STICKER_PACKAGES, STICKER_STYLES } from '../data/constants.js';
import { CountryCodeItem, Order, StickerStyleId } from '../types/index.js';

interface OrderFormProps {
  lang: 'en' | 'ar';
  selectedStyle: StickerStyleId;
  onStyleChange: (styleId: StickerStyleId) => void;
  onOrderCreated: (order: Order, checkoutUrl?: string) => void;
  onOpenPrivacy: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  lang,
  selectedStyle,
  onStyleChange,
  onOrderCreated,
  onOpenPrivacy,
}) => {
  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Phone state
  const [selectedCountry, setSelectedCountry] = useState<CountryCodeItem>(POPULAR_COUNTRIES[0]); // Qatar by default
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Form submission state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulatedCheckout, setIsSimulatedCheckout] = useState(true);

  // Camera stream ref
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Handle camera start
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
      setErrorMessage('Camera access was denied. Please select a photo from your gallery instead.');
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
      setPhotoFile(null); // base64 preview is used
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

  // Handle file selection
  const handleFile = (file: File) => {
    setErrorMessage(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Please upload a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10 MB limit. Please choose a smaller photo.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
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

  // Filtered countries
  const filteredCountries = POPULAR_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch) ||
      (c.nameAr && c.nameAr.includes(countrySearch))
  );

  // Validate phone
  const validatePhone = (): boolean => {
    const raw = phoneNumber.replace(/[^0-9]/g, '');
    if (!raw || raw.length < 6) {
      setPhoneError('Please enter your WhatsApp phone number.');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  // Submit Order and Proceed to Checkout
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!photoPreview) {
      setErrorMessage('Please upload or take a selfie photo before continuing.');
      return;
    }

    if (!validatePhone()) {
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('phone', `${selectedCountry.dialCode}${phoneNumber.replace(/[^0-9]/g, '')}`);
      formData.append('countryCode', selectedCountry.code);
      formData.append('style', selectedStyle);

      if (photoFile) {
        formData.append('photo', photoFile);
      } else if (photoPreview) {
        formData.append('photoBase64', photoPreview);
      }

      // Step 1: Create Order on Backend
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order. Please try again.');
      }

      const createdOrder: Order = orderData.order;

      // Step 2: Initialize Checkout Session
      const checkoutRes = await fetch(`/api/orders/${createdOrder.id}/checkout`, {
        method: 'POST',
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.error || 'Checkout initialization failed.');
      }

      onOrderCreated(createdOrder, checkoutData.checkoutUrl);
    } catch (err: any) {
      console.error('Order submission failed:', err);
      setErrorMessage(err.message || 'Something went wrong while creating your order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="order-section" className="py-16 bg-slate-50 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Order Your 12 Stickers</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {lang === 'en' ? 'Create My Sticker Pack' : 'إنشاء حزمة ملصقاتي'}
          </h2>
          <p className="text-sm sm:text-base text-slate-700 mt-2">
            {lang === 'en'
              ? 'Upload your photo, pick a style, and get 12 AI stickers sent directly to your WhatsApp for $2.99.'
              : 'ارفع صورتك واختر النمط المناسب واستلم 12 ملصقاً مخصصاً على رقمك فوراً مقابل 2.99$.'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleOrderSubmit} className="space-y-8">
          
          {/* STEP 1: UPLOAD PHOTO */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {lang === 'en' ? 'Upload your selfie' : 'ارفع صورة سيلفي'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'en'
                      ? 'Use a clear photo where your face is visible'
                      : 'استخدم صورة واضحة ومضاءة يظهر فيها وجهك بوضوح'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                JPG, PNG, WEBP (Max 10MB)
              </span>
            </div>

            {/* Upload Area */}
            {!photoPreview && !isCameraActive && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center group ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 transition-colors">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <p className="text-base font-bold text-slate-900 mb-1">
                  {lang === 'en' ? 'Click to upload or drag and drop' : 'انقر لرفع الصورة أو اسحبها هنا'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mb-5">
                  {lang === 'en'
                    ? 'Take a photo or choose from your phone gallery'
                    : 'التقط صورة جديدة أو اختر من معرض هاتفك'}
                </p>

                <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Choose From Gallery
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Camera View */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center p-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm rounded-xl aspect-square object-cover" />
                <div className="mt-4 flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center space-x-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Selfie</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Photo Preview Mode */}
            {photoPreview && (
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200">
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-indigo-600 shadow-md shrink-0">
                  <img src={photoPreview} alt="Selfie preview" className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 bg-indigo-600 text-white p-1 rounded-full">
                    <Check className="w-3 h-3" />
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <span className="font-bold text-slate-900 text-sm">Selfie ready for AI transformation!</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      ✓ Valid
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    We will generate 12 character expressions preserving your hair, eyes, and key facial identity.
                  </p>
                  <div className="pt-2 flex items-center justify-center sm:justify-start space-x-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setPhotoFile(null);
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy note */}
            <div className="pt-1 flex items-start space-x-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Your photo is used only to create your personalized stickers. We don't sell your photo or personal information. Automatically deleted in 7 days.{' '}
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Privacy Policy
                </button>
              </span>
            </div>
          </div>

          {/* STEP 2: CHOOSE STICKER STYLE */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-6">
            <div className="flex items-center space-x-3">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {lang === 'en' ? 'Choose sticker style' : 'اختر نمط الملصقات'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'en'
                    ? 'Pick an artistic look for your 12 stickers'
                    : 'حدد المظهر الفني الذي تفضله لحزمة ملصقاتك'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STICKER_STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => onStyleChange(style.id)}
                    className={`relative rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/30 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    {style.badge && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white">
                        {style.badge}
                      </span>
                    )}
                    <span className="text-3xl mb-2">{style.sampleEmoji}</span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                        {lang === 'en' ? style.name : style.nameAr || style.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {lang === 'en' ? style.description : style.descriptionAr || style.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: WHATSAPP PHONE NUMBER */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-6">
            <div className="flex items-center space-x-3">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {lang === 'en' ? 'Enter your WhatsApp number' : 'أدخل رقم الواتساب'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'en'
                    ? "We'll send your finished sticker pack to this WhatsApp number."
                    : 'سنرسل حزمة الملصقات الجاهزة مباشرة إلى هذا الرقم على واتساب.'}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col sm:flex-row gap-2">
                
                {/* Country Selector Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCountryPickerOpen(!isCountryPickerOpen)}
                    className="w-full sm:w-52 px-3.5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-900 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-lg">{selectedCountry.flag}</span>
                      <span className="text-xs truncate">{selectedCountry.name}</span>
                    </div>
                    <span className="text-xs font-mono text-indigo-600 ml-1 shrink-0 font-bold">
                      {selectedCountry.dialCode}
                    </span>
                  </button>

                  {/* Country Dropdown Modal/List */}
                  {isCountryPickerOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 space-y-1">
                      <div className="sticky top-0 bg-white pb-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search country or code..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-indigo-500"
                          />
                        </div>
                      </div>
                      {filteredCountries.map((country) => (
                        <div
                          key={country.code}
                          onClick={() => {
                            setSelectedCountry(country);
                            setIsCountryPickerOpen(false);
                            setCountrySearch('');
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs hover:bg-indigo-50 cursor-pointer ${
                            selectedCountry.code === country.code ? 'bg-indigo-50 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span className="text-base">{country.flag}</span>
                            <span className="truncate">{country.name}</span>
                          </div>
                          <span className="text-indigo-600 font-mono font-semibold">{country.dialCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Input Field */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder={`e.g. ${selectedCountry.formatPlaceholder}`}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      phoneError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>

              </div>

              {phoneError && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  {phoneError}
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Normalized format:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {selectedCountry.dialCode}
                {phoneNumber.replace(/[^0-9]/g, '') || 'XXXXXXXX'}
              </span>
            </p>
          </div>

          {/* STEP 4: PACKAGE SUMMARY & CHECKOUT */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 border border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase">
                  Starter Pack Included
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold mt-1">12 AI-Generated WhatsApp Stickers</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Delivered straight to your WhatsApp • Lifetime access
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-3xl font-extrabold text-white">$2.99</span>
                <span className="text-xs text-slate-400 block">USD • One-time</span>
              </div>
            </div>

            {/* Checkpoints */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>Facial Identity Preserved</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>12 Unique Emotions & Memes</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>No Account or Signup Required</span>
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-70 text-white font-extrabold text-base sm:text-lg shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-3 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Preparing Secure Checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Pay $2.99 & Create My Stickers</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="mt-3 flex items-center justify-center space-x-4 text-[11px] text-slate-400">
                <span>🔒 256-bit Encrypted Checkout</span>
                <span>•</span>
                <span>Instant Generation Trigger</span>
                <span>•</span>
                <span>100% Satisfaction</span>
              </div>
            </div>

          </div>

        </form>

      </div>
    </section>
  );
};
