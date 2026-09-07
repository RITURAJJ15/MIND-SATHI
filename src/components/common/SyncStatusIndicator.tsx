import React, { useState, useEffect } from 'react';
import { syncService, SyncInfo } from '../../services/syncService';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  Clock,
  X
} from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({
    state: 'online-synced',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null,
  });
  const [showModal, setShowModal] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsub = syncService.subscribe((info) => {
      setSyncInfo(info);
    });
    return unsub;
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncService.syncPendingData();
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Format last sync time human-readably
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return 'Not yet synced';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Status button configs
  const getButtonConfig = () => {
    switch (syncInfo.state) {
      case 'online-synced':
        return {
          icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />,
          label: 'Online — Data Synced',
          shortLabel: 'Synced',
          containerClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100',
        };
      case 'offline':
        return {
          icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />,
          label: 'Offline — Data Saved Locally',
          shortLabel: syncInfo.pendingCount > 0 ? `Offline (${syncInfo.pendingCount})` : 'Offline',
          containerClass: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />,
          label: 'Syncing Data...',
          shortLabel: 'Syncing...',
          containerClass: 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100',
        };
      case 'sync-failed':
        return {
          icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />,
          label: 'Sync Failed — Retry',
          shortLabel: 'Sync Failed',
          containerClass: 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100',
        };
    }
  };

  const btnConfig = getButtonConfig();

  return (
    <>
      {/* Persistent Header Status Button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl border font-extrabold text-xs transition-all cursor-pointer shadow-2xs ${btnConfig.containerClass}`}
        title={`${btnConfig.label} (Click to inspect or sync)`}
        aria-label={btnConfig.label}
      >
        {btnConfig.icon}
        <span className="hidden md:inline">{btnConfig.label}</span>
        <span className="hidden xs:inline md:hidden">{btnConfig.shortLabel}</span>
      </button>

      {/* Sync Details Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 p-6 relative overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Offline &amp; Sync Status</h3>
                  <p className="text-xs text-gray-500 font-semibold">PWA + IndexedDB Local Storage</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                type="button"
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current State Banner */}
            <div className={`mt-5 p-4 rounded-2xl border flex items-center gap-3.5 ${
              syncInfo.state === 'online-synced'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : syncInfo.state === 'offline'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : syncInfo.state === 'syncing'
                ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}>
              <div className="shrink-0">
                {syncInfo.state === 'online-synced' && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                {syncInfo.state === 'offline' && <WifiOff className="w-6 h-6 text-amber-600" />}
                {syncInfo.state === 'syncing' && <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />}
                {syncInfo.state === 'sync-failed' && <AlertTriangle className="w-6 h-6 text-rose-600" />}
              </div>
              <div>
                <div className="text-sm font-black tracking-tight">{btnConfig.label}</div>
                <p className="text-xs mt-0.5 text-gray-600 font-medium">
                  {syncInfo.state === 'online-synced' && 'All game sessions and patient records are backed up to Supabase cloud.'}
                  {syncInfo.state === 'offline' && 'Internet disconnected. All gameplay, scores, and reminders are safely stored on device.'}
                  {syncInfo.state === 'syncing' && 'Reconnecting to Supabase... Uploading local pending records.'}
                  {syncInfo.state === 'sync-failed' && (syncInfo.lastError || 'Could not reach server. Data remains saved locally.')}
                </p>
              </div>
            </div>

            {/* Metrics List */}
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  {syncInfo.isOnline ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
                  <span>Connection</span>
                </div>
                <span className={`font-black uppercase tracking-wider ${syncInfo.isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {syncInfo.isOnline ? 'Online (Connected)' : 'Offline (Disconnected)'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  <Database className="w-4 h-4 text-sathi-600" />
                  <span>Pending Sync Queue</span>
                </div>
                <span className={`font-black ${syncInfo.pendingCount > 0 ? 'text-amber-700 font-mono text-sm' : 'text-gray-700'}`}>
                  {syncInfo.pendingCount === 0 ? '0 records (Up to date)' : `${syncInfo.pendingCount} record(s) pending`}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Last Cloud Backup</span>
                </div>
                <span className="font-bold text-gray-800">
                  {formatSyncTime(syncInfo.lastSyncTime)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={!syncInfo.isOnline || isManualSyncing || syncInfo.state === 'syncing'}
                className="flex-1 py-3 px-4 rounded-xl bg-sathi-600 hover:bg-sathi-700 disabled:bg-gray-300 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{syncInfo.state === 'sync-failed' ? 'Retry Synchronization' : 'Sync Now with Cloud'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
