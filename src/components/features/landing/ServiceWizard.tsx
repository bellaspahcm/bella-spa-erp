'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, UserCheck, Baby, MapPin, Phone, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface ServicePackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  benefits: string[];
  tag?: string;
}

interface ServiceWizardProps {
  categories: any;
  serviceCategories: any;
  onSelectPackage: (packageName: string) => void;
}

export function ServiceWizard({ categories, serviceCategories, onSelectPackage }: ServiceWizardProps) {
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardUserType, setWizardUserType] = useState<string>('');
  const [wizardConcern, setWizardConcern] = useState<string>('');
  const [wizardLocation, setWizardLocation] = useState<string>('');
  const [recommendedPackage, setRecommendedPackage] = useState<ServicePackage | null>(null);

  const handleWizardUserType = (type: string) => {
    setWizardUserType(type);
    setWizardStep(2);
  };

  const handleWizardConcern = (concern: string) => {
    setWizardConcern(concern);
    setWizardStep(3);
  };

  const handleWizardLocation = (loc: string) => {
    setWizardLocation(loc);
    
    // Calculate recommendation based on selections
    let pkg: ServicePackage | null = null;
    const activeCats = categories || serviceCategories;
    
    if (wizardUserType === 'bau') {
      if (wizardConcern === 'dau-nhuc') {
        pkg = activeCats[' bầu'].packages[1] || activeCats[' bầu'].packages[0];
      } else {
        pkg = activeCats[' bầu'].packages[0];
      }
    } else if (wizardUserType === 'sau-sinh') {
      if (wizardConcern === 'giam-eo' || wizardConcern === 'toan-dien') {
        pkg = activeCats['sau-sinh'].packages[1] || activeCats['sau-sinh'].packages[0];
      } else {
        pkg = activeCats['sau-sinh'].packages[0];
      }
    } else if (wizardUserType === 'be') {
      if (wizardConcern === 'boi-thuy-lieu') {
        pkg = activeCats['baby'].packages[1] || activeCats['baby'].packages[0];
      } else {
        pkg = activeCats['baby'].packages[0];
      }
    } else {
      pkg = activeCats['combo'].packages[1] || activeCats['combo'].packages[0];
    }
    
    setRecommendedPackage(pkg);
    setWizardStep(4);
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardUserType('');
    setWizardConcern('');
    setWizardLocation('');
    setRecommendedPackage(null);
  };

  const startBookingWithRecommendation = () => {
    if (recommendedPackage) {
      onSelectPackage(recommendedPackage.name);
      const element = document.getElementById('booking-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      toast.info(`Đã tự động điền liệu trình đề xuất: ${recommendedPackage.name} vào phiếu đăng ký! 🌸`);
    }
  };

  return (
    <section id="wizard" className="py-24 bg-gradient-to-br from-rose-50 to-pink-50 border-y border-rose-100/50 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-pink-200/20 blur-[80px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Tư vấn thông minh</span>
        <h2 className="text-3xl font-serif font-black text-slate-800 tracking-tight mb-4">
          Đề Xuất Liệu Trình Cá Nhân Hóa 🌸
        </h2>
        <p className="text-slate-500 text-sm font-semibold max-w-xl mx-auto mb-12">
          Trả lời 3 câu hỏi nhanh dưới đây, thuật toán của Bella Spa sẽ tự động phân tích và chọn ra gói dịch vụ tối ưu, phù hợp nhất với thể trạng của mẹ và bé.
        </p>

        <div className="bg-white/80 backdrop-blur-xl border border-white p-8 sm:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-rose-400" />
          
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${wizardStep === step ? 'bg-primary text-white scale-110 shadow-md shadow-pink-100' : wizardStep > step ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                {wizardStep > step ? '✓' : step}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: User Type */}
            {wizardStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step-1"
                className="space-y-6"
              >
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mẹ đang có nhu cầu chăm sóc cho đối tượng nào?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleWizardUserType('bau')}
                    className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                  >
                    <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-primary group-hover:scale-105 transition-transform"><Heart className="w-6 h-6" /></div>
                    <span className="font-serif font-black text-sm text-slate-800">Mẹ Bầu mang thai</span>
                  </button>
                  <button
                    onClick={() => handleWizardUserType('sau-sinh')}
                    className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                  >
                    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform"><UserCheck className="w-6 h-6" /></div>
                    <span className="font-serif font-black text-sm text-slate-800">Mẹ Sau Sinh phục hồi</span>
                  </button>
                  <button
                    onClick={() => handleWizardUserType('be')}
                    className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                  >
                    <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center text-sky-500 group-hover:scale-105 transition-transform"><Baby className="w-6 h-6" /></div>
                    <span className="font-serif font-black text-sm text-slate-800">Bé Yêu sơ sinh</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Major Concerns */}
            {wizardStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step-2"
                className="space-y-6"
              >
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mối quan tâm lớn nhất hiện tại của mẹ là gì?</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                  {wizardUserType === 'bau' && (
                    <>
                      <button onClick={() => handleWizardConcern('dau-nhuc')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Giảm đau nhức thắt lưng, hông, tê bì chân tay
                      </button>
                      <button onClick={() => handleWizardConcern('giam-stress')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Thư giãn đầu óc, cải thiện giấc ngủ, ngủ sâu giấc hơn
                      </button>
                    </>
                  )}
                  {wizardUserType === 'sau-sinh' && (
                    <>
                      <button onClick={() => handleWizardConcern('thong-sua')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Thông tắc tia sữa, gọi sữa về dồi dào
                      </button>
                      <button onClick={() => handleWizardConcern('giam-eo')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Tống sản dịch, thu nhỏ vòng bụng, giảm mỡ
                      </button>
                      <button onClick={() => handleWizardConcern('toan-dien')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Phục hồi sức khỏe toàn diện & dưỡng sáng hồng da
                      </button>
                    </>
                  )}
                  {wizardUserType === 'be' && (
                    <>
                      <button onClick={() => handleWizardConcern('tam-be')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Tắm vệ sinh bé chuẩn y khoa, rốn sạch, hơ trầu
                      </button>
                      <button onClick={() => handleWizardConcern('boi-thuy-lieu')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20 w-full">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                        Bơi thủy liệu cứng cáp xương khớp, vận động sớm
                      </button>
                    </>
                  )}
                </div>
                
                <button onClick={() => setWizardStep(1)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider block mx-auto mt-6">← Quay lại bước 1</button>
              </motion.div>
            )}

            {/* Step 3: Location preference */}
            {wizardStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step-3"
                className="space-y-6"
              >
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mẹ mong muốn trải nghiệm dịch vụ ở đâu?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                  <button
                    onClick={() => handleWizardLocation('spa')}
                    className="p-6 bg-white border border-rose-100 hover:border-primary rounded-xl shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group w-full"
                  >
                    <MapPin className="w-6 h-6 text-primary group-hover:scale-105 transition-transform" />
                    <span className="font-serif font-black text-sm text-slate-800">Tại cơ sở Spa của Bella</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Tận hưởng trọn vẹn không gian tinh tế</span>
                  </button>
                  <button
                    onClick={() => handleWizardLocation('home')}
                    className="p-6 bg-white border border-rose-100 hover:border-primary rounded-xl shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group w-full"
                  >
                    <Phone className="w-6 h-6 text-primary group-hover:scale-105 transition-transform" />
                    <span className="font-serif font-black text-sm text-slate-800">Tại nhà (KTV đến nhà)</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Tiện lợi, an toàn, không tốn thời gian di chuyển</span>
                  </button>
                </div>
                <button onClick={() => setWizardStep(2)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider block mx-auto mt-6">← Quay lại bước trước</button>
              </motion.div>
            )}

            {/* Step 4: Results */}
            {wizardStep === 4 && recommendedPackage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key="step-4"
                className="space-y-6"
              >
                <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                
                <h3 className="text-xl font-serif font-black text-slate-800">Bella Spa đề xuất liệu trình dành cho mẹ:</h3>
                
                <div className="bg-gradient-to-br from-rose-50/50 to-pink-50/50 border border-rose-100 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-left relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="text-[9px] bg-primary text-white font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 inline-block">ĐỀ XUẤT TỐI ƯU</span>
                      <h4 className="text-lg font-serif font-black text-slate-800">{recommendedPackage.name}</h4>
                    </div>
                    <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0">
                      <span className="text-xl font-serif font-black text-primary block">{recommendedPackage.price}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Trọn gói liệu trình</span>
                    </div>
                  </div>

                  <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-4">
                    {recommendedPackage.description}
                  </p>

                  <ul className="space-y-2 mt-4 pt-4 border-t border-rose-100/50">
                    {recommendedPackage.benefits.slice(0, 3).map((benefit, i) => (
                      <li key={i} className="flex gap-2 text-slate-600 text-xs font-medium">
                        <span className="text-emerald-500 font-bold shrink-0">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                    {recommendedPackage.benefits.length > 3 && (
                      <li className="text-[10px] text-slate-400 italic font-semibold">Và một số bước chăm sóc bổ trợ y khoa chuyên nghiệp khác...</li>
                    )}
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto pt-6">
                  <button
                    onClick={startBookingWithRecommendation}
                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-pink-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    Đặt lịch ngay với liệu trình này
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetWizard}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Chọn lại từ đầu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
