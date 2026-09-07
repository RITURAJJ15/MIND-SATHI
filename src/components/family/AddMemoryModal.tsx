import React, { useState } from 'react';
import { familyService } from '../../services/familyService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { X, Image, Heart } from 'lucide-react';

interface AddMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export const AddMemoryModal: React.FC<AddMemoryModalProps> = ({ isOpen, onClose, onAdded }) => {
  const { currentUser } = useCurrentUser();
  const { currentLang } = useLanguage();

  const [title, setTitle] = useState('');
  const [dateOrEra, setDateOrEra] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80');
  const [question, setQuestion] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    familyService.addMemory({
      userId: currentUser.id,
      title,
      dateOrEra: dateOrEra || 'Family Memory',
      location: location || 'Varanasi',
      description,
      photoUrl,
      taggedMemberIds: [],
      reminiscenceQuestion: {
        en: question || `What do you remember most about ${title}?`,
        hi: question || `${title} के बारे में आपको सबसे प्यारी क्या बात याद है?`,
        as: question || `${title} ৰ বিষয়ে আটাইতকৈ মনত থকা কথা কি?`,
      },
      category: 'celebration',
      isFavorite: true,
    });

    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-4 border-amber-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'नई पारिवारिक याद जोड़ें' : currentLang === 'as' ? 'নতুন পৰিয়ালৰ স্মৃতি যোগ কৰক' : 'Add New Family Memory'}
            </h3>
            <p className="text-gray-500 text-xs sm:text-sm">
              {currentLang === 'hi' ? 'तस्वीर और यादें साझा कर अपने प्रियजनों को जोड़े रखें' : currentLang === 'as' ? 'ছবি আৰু স্মৃতিৰে আপোনজনক সুখী ৰাখক' : 'Share treasured photos and questions for reminiscence'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              {currentLang === 'hi' ? 'याद का शीर्षक' : currentLang === 'as' ? 'স্মৃতিৰ শীৰ্ষক' : 'Memory Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali in Courtyard, 1992"
              className="w-full p-3.5 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                {currentLang === 'hi' ? 'समय / वर्ष' : currentLang === 'as' ? 'সময় / বছৰ' : 'Date / Era'}
              </label>
              <input
                type="text"
                value={dateOrEra}
                onChange={(e) => setDateOrEra(e.target.value)}
                placeholder="e.g. Winter 1995"
                className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                {currentLang === 'hi' ? 'स्थान' : currentLang === 'as' ? 'স্থান' : 'Location'}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Varanasi, UP"
                className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              {currentLang === 'hi' ? 'तस्वीर का लिंक (Photo URL)' : currentLang === 'as' ? 'ছবিৰ লিংক' : 'Photo Image URL'}
            </label>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              {currentLang === 'hi' ? 'संक्षिप्त विवरण' : currentLang === 'as' ? 'বিৱৰণ' : 'Story / Description'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beautiful memories of celebrating with grandchildren..."
              className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
              {currentLang === 'hi' ? 'यादों की बात (Reminiscence Question)' : currentLang === 'as' ? 'স্মৃতিৰ প্ৰশ্ন' : 'Reminiscence Question'}
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Do you remember who made the tea that morning?"
              className="w-full p-3 rounded-2xl border-2 border-amber-300 bg-amber-50/50 focus:border-sathi-500 outline-none text-sm font-medium"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl border-2 border-gray-300 font-bold text-gray-700 cursor-pointer"
            >
              {currentLang === 'hi' ? 'रद्द करें' : currentLang === 'as' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-2xl bg-sathi-600 hover:bg-sathi-700 text-white font-bold shadow-tactile cursor-pointer"
            >
              {currentLang === 'hi' ? 'सहेजें (Save Memory)' : currentLang === 'as' ? 'সংৰক্ষণ কৰক' : 'Save Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
