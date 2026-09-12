import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  MessageSquare,
  Star,
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Send,
  UserPlus,
  Sparkles,
  Camera,
  CameraOff,
  Check,
  Clock,
  Heart,
  Smile,
  Upload,
  Loader2,
  Info,
  X,
  Eye,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { familyService } from '../services/familyService';
import { storageService } from '../services/storageService';
import { FamilyMember, CallSession, ChatMessage } from '../types/family';
import { VoicePromptButton } from '../components/common/VoicePromptButton';

export const FamilyCallingPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Active call modal state
  const [activeCall, setActiveCall] = useState<{
    member: FamilyMember;
    type: 'voice' | 'video';
    timer: number;
    isMuted: boolean;
    isSpeaker: boolean;
    isVideoActive: boolean;
  } | null>(null);

  // Active chat modal state
  const [activeChat, setActiveChat] = useState<{
    member: FamilyMember;
    messages: ChatMessage[];
    input: string;
  } | null>(null);

  // Add Member modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('Son');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Member Detail modal & photo update state
  const [selectedDetailMember, setSelectedDetailMember] = useState<FamilyMember | null>(null);
  const [isUpdatingDetailPhoto, setIsUpdatingDetailPhoto] = useState(false);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateDetailPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetailMember || !currentUser?.id) return;
    setIsUpdatingDetailPhoto(true);
    try {
      const photoUrl = await storageService.processAndStorePhoto(
        'family-photos',
        currentUser.id,
        file,
        file.name
      );
      const updated = familyService.updateFamilyMember(selectedDetailMember.id, { photoUrl });
      if (updated) {
        setSelectedDetailMember(updated);
        setFamilyMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (err) {
      console.warn('Error updating photo:', err);
    } finally {
      setIsUpdatingDetailPhoto(false);
    }
  };

  // Delete Member state & handler
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeletingMember(true);
    try {
      await familyService.deleteFamilyMember(memberToDelete.id, currentUser?.id, memberToDelete.name);
      setFamilyMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      if (selectedDetailMember?.id === memberToDelete.id) {
        setSelectedDetailMember(null);
      }
      setMemberToDelete(null);
    } catch (err) {
      console.error('Error deleting family member:', err);
    } finally {
      setIsDeletingMember(false);
    }
  };

  // Load family members (sync from Supabase for real users)
  useEffect(() => {
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

  // Live timer for active call
  useEffect(() => {
    let interval: any = null;
    if (activeCall) {
      interval = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, timer: prev.timer + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = (member: FamilyMember, type: 'voice' | 'video') => {
    setActiveCall({
      member,
      type,
      timer: 0,
      isMuted: false,
      isSpeaker: true,
      isVideoActive: type === 'video',
    });
  };

  const handleEndCall = () => {
    if (activeCall) {
      familyService.recordCall({
        id: `call-${Date.now()}`,
        contactId: activeCall.member.id,
        contactName: activeCall.member.name,
        contactPhoto: activeCall.member.photoUrl,
        relationship: typeof activeCall.member.relationship === 'string'
          ? activeCall.member.relationship
          : activeCall.member.relationship.en,
        type: activeCall.type,
        status: 'ended',
        durationSeconds: activeCall.timer,
        isMuted: activeCall.isMuted,
        isSpeakerOn: activeCall.isSpeaker,
        isVideoEnabled: activeCall.isVideoActive,
      });
    }
    setActiveCall(null);
  };

  const handleOpenChat = (member: FamilyMember) => {
    setActiveChat({
      member,
      messages: familyService.getMessages(),
      input: '',
    });
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || activeChat?.input;
    if (!text?.trim() || !activeChat) return;

    const userMsg = familyService.sendMessage(text, true, currentUser?.preferredName || 'Me');
    setActiveChat((prev) =>
      prev ? { ...prev, messages: [...prev.messages, userMsg], input: '' } : null
    );

    // Simulated warm automated response after 1.5s
    setTimeout(() => {
      const replies = [
        'Glad to hear that, Deuta! Take rest and drink your herbal tea.',
        'Love you so much! Sending you lots of love from Guwahati.',
        'Got your message! I will call you this evening after work.',
        'Shabash! Keep playing your brain games, we are so proud of you!',
      ];
      const replyText = replies[Math.floor(Math.random() * replies.length)];
      const replyMsg = familyService.sendMessage(replyText, false, activeChat.member.name);
      setActiveChat((prev) =>
        prev ? { ...prev, messages: [...prev.messages, replyMsg] } : null
      );
    }, 1500);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !currentUser?.id) return;
    setIsUploading(true);

    let resolvedPhotoUrl =
      photoPreview || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80';

    // Compress & persist photo to Supabase storage / database
    if (photoFile) {
      resolvedPhotoUrl = await storageService.processAndStorePhoto(
        'family-photos',
        currentUser.id,
        photoFile,
        photoFile.name
      );
    }

    const member = familyService.addFamilyMember({
      userId: currentUser.id,
      name: newMemberName.trim(),
      relationship: { en: newMemberRel, hi: newMemberRel, as: newMemberRel },
      relationType: newMemberRel,
      photoUrl: resolvedPhotoUrl,
      phone: newMemberPhone.trim() || '+91 94350 00000',
      isFavorite: false,
      isOnline: true,
      city: currentUser.state || 'Assam',
    });

    setFamilyMembers([...familyMembers, member]);
    setIsUploading(false);
    setShowAddModal(false);
    setNewMemberName('');
    setNewMemberPhone('');
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const quickPhrases = [
    'I took my medicines! 💊',
    'I just had my tea & meal ☕',
    'Feeling happy & active today! 😊',
    'Please call me when you are free 📞',
    'Missing you all! ❤️',
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-500 via-amber-600 to-orange-500 text-white p-6 sm:p-8 rounded-3xl shadow-elder relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">❤️</span>
            <span className="text-xs uppercase tracking-widest font-extrabold text-rose-100">
              {currentLang === 'hi' ? 'परिवार व आत्मीय जन' : currentLang === 'as' ? 'পৰিয়াল আৰু আপোনজন' : 'Family Connection & Calling'}
            </span>
            <VoicePromptButton
              text="Family connection and one tap calling panel. Connect with your children and grandchildren anytime."
              size="sm"
            />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {t.family?.title || 'Family & Loved Ones'}
          </h1>
          <p className="text-rose-100 text-sm sm:text-base mt-1.5 font-medium max-w-xl">
            {currentLang === 'hi'
              ? 'एक स्पर्श से अपने बच्चों और परिवार से जुड़ें। बड़े बटन और सरल इंटरफ़ेस।'
              : currentLang === 'as'
              ? 'এটা টিপাতে সন্তান আৰু পৰিয়ালৰ সৈতে কথা পাতক। ডাঙৰ বুটাম আৰু সহজ পদ্ধতি।'
              : 'Stay close to your children and grandchildren with one-touch voice and video calls.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          type="button"
          className="self-start sm:self-auto bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Family Member</span>
        </button>
      </div>

      {/* Primary Favorite Contacts Section */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span>{t.family?.favoriteContacts || 'Primary Family Contacts'}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {familyMembers
            .filter((m) => m.isFavorite || m.isPrimaryContact)
            .map((member) => {
              const relText =
                typeof member.relationship === 'string'
                  ? member.relationship
                  : member.relationship[currentLang] || member.relationship.en;

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-3xl p-5 border-2 border-amber-200/90 shadow-elder hover:shadow-xl transition-all flex flex-col justify-between relative overflow-hidden group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedDetailMember(member)}
                      className="relative cursor-pointer transition-transform hover:scale-105 shrink-0"
                      title="Click to view photo & details"
                    >
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-300 shadow-md"
                      />
                      {member.isOnline && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                          title="Online now"
                        />
                      )}
                      <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-lg shadow text-[10px]" title="View Details">
                        <Eye className="w-3 h-3" />
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailMember(member)}
                          className="text-lg font-black text-gray-900 leading-tight hover:text-sathi-600 truncate text-left cursor-pointer"
                        >
                          {member.name}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToDelete(member);
                            }}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove family member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mt-0.5">
                        {relText}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{member.phone}</span>
                      </p>
                      {member.city && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{member.city}</p>
                      )}
                    </div>
                  </div>

                  {/* 3 Big Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleStartCall(member, 'voice')}
                      type="button"
                      className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
                    >
                      <Phone className="w-5 h-5 fill-current" />
                      <span>Call</span>
                    </button>

                    <button
                      onClick={() => handleStartCall(member, 'video')}
                      type="button"
                      className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
                    >
                      <Video className="w-5 h-5" />
                      <span>Video</span>
                    </button>

                    <button
                      onClick={() => handleOpenChat(member)}
                      type="button"
                      className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* All Family Members Grid */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">All Registered Family Members</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configured during onboarding • Easily reachable at any time
            </p>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {familyMembers.length} Family Members
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {familyMembers.map((member) => {
            const relText =
              typeof member.relationship === 'string'
                ? member.relationship
                : member.relationship[currentLang] || member.relationship.en;

            return (
              <div
                key={member.id}
                className="p-4 rounded-2xl border border-gray-200 hover:border-sathi-300 hover:shadow-md transition-all flex items-center justify-between gap-3 bg-gray-50/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailMember(member)}
                    className="relative shrink-0 cursor-pointer transition-transform hover:scale-105"
                    title="Click to view photo & details"
                  >
                    <img
                      src={member.photoUrl}
                      alt={member.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-amber-300 shadow-xs"
                    />
                    {member.isOnline && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDetailMember(member)}
                      className="text-sm font-bold text-gray-900 leading-tight hover:text-sathi-600 truncate text-left block cursor-pointer"
                    >
                      {member.name}
                    </button>
                    <span className="text-[11px] font-bold text-sathi-700">{relText}</span>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">{member.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedDetailMember(member)}
                    type="button"
                    className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
                    title="View Photo & Details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(member, 'voice')}
                    type="button"
                    className="p-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 cursor-pointer transition-colors"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={() => handleStartCall(member, 'video')}
                    type="button"
                    className="p-2.5 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 cursor-pointer transition-colors"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenChat(member)}
                    type="button"
                    className="p-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer transition-colors"
                    title="Message"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberToDelete(member);
                    }}
                    type="button"
                    className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 cursor-pointer transition-colors"
                    title="Remove family member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REALISTIC VOICE CALL MODAL */}
      {activeCall && activeCall.type === 'voice' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-gray-900 to-black text-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/20 text-center flex flex-col items-center">
            {/* Status indicator */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold mb-6 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Connected • HD Audio</span>
            </div>

            {/* Profile Avatar with Audio Pulse Ring */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping scale-110" />
              <img
                src={activeCall.member.photoUrl}
                alt={activeCall.member.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-emerald-400 shadow-2xl relative z-10"
              />
            </div>

            <h3 className="text-2xl font-black">{activeCall.member.name}</h3>
            <p className="text-sm font-semibold text-emerald-300 mt-1">
              {typeof activeCall.member.relationship === 'string'
                ? activeCall.member.relationship
                : activeCall.member.relationship[currentLang] || activeCall.member.relationship.en}
            </p>

            {/* Call Duration Timer */}
            <div className="text-3xl font-mono font-bold tracking-widest text-white mt-4 mb-8">
              {formatTimer(activeCall.timer)}
            </div>

            {/* Controls: Mute, Speaker, End Call */}
            <div className="flex items-center justify-center gap-6 w-full">
              <button
                onClick={() =>
                  setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))
                }
                type="button"
                className={`p-4 rounded-full border transition-all cursor-pointer ${
                  activeCall.isMuted
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
                title="Mute microphone"
              >
                {activeCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={handleEndCall}
                type="button"
                className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl scale-110 active:scale-95 transition-transform cursor-pointer"
                title="End Call"
              >
                <PhoneOff className="w-8 h-8 fill-current" />
              </button>

              <button
                onClick={() =>
                  setActiveCall((prev) => (prev ? { ...prev, isSpeaker: !prev.isSpeaker } : null))
                }
                type="button"
                className={`p-4 rounded-full border transition-all cursor-pointer ${
                  activeCall.isSpeaker
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
                title="Speakerphone"
              >
                {activeCall.isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REALISTIC VIDEO CALL MODAL */}
      {activeCall && activeCall.type === 'video' && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-gray-900 flex flex-col justify-between">
            {/* Main Simulated Remote Video Stream */}
            <div className="absolute inset-0 z-0">
              <img
                src={activeCall.member.photoUrl}
                alt={activeCall.member.name}
                className="w-full h-full object-cover filter brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
            </div>

            {/* Top Bar with Name and Live Timer */}
            <div className="relative z-10 p-6 flex items-center justify-between text-white">
              <div>
                <h3 className="text-xl font-black">{activeCall.member.name}</h3>
                <span className="text-xs font-semibold text-emerald-300">
                  Video Call Active • 1080p
                </span>
              </div>
              <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full font-mono text-sm font-bold border border-white/20">
                {formatTimer(activeCall.timer)}
              </div>
            </div>

            {/* PIP Local Camera Self View */}
            <div className="absolute right-6 bottom-28 z-10 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white shadow-2xl bg-black">
              <img
                src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'}
                alt="My camera"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                You
              </span>
            </div>

            {/* Bottom Call Controls */}
            <div className="relative z-10 p-6 flex items-center justify-center gap-5">
              <button
                onClick={() =>
                  setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))
                }
                type="button"
                className={`p-4 rounded-full border transition-all cursor-pointer ${
                  activeCall.isMuted
                    ? 'bg-red-500/80 border-red-400 text-white'
                    : 'bg-black/60 backdrop-blur-md border-white/30 text-white hover:bg-black/80'
                }`}
              >
                {activeCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={() =>
                  setActiveCall((prev) => (prev ? { ...prev, isVideoActive: !prev.isVideoActive } : null))
                }
                type="button"
                className={`p-4 rounded-full border transition-all cursor-pointer ${
                  !activeCall.isVideoActive
                    ? 'bg-red-500/80 border-red-400 text-white'
                    : 'bg-black/60 backdrop-blur-md border-white/30 text-white hover:bg-black/80'
                }`}
              >
                {activeCall.isVideoActive ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
              </button>

              <button
                onClick={handleEndCall}
                type="button"
                className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl active:scale-95 transition-transform cursor-pointer"
              >
                <PhoneOff className="w-8 h-8 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MESSAGING MODAL */}
      {activeChat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            {/* Chat Header */}
            <div className="p-4 bg-sathi-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeChat.member.photoUrl}
                  alt={activeChat.member.name}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white"
                />
                <div>
                  <h3 className="font-bold text-base leading-tight">{activeChat.member.name}</h3>
                  <p className="text-xs text-amber-200">
                    {typeof activeChat.member.relationship === 'string'
                      ? activeChat.member.relationship
                      : activeChat.member.relationship.en} • Family Chat
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveChat(null)}
                type="button"
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]">
              {activeChat.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isFromElderly ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-sm font-semibold shadow-xs ${
                      msg.isFromElderly
                        ? 'bg-sathi-600 text-white rounded-br-none'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 font-mono">{msg.timestamp}</span>
                </div>
              ))}
            </div>

            {/* 1-Tap Quick Elder Phrases */}
            <div className="p-3 bg-white border-t border-gray-100 overflow-x-auto scrollbar-none flex gap-2">
              {quickPhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(phrase)}
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold whitespace-nowrap cursor-pointer transition-all"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                value={activeChat.input}
                onChange={(e) => setActiveChat({ ...activeChat, input: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sathi-500"
              />
              <button
                onClick={() => handleSendMessage()}
                type="button"
                className="p-2.5 rounded-xl bg-sathi-600 hover:bg-sathi-700 text-white shadow-sm cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Add Family Member</h3>
            <p className="text-xs text-gray-500 mb-4">
              Add children, grandchildren or caregiver contacts for 1-tap calling.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
              {/* Photo picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Photo (optional)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sathi-50 hover:bg-sathi-100 border border-sathi-200 text-sathi-700 text-xs font-bold cursor-pointer transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Choose Photo
                    </button>
                    {photoFile && (
                      <p className="text-[10px] text-gray-500 truncate max-w-[160px]">{photoFile.name}</p>
                    )}
                  </div>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setPhotoFile(f);
                        const preview = await storageService.compressImage(f);
                        setPhotoPreview(preview);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Kalyani Borah"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Relationship</label>
                <select
                  value={newMemberRel}
                  onChange={(e) => setNewMemberRel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500 cursor-pointer"
                >
                  {['Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Grandchild', 'Friend', 'Caregiver', 'Other'].map(
                    (rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (+91)</label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="e.g. +91 94350 12890"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setPhotoFile(null);
                    setPhotoPreview('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 rounded-xl bg-sathi-600 hover:bg-sathi-700 text-white text-xs font-bold shadow-tactile cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</>
                  ) : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAMILY MEMBER DETAILS & PHOTO MODAL */}
      {selectedDetailMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 relative overflow-hidden">
            {/* Close Button */}
            <button
              onClick={() => setSelectedDetailMember(null)}
              type="button"
              className="absolute top-5 right-5 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Photo & Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
              {/* Large Photo with Update Option */}
              <div className="flex flex-col items-center gap-2.5 shrink-0">
                <div className="relative group">
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-lg border-4 border-amber-300/80 bg-gray-100">
                    <img
                      src={selectedDetailMember.photoUrl}
                      alt={selectedDetailMember.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {selectedDetailMember.isOnline && (
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-3 border-white shadow-xs"
                      title="Online now"
                    />
                  )}
                  {isUpdatingDetailPhoto && (
                    <div className="absolute inset-0 bg-black/50 rounded-3xl flex items-center justify-center text-white">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Change / Update Photo Button */}
                <button
                  type="button"
                  disabled={isUpdatingDetailPhoto}
                  onClick={() => detailFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sathi-50 hover:bg-sathi-100 border border-sathi-300 text-sathi-700 text-xs font-bold cursor-pointer transition-all shadow-xs disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isUpdatingDetailPhoto ? 'Saving…' : 'Change Photo'}</span>
                </button>
                <input
                  ref={detailFileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={isUpdatingDetailPhoto}
                  className="hidden"
                  onChange={handleUpdateDetailPhoto}
                />
              </div>

              {/* Info Details */}
              <div className="flex-1 text-center sm:text-left space-y-2.5">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-2xl font-black text-gray-900 leading-tight">
                    {selectedDetailMember.name}
                  </h3>
                  {selectedDetailMember.isFavorite && (
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>

                {/* Relationship Tag with Multilingual Labels */}
                <div className="inline-flex flex-wrap items-center gap-1.5 justify-center sm:justify-start">
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs">
                    {typeof selectedDetailMember.relationship === 'string'
                      ? selectedDetailMember.relationship
                      : selectedDetailMember.relationship[currentLang] || selectedDetailMember.relationship.en}
                  </span>
                  {typeof selectedDetailMember.relationship !== 'string' && (
                    <>
                      {selectedDetailMember.relationship.hi && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                          {selectedDetailMember.relationship.hi}
                        </span>
                      )}
                      {selectedDetailMember.relationship.as && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                          {selectedDetailMember.relationship.as}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <p className="text-sm font-semibold text-gray-700 flex items-center justify-center sm:justify-start gap-2 font-mono pt-1">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{selectedDetailMember.phone || 'No phone recorded'}</span>
                </p>

                {selectedDetailMember.city && (
                  <p className="text-xs text-gray-500">
                    📍 {selectedDetailMember.city}
                  </p>
                )}

                <div className="text-[11px] text-gray-400 pt-1">
                  ✓ Photo synced for Family Recognition Game & 1-Tap Calling
                </div>
              </div>
            </div>

            {/* Quick Action Calling Buttons */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  handleStartCall(m, 'voice');
                }}
                type="button"
                className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer"
              >
                <Phone className="w-5 h-5 fill-current" />
                <span>Voice Call</span>
              </button>

              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  handleStartCall(m, 'video');
                }}
                type="button"
                className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer"
              >
                <Video className="w-5 h-5" />
                <span>Video Call</span>
              </button>

              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  handleOpenChat(m);
                }}
                type="button"
                className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex flex-col items-center justify-center gap-1 shadow-tactile transition-all cursor-pointer"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat Message</span>
              </button>
            </div>

            {/* Delete Option in Details Modal */}
            <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between mt-4">
              <span className="text-[11px] text-gray-400 font-medium">
                Want to remove this contact?
              </span>
              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  setMemberToDelete(m);
                }}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Family Member</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 text-center relative animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-1">
              {currentLang === 'hi' ? 'पारिवारिक सदस्य हटाएं?' : currentLang === 'as' ? 'পৰিয়ালৰ সদস্য আঁতৰাবনে?' : 'Remove Family Member?'}
            </h3>

            <p className="text-xs text-gray-600 mb-4 font-medium leading-relaxed">
              {currentLang === 'hi'
                ? `क्या आप सचमुच "${memberToDelete.name}" को अपने संपर्कों और डेटाबेस से हटाना चाहते हैं?`
                : currentLang === 'as'
                ? `আপুনি সঁচাকৈ "${memberToDelete.name}" ক আপোনাৰ যোগাযোগ আৰু ডাটাবেছৰ পৰা আঁতৰাব বিচাৰেনে?`
                : `Are you sure you want to remove "${memberToDelete.name}" from your family contacts and database?`}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isDeletingMember}
                onClick={() => setMemberToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
              >
                {currentLang === 'hi' ? 'रद्द करें' : currentLang === 'as' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isDeletingMember}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingMember ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{currentLang === 'hi' ? 'हटा रहे हैं…' : 'Removing…'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{currentLang === 'hi' ? 'हाँ, हटाएं' : currentLang === 'as' ? 'আঁতৰাওক' : 'Yes, Remove'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
