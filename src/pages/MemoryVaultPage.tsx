import React, { useState } from 'react';
import { familyService } from '../services/familyService';
import { FamilyMember } from '../types/family';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { useSpeech } from '../hooks/useSpeech';
import { MemoryVaultGrid } from '../components/family/MemoryVaultGrid';
import { FamilyContactCard } from '../components/family/FamilyContactCard';
import { AddMemoryModal } from '../components/family/AddMemoryModal';
import { VoicePromptButton } from '../components/common/VoicePromptButton';
import { Heart, Plus, Users, Sparkles } from 'lucide-react';

export const MemoryVaultPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memories, setMemories] = useState(() => familyService.getMemoriesForUser(currentUser.id));
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() =>
    familyService.getFamilyMembersForUser(currentUser.id)
  );

  React.useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.id === 'guest') return;
    const isRealUser = currentUser.id.includes('-') && currentUser.id.length > 20;
    if (isRealUser) {
      familyService.syncFamilyMembersFromDb(currentUser.id).then((members) => {
        setFamilyMembers(members);
      });
    } else {
      setFamilyMembers(familyService.getFamilyMembersForUser(currentUser.id));
    }
  }, [currentUser?.id]);

  const refreshMemories = () => {
    setMemories(familyService.getMemoriesForUser(currentUser.id));
  };

  const intro = currentLang === 'hi'
    ? 'पारिवारिक यादें और पुरानी तस्वीरें आपकी पुरानी याददाश्त (एपिसोडिक मेमोरी) को सुरक्षित रखती हैं और मन में आनंद जगाती हैं।'
    : currentLang === 'as'
    ? 'পৰিয়ালৰ পুৰণি স্মৃতি আৰু ফটোৱে মনত আনন্দ দিয়ে আৰু স্মৃতি সতেজ ৰাখে।'
    : 'Treasured family memories and reminiscence questions stimulate episodic retrieval and emotional wellness.';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white p-6 sm:p-8 rounded-3xl shadow-elder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-7 h-7 fill-white/80" />
            <h1 className="text-2xl sm:text-3xl font-extrabold">{t.nav.memories}</h1>
            <VoicePromptButton text={intro} size="sm" />
          </div>
          <p className="text-rose-100 text-sm sm:text-base max-w-2xl mt-1 leading-relaxed">
            {intro}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          type="button"
          className="bg-white hover:bg-rose-50 text-rose-700 font-extrabold px-6 py-3.5 rounded-2xl shadow-tactile flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>{currentLang === 'hi' ? 'नई याद जोड़ें' : currentLang === 'as' ? 'নতুন স্মৃতি যোগ' : 'Add Memory'}</span>
        </button>
      </div>

      {/* Family Directory Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-6 h-6 text-sathi-600" />
          <h2 className="text-2xl font-extrabold text-gray-900">
            {currentLang === 'hi' ? 'मेरे अपने (परिवार)' : currentLang === 'as' ? 'মোৰ আপোনজন' : 'Family Members & Loved Ones'}
          </h2>
        </div>
        {familyMembers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {familyMembers.map((member) => (
              <FamilyContactCard key={member.id} member={member} />
            ))}
          </div>
        ) : (
          <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 text-center max-w-xl mx-auto">
            <Users className="w-10 h-10 text-amber-600 mx-auto mb-2" />
            <h3 className="font-extrabold text-gray-900 text-base">
              {currentLang === 'hi' ? 'कोई पारिवारिक सदस्य नहीं मिला' : currentLang === 'as' ? 'কোনো পৰিয়ালৰ সদস্য নাই' : 'No Family Members Added Yet'}
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              {currentLang === 'hi' ? 'परिवार पृष्ठ पर जाएं और फोटो के साथ सदस्यों को जोड़ें।' : currentLang === 'as' ? 'পৰিয়াল পৃষ্ঠালৈ যাওক আৰু ফটোৰ সৈতে সদস্য যোগ কৰক।' : 'Visit the Family Calling page to add family members with photos.'}
            </p>
          </div>
        )}
      </div>

      {/* Reminiscence Memories Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6 text-amber-600" />
          <h2 className="text-2xl font-extrabold text-gray-900">
            {currentLang === 'hi' ? 'यादों का झरोखा (Memory Vault)' : currentLang === 'as' ? 'স্মৃতিৰ ভঁৰাল' : 'Reminiscence Photo Stories'}
          </h2>
        </div>
        <MemoryVaultGrid memories={memories} onMemoryUpdated={refreshMemories} />
      </div>

      {/* Add Memory Modal */}
      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={refreshMemories}
      />
    </div>
  );
};
