import React, { useState } from 'react';
import { AlertCircle, CheckCircle, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { caregiverService } from '../../services/caregiverService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';

export const SOSButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const { currentUser } = useCurrentUser();
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();

  const handleTriggerSOS = () => {
    caregiverService.triggerSosAlert(currentUser.id, currentUser.preferredName || currentUser.name);
    setAlertSent(true);

    const spokenMessages: Record<string, string> = {
      en: 'Your emergency caregiver alert has been sent. Stay calm, Priya is being notified.',
      hi: 'सहायता संदेश भेज दिया गया है। शांत रहें, आपकी बेटी प्रिया को सूचना मिल गई है।',
      as: 'সাহায্য বাৰ্তা প্ৰেৰণ কৰা হৈছে। শান্ত থাকক, প্ৰিয়াক খবৰ দিয়া হৈছে।',
    };
    speakText(spokenMessages[currentLang] || spokenMessages.hi);

    setTimeout(() => {
      setAlertSent(false);
      setIsOpen(false);
    }, 4000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-2xl font-bold shadow-tactile border border-red-800 transition-all cursor-pointer text-sm sm:text-base animate-pulse-subtle"
        aria-label="Emergency Caregiver SOS"
      >
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span className="hidden xs:inline">{currentLang === 'hi' ? 'सहायता (SOS)' : currentLang === 'as' ? 'সাহায্য (SOS)' : 'Help (SOS)'}</span>
        <span className="xs:hidden">SOS</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-red-500 text-center relative">
            <button
              onClick={() => setIsOpen(false)}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            {!alertSent ? (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentLang === 'hi' ? 'सहायता की आवश्यकता है?' : currentLang === 'as' ? 'সাহায্যৰ প্ৰয়োজন নেকি?' : 'Need Immediate Help?'}
                </h3>
                <p className="text-gray-600 text-base mb-6 leading-relaxed">
                  {currentLang === 'hi'
                    ? 'यह बटन दबाने पर आपकी देखभालकर्ता (प्रिया) को तुरंत आपातकालीन संदेश भेजा जाएगा।'
                    : currentLang === 'as'
                    ? 'এই বুটাম টিপিলে আপোনাৰ যত্নকাৰী (প্ৰিয়া) লৈ তৎক্ষণাৎ জৰুৰী বাৰ্তা যাব।'
                    : 'Pressing this will instantly send an urgent notification to your caregiver (Priya).'}
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleTriggerSOS}
                    type="button"
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <PhoneCall className="w-6 h-6" />
                    <span>{currentLang === 'hi' ? 'हाँ, तुरंत सूचना भेजें' : currentLang === 'as' ? 'হয়, তৎক্ষণাৎ জনাওক' : 'Yes, Send Emergency Alert'}</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-2xl font-semibold text-base cursor-pointer"
                  >
                    {currentLang === 'hi' ? 'नहीं, गलती से दब गया' : currentLang === 'as' ? 'নহয়, ভুলতে স্পৰ্শ হ\'ল' : 'Cancel, Pressed by Mistake'}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentLang === 'hi' ? 'सूचना भेज दी गई है!' : currentLang === 'as' ? 'বাৰ্তা প্ৰেৰণ কৰা হ\'ল!' : 'Alert Sent Successfully!'}
                </h3>
                <p className="text-gray-600 text-base">
                  {currentLang === 'hi' ? 'प्रिया को आपका संदेश मिल गया है। कृपया शांत रहें।' : currentLang === 'as' ? 'প্ৰিয়াই আপোনাৰ বাৰ্তা পাইছে। অনুগ্ৰহ কৰি শান্ত থাকক।' : 'Priya has received your notification. Help is being coordinated.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
