import React, { useState, useEffect, useMemo } from 'react';
import { clinicalService, Clinical30DaySummary } from '../services/clinicalService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { UserProfile } from '../types/user';
import {
  Stethoscope,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Download,
  Brain,
  ShieldCheck,
  ChevronDown,
  User,
  Calendar,
  Clock,
  Award,
  TrendingUp,
  TrendingDown,
  Save,
  MapPin,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const ClinicianPortalPage: React.FC = () => {
  const { currentLang } = useLanguage();
  const { currentUser } = useCurrentUser();
  const [authorizedPatients, setAuthorizedPatients] = useState<UserProfile[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [notesSaved, setNotesSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Fetch genuine authorized patients
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    clinicalService.getAuthorizedPatients(currentUser?.id).then((pts) => {
      if (!isMounted) return;
      if (pts && pts.length > 0) {
        setAuthorizedPatients(pts);
        setSelectedPatientId((prev) => prev || pts[0].id);
      }
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const selectedPatient = useMemo(() => {
    return authorizedPatients.find((p) => p.id === selectedPatientId) || authorizedPatients[0] || null;
  }, [authorizedPatients, selectedPatientId]);

  // 2. Load genuine 30-day summary, MoCA mapping, and doctor notes
  const patientId = selectedPatient?.id || '';
  const summary: Clinical30DaySummary = useMemo(() => {
    if (!patientId) {
      return clinicalService.get30DayPatientSummary('');
    }
    return clinicalService.get30DayPatientSummary(patientId);
  }, [patientId]);

  const mocaAlignment = useMemo(() => {
    if (!patientId) return [];
    return clinicalService.getMocaMmseAlignment(patientId);
  }, [patientId]);

  const trendData = useMemo(() => {
    if (!patientId) return [];
    return clinicalService.getClinicalTrendData(patientId);
  }, [patientId]);

  // Load doctor notes for this patient
  useEffect(() => {
    if (patientId) {
      const saved = clinicalService.getDoctorNotes(patientId);
      setDoctorNotes(saved);
      setNotesSaved(false);
    }
  }, [patientId]);

  const handleSaveNotes = async () => {
    if (!patientId) return;
    await clinicalService.saveDoctorNotes(patientId, currentUser?.id || 'doctor', doctorNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 3000);
  };

  const handleExportReport = () => {
    window.print();
  };

  // SVG Trend Line calculation
  const trendPoints = useMemo(() => {
    if (trendData.length < 2) return '';
    const width = 600;
    const height = 140;
    const padding = 20;

    const minScore = 40;
    const maxScore = 100;

    return trendData
      .map((pt, i) => {
        const x = padding + (i / (trendData.length - 1)) * (width - 2 * padding);
        const normalized = (pt.overallScore - minScore) / (maxScore - minScore);
        const y = height - padding - normalized * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trendData]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Clinician Header Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 text-white p-6 sm:p-8 rounded-3xl shadow-elder flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Stethoscope className="w-5 h-5" />
            </div>
            <span className="text-[11px] uppercase tracking-widest font-black text-blue-300">
              Geriatric Neurology & Cognitive Telemetry Suite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Doctor & Clinician Portal
          </h1>
          <p className="text-blue-200 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
            30-day longitudinal cognitive performance analytics & MoCA/MMSE clinical alignments.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
          {authorizedPatients.length > 1 && (
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-300" />
              <span className="text-xs text-blue-200 font-bold uppercase tracking-wide">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-black/40 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 border border-white/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {authorizedPatients.map((p) => (
                  <option key={p.id} value={p.id} className="text-gray-900 font-bold">
                    {p.name} ({p.age}y, {p.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleExportReport}
            type="button"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black px-4 py-2.5 rounded-2xl shadow-tactile flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            title="Print or export 30-day clinical report"
          >
            <Download className="w-4 h-4" />
            <span>Export 30-Day Summary</span>
          </button>
        </div>
      </div>

      {/* Patient Profile & Demographic Info Card */}
      {selectedPatient && (
        <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={selectedPatient.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${selectedPatient.id}&backgroundColor=b6e3f4`}
                alt={selectedPatient.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm bg-indigo-50/50"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="Active Patient" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  {selectedPatient.name}
                </h2>
                {selectedPatient.preferredName && selectedPatient.preferredName !== selectedPatient.name && (
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                    Known as "{selectedPatient.preferredName}"
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600 font-semibold flex-wrap">
                <span>{selectedPatient.age} yrs • {selectedPatient.gender.toUpperCase()}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {selectedPatient.city}, {selectedPatient.state}
                </span>
                <span>•</span>
                <span>Lang: <strong className="uppercase">{selectedPatient.primaryLanguage}</strong></span>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {selectedPatient.abhaId || selectedPatient.abhaStatus === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    ABHA: {selectedPatient.abhaId || 'Verified ABDM'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    <Info className="w-3 h-3 text-amber-600" />
                    ABHA: Not Linked
                  </span>
                )}

                {selectedPatient.isAyushmanMember ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black bg-blue-50 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    PMJAY: {selectedPatient.ayushmanMemberId || 'Enrolled'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-300 px-2.5 py-0.5 rounded-full">
                    PMJAY: Not Linked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 text-xs border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider block text-[10px]">Patient Record ID</span>
              <p className="text-sm font-black font-mono text-gray-900 mt-0.5">
                MS-PT-{selectedPatient.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider block text-[10px]">Analysis Period</span>
              <p className="text-sm font-black text-indigo-900 mt-0.5">
                Past 30 Days (Genuine Telemetry)
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider block text-[10px]">Total 30d Sessions</span>
              <p className="text-sm font-black text-gray-900 mt-0.5">
                {summary.totalSessions} sessions ({summary.totalDurationMinutes} mins)
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider block text-[10px]">Last Session</span>
              <p className="text-sm font-black text-gray-900 mt-0.5">
                {summary.lastSessionDate || 'None recorded'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 30-Day Executive Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">30d Avg Accuracy</span>
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-gray-900">
            {summary.totalSessions > 0 ? `${summary.averageAccuracy}%` : 'N/A'}
          </div>
          <p className="text-[11px] font-semibold text-gray-500 mt-1">
            {summary.totalSessions > 0 ? `Across ${summary.totalSessions} verified trials` : 'No sessions recorded yet'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated MoCA</span>
            <Brain className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-blue-900">
              {summary.totalSessions > 0 ? summary.mocaTotalScore : '—'}
            </span>
            <span className="text-sm font-bold text-gray-400">/ 30</span>
          </div>
          <div className="mt-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
              summary.clinicalRisk === 'normal'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : summary.clinicalRisk === 'mild_variance'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-red-100 text-red-900 border-red-300'
            }`}>
              {summary.clinicalRisk === 'normal' ? 'Normal Cognitive Aging' : summary.clinicalRisk === 'mild_variance' ? 'Mild Cognitive Variance' : 'Clinical Review Indicated'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Latency</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-gray-900">
            {summary.totalSessions > 0 ? `${summary.averageReactionTimeMs}ms` : '—'}
          </div>
          <p className="text-[11px] font-semibold text-gray-500 mt-1">
            {summary.averageReactionTimeMs < 1200 ? 'Healthy geriatric processing' : 'Moderate visual search latency'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Growth Trajectory</span>
            {summary.isPositiveGrowth ? (
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <div className={`text-3xl font-black ${summary.isPositiveGrowth ? 'text-emerald-700' : 'text-rose-700'}`}>
            {summary.totalSessions > 1 ? `${summary.isPositiveGrowth ? '+' : '-'}${summary.growthPercent}%` : 'Stable'}
          </div>
          <p className="text-[11px] font-semibold text-gray-500 mt-1">
            First session vs latest in 30d
          </p>
        </div>
      </div>

      {/* 30-Day Longitudinal Cognitive Telemetry Curve */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>30-Day Cognitive Telemetry Longitudinal Trend</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Empirical session-by-session performance scores (accuracy %) plotted over the past 30 days.
            </p>
          </div>
          <span className="text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl">
            {trendData.length} Data Points
          </span>
        </div>

        {trendData.length >= 2 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="h-36 w-full relative">
                <svg viewBox="0 0 600 140" className="w-full h-full overflow-visible">
                  {/* Grid lines */}
                  <line x1="20" y1="20" x2="580" y2="20" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="20" y1="60" x2="580" y2="60" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="20" y1="100" x2="580" y2="100" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="20" y1="120" x2="580" y2="120" stroke="#E2E8F0" strokeWidth="1" />

                  {/* Polyline */}
                  <polyline
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trendPoints}
                  />

                  {/* Data Points */}
                  {trendData.map((pt, idx) => {
                    const width = 600;
                    const height = 140;
                    const padding = 20;
                    const x = padding + (idx / (trendData.length - 1)) * (width - 2 * padding);
                    const y = height - padding - ((pt.overallScore - 40) / 60) * (height - 2 * padding);
                    return (
                      <g key={idx} className="cursor-pointer group">
                        <circle
                          cx={x}
                          cy={y}
                          r="5"
                          className="fill-white stroke-blue-600 stroke-2 hover:r-7 transition-all"
                        />
                        <title>{`${pt.formattedDate}: ${pt.overallScore}% score (${pt.minutesPlayed}m)`}</title>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between text-[11px] font-bold text-gray-400 mt-2 px-4">
                <span>{trendData[0]?.formattedDate}</span>
                {trendData.length > 2 && (
                  <span>{trendData[Math.floor(trendData.length / 2)]?.formattedDate}</span>
                )}
                <span>{trendData[trendData.length - 1]?.formattedDate}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-xs">
            <Brain className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="font-bold text-gray-700">Insufficient 30-Day Session History</p>
            <p className="text-gray-400 mt-1 max-w-sm mx-auto">
              At least two verified cognitive game sessions are required to construct the longitudinal trend trajectory.
            </p>
          </div>
        )}
      </div>

      {/* MoCA Cognitive Domain Alignment Table */}
      <div className="bg-white rounded-3xl shadow-elder border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-700" />
              <span>Montreal Cognitive Assessment (MoCA) Empirical Mapping</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Empirically synthesized clinical scores mapped to standard 30-point neurocognitive constructs.
            </p>
          </div>
          <span className="text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            Standard MoCA (30 Points Total)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase font-black text-gray-600 border-b border-gray-200">
              <tr>
                <th className="p-4">Clinical Domain</th>
                <th className="p-4">MIND SATHI Game Construct</th>
                <th className="p-4">MoCA Weight</th>
                <th className="p-4">Estimated Pts</th>
                <th className="p-4">Classification</th>
                <th className="p-4">Genuine Telemetry Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mocaAlignment.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
                  <td className="p-4 font-black text-gray-900">{item.clinicalDomain}</td>
                  <td className="p-4 text-xs font-bold text-indigo-700 capitalize">{item.domain.replace('_', ' ')}</td>
                  <td className="p-4 font-mono font-bold text-gray-600">/{item.mocaWeight}</td>
                  <td className="p-4 font-mono font-black text-blue-900 text-base">{item.userEstimatedPoints}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                      item.riskClassification === 'normal'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : item.riskClassification === 'mild_variance'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-red-100 text-red-900 border-red-300'
                    }`}>
                      {item.riskClassification === 'normal' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{item.riskClassification === 'normal' ? 'Normal' : item.riskClassification === 'mild_variance' ? 'Mild Variance' : 'Review'}</span>
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-600 leading-relaxed max-w-sm">{item.clinicalObservation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Clinical Assessment & Regimen Recommendation */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 sm:p-7 rounded-3xl border border-blue-200 shadow-elder space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-700" />
          <h3 className="text-lg font-black text-gray-900">
            Automated 30-Day Neurological Telemetry Synthesis
          </h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs space-y-2.5 text-sm text-gray-800">
          <p className="leading-relaxed font-medium">
            {summary.clinicalAdvisory}
          </p>
          <div className="pt-2 border-t border-gray-100 text-xs flex items-start gap-2 text-indigo-900 font-bold">
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md uppercase tracking-wide text-[10px] shrink-0 font-black">
              Clinical Regimen
            </span>
            <span>{summary.regimenRecommendation}</span>
          </div>
        </div>
      </div>

      {/* Doctor's Notes & Assessment Section with Persistent Edit */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-700" />
            <span>Attending Physician Clinical Notes</span>
          </h3>
          {notesSaved && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Notes Saved Successfully
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 font-medium">
          Enter physician observations, differential diagnostics, or adjustments to the cognitive plan. Notes are saved to the patient record and synchronized securely.
        </p>

        <textarea
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
          placeholder={`Enter clinical evaluation for ${selectedPatient?.name || 'patient'} (e.g., Cognitive stability noted; continue daily reminiscence and working memory exercises)...`}
          className="w-full h-32 p-4 rounded-2xl border border-gray-300 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 leading-relaxed resize-y"
        />

        <div className="flex justify-between items-center pt-1">
          <span className="text-[11px] text-gray-400 font-semibold">
            Logged as: {currentUser?.name || 'Authorized Geriatric Clinician'} ({new Date().toLocaleDateString('en-IN')})
          </span>
          <button
            onClick={handleSaveNotes}
            type="button"
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-tactile flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Clinical Notes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

