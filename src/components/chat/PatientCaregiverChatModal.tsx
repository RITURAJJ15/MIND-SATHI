import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  Phone,
  Shield,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { chatService, DbMessage } from '../../services/chatService';

export interface ChatPartnerInfo {
  id: string;
  name: string;
  preferredName?: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  relationship?: string;
}

interface PatientCaregiverChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: ChatPartnerInfo | null;
  currentUserId: string;
  currentUserRole: 'elderly' | 'caregiver';
  isPartnerLinked: boolean;
  patientConnectionCode?: string;
}

export const PatientCaregiverChatModal: React.FC<PatientCaregiverChatModalProps> = ({
  isOpen,
  onClose,
  partner,
  currentUserId,
  currentUserRole,
  isPartnerLinked,
  patientConnectionCode,
}) => {
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick 1-tap phrases for seniors
  const elderQuickPhrases = [
    'I took my medicines! 💊',
    'I just had my meal & tea ☕',
    'Feeling happy & active today! 😊',
    'Please call me when you are free 📞',
    'Missing you all! ❤️',
    'Finished my brain games today! 🧠',
  ];

  // Quick 1-tap phrases for caregivers
  const caregiverQuickPhrases = [
    'How are you feeling today, Baba? 😊',
    'Remember to drink plenty of warm water! 💧',
    'I will call you this evening after work 📞',
    'Great job on your brain exercises today! 🌟',
    'Did you take your medicines on time? 💊',
  ];

  const quickPhrases = currentUserRole === 'elderly' ? elderQuickPhrases : caregiverQuickPhrases;

  // Auto-scroll to bottom of conversation
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // 1. Fetch initial message history
  useEffect(() => {
    if (!isOpen || !partner?.id || !isPartnerLinked) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    chatService
      .fetchConversation(partner.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setMessages(res.messages);
          // Mark incoming messages as read
          chatService.markAsRead(partner.id);
        } else {
          setLoadError(res.error || 'Failed to load conversation history.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err.message || 'An unexpected error occurred while loading chat.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          setTimeout(() => scrollToBottom(false), 50);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, partner?.id, isPartnerLinked]);

  // 2. Setup Realtime subscription on Supabase
  useEffect(() => {
    if (!isOpen || !partner?.id || !currentUserId || !isPartnerLinked) {
      return;
    }

    const unsubscribe = chatService.subscribeToConversation(
      currentUserId,
      partner.id,
      (newMsg) => {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Mark as read if from partner
        if (newMsg.sender_id === partner.id) {
          chatService.markAsRead(partner.id);
        }

        setTimeout(() => scrollToBottom(true), 50);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, partner?.id, currentUserId, isPartnerLinked]);

  // Handle message submission
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : inputText;
    const trimmed = textToSend.trim();
    if (!trimmed || isSending || !partner?.id) return;

    setIsSending(true);
    setSendError(null);

    try {
      const res = await chatService.sendMessage(partner.id, trimmed);
      if (res.success && res.message) {
        const savedMsg = res.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) return prev;
          return [...prev, savedMsg];
        });
        if (textOverride === undefined) {
          setInputText('');
        }
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        setSendError(res.error || 'Could not send message. Please check your connection.');
      }
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyCode = () => {
    if (!patientConnectionCode) return;
    navigator.clipboard.writeText(patientConnectionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? timeStr : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Patient and Caregiver Chat"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in zoom-in-95 duration-150">
        {/* ── CHAT HEADER ── */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-sathi-700 via-amber-700 to-amber-800 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={
                  partner?.avatarUrl ||
                  `https://api.dicebear.com/9.x/avataaars/svg?seed=${partner?.id || 'chat'}&backgroundColor=b6e3f4`
                }
                alt={partner?.name || 'Contact'}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 border-white shadow-xs bg-amber-100"
              />
              {isPartnerLinked && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"
                  title="Caregiver linked & active"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg leading-tight truncate">
                  {partner?.preferredName || partner?.name || (currentUserRole === 'elderly' ? 'Family Caregiver' : 'Patient')}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full shrink-0">
                  {partner?.relationship || (currentUserRole === 'elderly' ? 'Caregiver' : 'Patient')}
                </span>
              </div>
              <p className="text-xs text-amber-100 flex items-center gap-1.5 mt-0.5 truncate">
                <Shield className="w-3 h-3 text-emerald-300 shrink-0" />
                <span>End-to-End Database Protected</span>
                {partner?.phone && (
                  <>
                    <span className="text-amber-300">•</span>
                    <span className="font-mono text-[11px]">{partner.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── UNLINKED CAREGIVER STATE ── */}
        {!isPartnerLinked ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-[#FAF7F2]">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4 shadow-sm border border-amber-200">
              <MessageSquare className="w-8 h-8" />
            </div>

            <h4 className="text-xl font-black text-gray-900 mb-2">
              {currentUserRole === 'elderly'
                ? 'No Family Caregiver Linked Yet'
                : 'No Patient Connected'}
            </h4>

            <p className="text-sm text-gray-600 max-w-md leading-relaxed mb-6">
              {currentUserRole === 'elderly'
                ? 'To send and receive secure text messages, your family caregiver must connect with your profile using your Connection Code.'
                : 'Please link your patient in the Caregiver Portal using their connection code to enable real-time messaging.'}
            </p>

            {patientConnectionCode && (
              <div className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-md max-w-xs w-full mb-6">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                  Your Connection Code
                </p>
                <div className="flex items-center justify-between gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span className="font-mono text-xl font-black tracking-widest text-amber-950">
                    {patientConnectionCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    type="button"
                    className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Share this code with your son, daughter, or caregiver.
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              type="button"
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-all cursor-pointer"
            >
              Close Window
            </button>
          </div>
        ) : (
          <>
            {/* ── CONVERSATION SCROLL AREA ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]">
              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-sathi-600" />
                  <span className="text-xs font-semibold">Loading conversation history...</span>
                </div>
              )}

              {/* Load Error */}
              {loadError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{loadError}</span>
                  <button
                    onClick={() => {
                      if (partner?.id) {
                        setIsLoading(true);
                        chatService.fetchConversation(partner.id).then((r) => {
                          setIsLoading(false);
                          if (r.success) setMessages(r.messages);
                        });
                      }
                    }}
                    type="button"
                    className="underline font-bold text-red-800 hover:text-red-900 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty Conversation State */}
              {!isLoading && !loadError && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center mb-3">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h5 className="font-extrabold text-base text-gray-900 mb-1">
                    Start a conversation with {partner?.preferredName || partner?.name}
                  </h5>
                  <p className="text-xs text-gray-500 max-w-sm">
                    {currentUserRole === 'elderly'
                      ? 'Send an update about your medicines, meals, or tap one of the quick buttons below.'
                      : 'Send a warm check-in message to see how their day is going.'}
                  </p>
                </div>
              )}

              {/* Message Bubbles */}
              {messages.map((msg) => {
                const isMine = msg.sender_id === currentUserId;
                const formattedTime = formatMessageTime(msg.created_at);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-in fade-in duration-100`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-2xl text-sm font-semibold break-words whitespace-pre-wrap leading-relaxed shadow-xs ${
                        isMine
                          ? 'bg-sathi-600 text-white rounded-br-xs shadow-sathi-600/20'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs shadow-xs'
                      }`}
                    >
                      {msg.message}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[10px] text-gray-400 font-mono">{formattedTime}</span>
                      {isMine && (
                        <span className="text-[10px] text-sathi-700 font-bold" title={msg.is_read ? 'Seen' : 'Delivered'}>
                          {msg.is_read ? '✓✓ Seen' : '✓ Sent'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* ── QUICK 1-TAP PHRASES ── */}
            <div className="px-3 py-2 bg-white border-t border-gray-100 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/60 shrink-0 pl-1">
                Quick 1-Tap:
              </span>
              {quickPhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(phrase);
                    textareaRef.current?.focus();
                  }}
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/90 text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* ── SEND ERROR BANNER ── */}
            {sendError && (
              <div className="px-4 py-2 bg-red-100 text-red-800 text-xs font-bold flex items-center justify-between border-t border-red-200">
                <span>{sendError}</span>
                <button
                  onClick={() => setSendError(null)}
                  type="button"
                  className="text-red-600 hover:text-red-900 text-xs font-black cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── INPUT BAR ── */}
            <div className="p-3 sm:p-4 bg-white border-t border-gray-200 flex items-end gap-2 shrink-0">
              <div className="flex-1 bg-gray-50 border border-gray-300/80 rounded-2xl px-3.5 py-2 focus-within:ring-2 focus-within:ring-sathi-500 focus-within:border-transparent transition-all">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    currentUserRole === 'elderly'
                      ? 'Type your message here (or tap a quick button above)...'
                      : 'Type a reply to patient (Enter to send, Shift+Enter for newline)...'
                  }
                  rows={2}
                  className="w-full bg-transparent resize-none text-sm text-gray-900 font-medium placeholder-gray-400 focus:outline-none"
                  aria-label="Message text"
                />
              </div>

              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputText.trim()}
                type="button"
                className={`p-3.5 rounded-2xl text-white font-bold transition-all flex items-center justify-center shrink-0 shadow-md ${
                  isSending || !inputText.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-sathi-600 hover:bg-sathi-700 active:scale-95 cursor-pointer shadow-sathi-600/30'
                }`}
                aria-label="Send message"
                title="Send message"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
