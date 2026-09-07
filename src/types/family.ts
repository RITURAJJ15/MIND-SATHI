export type RelationshipType = 
  | 'Son' 
  | 'Daughter' 
  | 'Spouse' 
  | 'Brother' 
  | 'Sister' 
  | 'Grandchild' 
  | 'Friend' 
  | 'Caregiver' 
  | 'Other';

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relationship: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  } | string;
  relationType?: string;
  photoUrl: string;
  phone: string;
  email?: string;
  city?: string;
  notes?: string;
  isEmergencyContact?: boolean;
  isFavorite?: boolean;
  isPrimaryContact?: boolean;
  isOnline?: boolean;
  lastCallTimestamp?: string;
}

export interface CallSession {
  id: string;
  contactId: string;
  contactName: string;
  contactPhoto: string;
  relationship: string;
  type: 'voice' | 'video';
  status: 'connecting' | 'active' | 'ended';
  durationSeconds: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isFromElderly: boolean;
}

export interface MemoryVaultItem {
  id: string;
  userId: string;
  title: string;
  dateOrEra: string; // e.g. "Diwali 1982", "Trip to Kaziranga 1995"
  location: string;
  description: string;
  photoUrl: string;
  audioNoteUrl?: string; // Voice recording simulation
  taggedMemberIds: string[];
  reminiscenceQuestion: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  category: 'festival' | 'wedding' | 'travel' | 'childhood' | 'cooking' | 'celebration';
  isFavorite: boolean;
  timesRecalled: number;
  lastRecalledAt?: string;
  createdAt: string;
}
