import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  MessageSquare,
  Star,
  UserPlus,
  Camera,
  Check,
  Upload,
  Loader2,
  Info,
  X,
  Eye,
  Trash2,
  AlertTriangle,
  Copy,
  Shield,
  Heart,
} from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { familyService } from '../services/familyService';
import { storageService } from '../services/storageService';
import { caregiverService } from '../services/caregiverService';
import { FamilyMember } from '../types/family';
import { VoicePromptButton } from '../components/common/VoicePromptButton';
import { PatientCaregiverChatModal } from '../components/chat/PatientCaregiverChatModal';

export const FamilyCallingPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Real calling state
  const [callConfirmContact, setCallConfirmContact] = useState<FamilyMember | null>(null);
  const [dialingInfo, setDialingInfo] = useState<{ member: FamilyMember; phone: string } | null>(null);
  const [dialError, setDialError] = useState<string | null>(null);
  const [copiedDialPhone, setCopiedDialPhone] = useState(false);

  // Real caregiver chat modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [assignedCaregiver, setAssignedCaregiver] = useState<any | null>(null);
  const [loadingCaregiver, setLoadingCaregiver] = useState(true);

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

  // Delete Member state & handler
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

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

  // Load linked caregiver for real patient-caregiver chat
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest') {
      setLoadingCaregiver(false);
      return;
    }

    caregiverService
      .getAssignedCaregiverForPatient(currentUser.id)
      .then((cg) => {
        setAssignedCaregiver(cg);
      })
      .catch((err) => {
        console.warn('[FamilyCallingPage] Error fetching assigned caregiver:', err);
      })
      .finally(() => {
        setLoadingCaregiver(false);
      });
  }, [currentUser?.id]);

  // Real phone dialer trigger
  const handleInitiateCall = (member: FamilyMember) => {
    const raw = member.phone || '';
    const sanitized = raw.replace(/[^\d+]/g, '');
    if (!sanitized || sanitized.length < 5) {
      setDialError(`No valid phone number found for ${member.name}. Please edit or add a phone number.`);
      return;
    }
    setDialError(null);
    setCallConfirmContact(member);
  };

  const handleConfirmRealDial = (member: FamilyMember) => {
    const raw = member.phone || '';
    const sanitized = raw.replace(/[^\d+]/g, '');
    // Trigger real system/browser tel: URI
    window.location.href = `tel:${sanitized}`;
    setDialingInfo({ member, phone: member.phone });
    setCallConfirmContact(null);
  };

  const handleOpenChat = (member?: FamilyMember) => {
    setShowChatModal(true);
  };

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !currentUser?.id) return;
    setIsUploading(true);

    let resolvedPhotoUrl =
      photoPreview || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80';

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
              text="Family connection and real phone dialing panel. Connect directly with your children, grandchildren, and designated caregiver."
              size="sm"
            />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {t.family?.title || 'Family & Loved Ones'}
          </h1>
          <p className="text-rose-100 text-sm sm:text-base mt-1.5 font-medium max-w-xl">
            {currentLang === 'hi'
              ? 'एक स्पर्श से अपने बच्चों और परिवार से फोन पर बात करें। सुरक्षित पारिवारिक चैट।'
              : currentLang === 'as'
              ? 'এটা টিপাতে সন্তান আৰু পৰিয়ালৰ সৈতে ফোনত কথা পাতক। সুৰক্ষিত পাৰিবাৰিক বাৰ্তালাপ।'
              : 'Stay close to your loved ones with 1-tap real phone dialing and secure family chat.'}
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

      {/* ── DEDICATED CAREGIVER DIRECT CHAT & CONNECTION CARD ── */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-amber-950 text-white p-5 sm:p-6 rounded-3xl shadow-elder border border-emerald-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <img
              src={
                assignedCaregiver?.avatarUrl ||
                `https://api.dicebear.com/9.x/avataaars/svg?seed=caregiver&backgroundColor=b6e3f4`
              }
              alt="Caregiver"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 bg-emerald-800/50"
            />
            {assignedCaregiver && (
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-xs"
                title="Connected"
              />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white">
                {assignedCaregiver
                  ? assignedCaregiver.preferredName || assignedCaregiver.name
                  : 'Family Caregiver'}
              </h3>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  assignedCaregiver
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                }`}
              >
                {assignedCaregiver ? 'Linked Caregiver' : 'Caregiver Pending'}
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5">
              {assignedCaregiver
                ? 'Direct secure text messaging with your designated family caregiver.'
                : 'Share your connection code so your son or daughter can connect in Caregiver Portal.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowChatModal(true)}
            type="button"
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{assignedCaregiver ? 'Open Caregiver Chat' : 'Check Caregiver Chat'}</span>
          </button>
        </div>
      </div>

      {/* Dial Error Banner */}
      {dialError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{dialError}</span>
          </div>
          <button
            onClick={() => setDialError(null)}
            type="button"
            className="text-red-700 hover:text-red-900 font-extrabold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
                      <span
                        className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-lg shadow text-[10px]"
                        title="View Details"
                      >
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

                  {/* 2 Big Action Buttons: Real Phone Call & Secure Chat (Video Removed) */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleInitiateCall(member)}
                      type="button"
                      className="py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
                      title={`Call ${member.name}`}
                    >
                      <Phone className="w-5 h-5 fill-current" />
                      <span>Call</span>
                    </button>

                    <button
                      onClick={() => handleOpenChat(member)}
                      type="button"
                      className="py-3.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
                      title="Send message"
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
                    onClick={() => handleInitiateCall(member)}
                    type="button"
                    className="p-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 cursor-pointer transition-colors"
                    title={`Call ${member.name}`}
                  >
                    <Phone className="w-4 h-4 fill-current" />
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

      {/* ── REAL PHONE CALL CONFIRMATION MODAL ── */}
      {callConfirmContact && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border-2 border-emerald-300 text-center relative animate-in zoom-in-95">
            <div className="relative mb-4 mx-auto w-24 h-24">
              <img
                src={callConfirmContact.photoUrl}
                alt={callConfirmContact.name}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-emerald-400 shadow-md mx-auto"
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1.5 rounded-xl shadow-xs">
                <Phone className="w-4 h-4 fill-current" />
              </span>
            </div>

            <h3 className="text-xl font-black text-gray-900">{callConfirmContact.name}</h3>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
              {typeof callConfirmContact.relationship === 'string'
                ? callConfirmContact.relationship
                : callConfirmContact.relationship[currentLang] || callConfirmContact.relationship.en}
            </p>

            <div className="my-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
                Phone Number
              </p>
              <p className="text-2xl font-black font-mono text-emerald-950 tracking-wider">
                {callConfirmContact.phone}
              </p>
            </div>

            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Clicking <strong>Call Now</strong> will open your phone dialer. On computer without calling apps, you can dial this number directly on your mobile handset.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCallConfirmContact(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmRealDial(callConfirmContact)}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <Phone className="w-4 h-4 fill-current" />
                <span>Call Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POST-DIAL NOTIFICATION / DESKTOP GRACEFUL DIALOG ── */}
      {dialingInfo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 text-center relative animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Phone className="w-7 h-7 fill-current animate-bounce" />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-1">
              Dialing {dialingInfo.member.name}
            </h3>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Your device phone application has been opened with the contact number:
            </p>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-2 mb-4">
              <span className="font-mono text-lg font-black text-gray-900">
                {dialingInfo.phone}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(dialingInfo.phone);
                  setCopiedDialPhone(true);
                  setTimeout(() => setCopiedDialPhone(false), 2000);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 hover:bg-emerald-200 transition-colors cursor-pointer"
              >
                {copiedDialPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDialPhone ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-500 mb-5 leading-normal">
              Please complete and speak the call on your phone or dialer window. MIND SATHI never records private phone conversations.
            </p>

            <button
              type="button"
              onClick={() => {
                setDialingInfo(null);
                setCopiedDialPhone(false);
              }}
              className="w-full py-3 rounded-xl bg-gray-900 text-white font-extrabold text-xs hover:bg-gray-800 transition-all cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* ── REAL PATIENT-CAREGIVER CHAT MODAL ── */}
      <PatientCaregiverChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        partner={
          assignedCaregiver
            ? {
                id: assignedCaregiver.id,
                name: assignedCaregiver.preferredName || assignedCaregiver.name,
                preferredName: assignedCaregiver.preferredName,
                role: 'caregiver',
                avatarUrl: assignedCaregiver.avatarUrl,
                phone: assignedCaregiver.phone,
                relationship: 'Family Caregiver',
              }
            : null
        }
        currentUserId={currentUser?.id || ''}
        currentUserRole="elderly"
        isPartnerLinked={Boolean(assignedCaregiver)}
        patientConnectionCode={
          currentUser?.connectionCode ||
          ('MS-' + (currentUser?.id || '').replace(/-/g, '').substring(0, 6).toUpperCase())
        }
      />

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Add Family Member</h3>
            <p className="text-xs text-gray-500 mb-4">
              Add children, grandchildren or caregiver contacts for 1-tap phone dialing.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
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
            <button
              onClick={() => setSelectedDetailMember(null)}
              type="button"
              className="absolute top-5 right-5 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
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

              <div className="flex-1 text-center sm:text-left space-y-2.5">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-2xl font-black text-gray-900 leading-tight">
                    {selectedDetailMember.name}
                  </h3>
                  {selectedDetailMember.isFavorite && (
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>

                <div className="inline-flex flex-wrap items-center gap-1.5 justify-center sm:justify-start">
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs">
                    {typeof selectedDetailMember.relationship === 'string'
                      ? selectedDetailMember.relationship
                      : selectedDetailMember.relationship[currentLang] || selectedDetailMember.relationship.en}
                  </span>
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
                  ✓ Photo synced for Family Recognition & Real Phone Calling
                </div>
              </div>
            </div>

            {/* Quick Action Buttons (Video Call Removed) */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  handleInitiateCall(m);
                }}
                type="button"
                className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-tactile transition-all cursor-pointer"
              >
                <Phone className="w-5 h-5 fill-current" />
                <span>Call Phone</span>
              </button>

              <button
                onClick={() => {
                  const m = selectedDetailMember;
                  setSelectedDetailMember(null);
                  handleOpenChat(m);
                }}
                type="button"
                className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-tactile transition-all cursor-pointer"
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
