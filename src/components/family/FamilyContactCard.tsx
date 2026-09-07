import React, { useState } from 'react';
import { FamilyMember } from '../../types/family';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { Phone, Heart, CheckCircle2, ShieldCheck } from 'lucide-react';

export const FamilyContactCard: React.FC<{ member: FamilyMember }> = ({ member }) => {
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();
  const [calling, setCalling] = useState(false);

  const handleSimulateCall = () => {
    setCalling(true);
    const text = currentLang === 'hi'
      ? `${member.name} से बात हो रही है...`
      : currentLang === 'as'
      ? `${member.name} ৰ সৈতে সংযোগ হৈছে...`
      : `Connecting call to ${member.name}...`;
    speakText(text);

    setTimeout(() => {
      setCalling(false);
    }, 4000);
  };

  const relation = typeof member.relationship === 'string'
    ? member.relationship
    : ((member.relationship as Record<string, string>)[currentLang] || (member.relationship as Record<string, string>).en || '');

  return (
    <div className="bg-white p-5 rounded-3xl shadow-elder border border-gray-200 flex flex-col justify-between">
      <div className="flex items-center gap-4 mb-4">
        <img
          src={member.photoUrl}
          alt={member.name}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-sathi-200 shadow-sm shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold text-gray-900 truncate">{member.name}</h4>
            {member.isEmergencyContact && (
              <span className="shrink-0 text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-300">
                SOS
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-sathi-700 uppercase">{relation}</p>
          <p className="text-xs text-gray-500 truncate">{member.city}</p>
        </div>
      </div>

      {member.notes && (
        <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mb-4 line-clamp-2">
          {member.notes}
        </p>
      )}

      <button
        onClick={handleSimulateCall}
        type="button"
        className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
          calling
            ? 'bg-emerald-600 text-white animate-pulse'
            : 'bg-sathi-50 hover:bg-sathi-100 text-sathi-800 border-2 border-sathi-300'
        }`}
      >
        <Phone className="w-4 h-4" />
        <span>
          {calling
            ? (currentLang === 'hi' ? 'कॉल मिल रहा है...' : currentLang === 'as' ? 'সংযোগ হৈছে...' : 'Calling...')
            : (currentLang === 'hi' ? 'फोन करें' : currentLang === 'as' ? 'ফোন কৰক' : 'Voice Call')}
        </span>
      </button>
    </div>
  );
};
