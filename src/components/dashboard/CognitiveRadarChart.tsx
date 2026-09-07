import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { gameService } from '../../services/gameService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { CognitiveDomain } from '../../types/game';
import { Brain } from 'lucide-react';

export const CognitiveRadarChart: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang } = useLanguage();
  const [sessions, setSessions] = React.useState(() => gameService.getSessionsForUser(currentUser.id));

  React.useEffect(() => {
    gameService.syncSessionsFromDb(currentUser.id).then((synced) => {
      setSessions(synced);
    });
  }, [currentUser.id]);

  const domainScores = gameService.calculateDomainScores(currentUser.id);
  const hasSessions = sessions.length > 0;

  const domainLabels: Record<CognitiveDomain, { en: string; hi: string; as: string; [key: string]: string }> = {
    memory: { en: 'Memory', hi: 'स्मृति', as: 'স্মৃতি' },
    language: { en: 'Language', hi: 'भाषा', as: 'ভাষা' },
    working_memory: { en: 'Working Memory', hi: 'क्रमबद्ध स्मृति', as: 'ক্ৰম স্মৃতি' },
    executive: { en: 'Daily Math', hi: 'दैनिक गणित', as: 'দৈনিক গণিত' },
    attention: { en: 'Focus Speed', hi: 'एकाग्रता', as: 'মনোযোগ' },
    visuospatial: { en: 'Spatial', hi: 'स्थानिक समझ', as: 'স্থানিক বোধ' },
    northeast_culture: { en: 'NE Culture', hi: 'पूर्वोत्तर संस्कृति', as: 'উত্তৰ-পূব সংস্কৃতি' },
    family_reminiscence: { en: 'Family Recall', hi: 'पारिवारिक स्मृति', as: 'পৰিয়াল স্মৃতি' },
  };

  const chartData = [
    { domain: domainLabels.memory[currentLang] || domainLabels.memory.en, score: domainScores.memory, fullMark: 100 },
    { domain: domainLabels.language[currentLang] || domainLabels.language.en, score: domainScores.language, fullMark: 100 },
    { domain: domainLabels.working_memory[currentLang] || domainLabels.working_memory.en, score: domainScores.working_memory, fullMark: 100 },
    { domain: domainLabels.executive[currentLang] || domainLabels.executive.en, score: domainScores.executive, fullMark: 100 },
    { domain: domainLabels.attention[currentLang] || domainLabels.attention.en, score: domainScores.attention, fullMark: 100 },
    { domain: domainLabels.visuospatial[currentLang] || domainLabels.visuospatial.en, score: domainScores.visuospatial, fullMark: 100 },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-sathi-600" />
          <h3 className="text-xl font-extrabold text-gray-900">
            {currentLang === 'hi' ? 'संज्ञानात्मक संतुलन (Cognitive Radar)' : currentLang === 'as' ? 'মানসিক সমতুল্যতা' : 'Cognitive Vitality Radar'}
          </h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${hasSessions ? 'text-emerald-800 bg-emerald-100' : 'text-amber-800 bg-amber-100'}`}>
          {hasSessions ? `${sessions.length} Sessions Active` : 'Baseline Initial'}
        </span>
      </div>

      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="68%" data={chartData}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: '#374151', fontSize: 11, fontWeight: 700 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#9CA3AF" />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#D26727"
              fill="#EAA56D"
              fillOpacity={0.5}
            />
            <Tooltip
              formatter={(val: number) => [`${val} / 100`, 'Score']}
              contentStyle={{ backgroundColor: '#FFF', borderRadius: '16px', border: '1px solid #E5E7EB' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Domain Average Summary */}
      <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-gray-100 text-center">
        <div>
          <span className="text-[11px] text-gray-500 font-bold uppercase">{domainLabels.memory[currentLang] || domainLabels.memory.en}</span>
          <p className="text-lg font-extrabold text-sathi-700">{domainScores.memory}%</p>
        </div>
        <div>
          <span className="text-[11px] text-gray-500 font-bold uppercase">{domainLabels.attention[currentLang] || domainLabels.attention.en}</span>
          <p className="text-lg font-extrabold text-emerald-700">{domainScores.attention}%</p>
        </div>
        <div>
          <span className="text-[11px] text-gray-500 font-bold uppercase">{domainLabels.executive[currentLang] || domainLabels.executive.en}</span>
          <p className="text-lg font-extrabold text-blue-700">{domainScores.executive}%</p>
        </div>
      </div>
    </div>
  );
};
