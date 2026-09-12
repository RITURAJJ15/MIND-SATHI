import React, { useEffect } from 'react';
import { BhashiniVoiceAssistant } from './BhashiniVoiceAssistant';
import { VoiceErrorBoundary } from './VoiceErrorBoundary';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Dark backdrop with blur */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <VoiceErrorBoundary>
          <BhashiniVoiceAssistant isModal={true} onClose={onClose} />
        </VoiceErrorBoundary>
      </div>
    </div>
  );
};

export default VoiceAssistantModal;
