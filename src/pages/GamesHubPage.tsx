import React, { useState } from "react";
import { COGNITIVE_GAMES } from "../data/mockGames";
import { NORTHEAST_GAMES } from "../data/mockNortheastGames";
import { DifficultyTier } from "../types/game";
import { useLanguage } from "../hooks/useLanguage";
import { VoicePromptButton } from "../components/common/VoicePromptButton";
import { Play, Sparkles, Clock, MapPin, Brain } from "lucide-react";

interface GamesHubPageProps {
  onPlayGame: (gameId: string, diff?: DifficultyTier) => void;
}

type GamesTab = "all" | "northeast" | "cognitive";

export const GamesHubPage: React.FC<GamesHubPageProps> = ({ onPlayGame }) => {
  const { currentLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<GamesTab>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Record<string, DifficultyTier>>({});

  const allGames = [...COGNITIVE_GAMES, ...NORTHEAST_GAMES];
  const displayed =
    activeTab === "all"
      ? allGames
      : activeTab === "northeast"
      ? NORTHEAST_GAMES
      : COGNITIVE_GAMES;

  const getDiff = (id: string): DifficultyTier => selectedDifficulty[id] || "saral";
  const setDiff = (id: string, d: DifficultyTier) =>
    setSelectedDifficulty((prev) => ({ ...prev, [id]: d }));

  const tabs = [
    { id: "all" as GamesTab, label: { en: `All ${allGames.length} Games`, hi: `\u0938\u092D\u0940 ${allGames.length} \u062E\u0947\u0932`, as: `\u09B8\u0995\u09B2\u09CB ${allGames.length} \u062E\u0947\u09B2` }, icon: Sparkles },
    { id: "northeast" as GamesTab, label: { en: "Northeast Culture", hi: "\u092A\u0942\u0930\u094D\u0935\u094B\u0924\u094D\u0924\u0930 \u0938\u0902\u0938\u094D\u0915\u0943\u0924\u093F", as: "\u0909\u09A4\u09CD\u09A4\u09F0-\u09AA\u09C2\u09F0\u09CD\u09AC \u09B8\u0982\u09B8\u09CD\u0995\u09C3\u09A4\u09BF" }, icon: MapPin },
    { id: "cognitive" as GamesTab, label: { en: "Cognitive Games", hi: "\u0938\u0902\u091C\u094D\u091E\u093E\u0928\u093E\u0924\u094D\u092E\u0915 \u062E\u0947\u0932", as: "\u099C\u09CD\u099E\u09BE\u09A8\u09AE\u09C2\u09B2\u0995 \u062E\u09C7\u09B2" }, icon: Brain },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-7 h-7 text-sathi-600" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{t.games.allGames}</h1>
              <VoicePromptButton text="Brain Games Hub" size="sm" />
            </div>
            <p className="text-gray-600 text-sm sm:text-base max-w-2xl">
              {COGNITIVE_GAMES.length} cognitive + {NORTHEAST_GAMES.length} Northeast cultural games
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === tab.id ? "bg-sathi-600 text-white shadow-sm" : "bg-gray-100 hover:bg-amber-100/60 text-gray-700"
              }`}
            >
              {tab.label[currentLang as "en"] || tab.label.en}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === "all" || activeTab === "northeast") && (
        <div className="bg-gradient-to-r from-emerald-700 via-green-600 to-teal-700 text-white p-5 sm:p-6 rounded-3xl shadow-elder">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🌿</span>
            <h2 className="text-lg sm:text-xl font-black">Northeast Memory &amp; Culture Games</h2>
          </div>
          <p className="text-emerald-100 text-sm max-w-2xl">
            Celebrate the heritage of all 8 Northeast states — Assam, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Arunachal Pradesh, and Sikkim.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayed.map((game) => {
          const title = (game.title as any)[currentLang] || game.title.en;
          const tagline = (game.tagline as any)[currentLang] || game.tagline.en;
          const domainLabel = (game.domainLabel as any)[currentLang] || game.domainLabel.en;
          const desc = (game.description as any)[currentLang] || game.description.en;
          const currentDiff = getDiff(game.id);
          const isNE = (game as any).category === "northeast_culture";

          return (
            <div
              key={game.id}
              className={`bg-white rounded-3xl p-6 sm:p-7 shadow-elder border-2 transition-all flex flex-col justify-between ${
                isNE ? "border-emerald-200 hover:border-emerald-500" : "border-gray-200 hover:border-sathi-400"
              }`}
            >
              {isNE && (
                <div className="mb-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    🌿 Northeast Culture
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full border ${isNE ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-sathi-800 bg-sathi-100 border-sathi-200"}`}>
                    {domainLabel}
                  </span>
                  <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{game.durationMinutes} min
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{title}</h3>
                <p className={`text-xs font-bold mb-3 ${isNE ? "text-emerald-700" : "text-sathi-700"}`}>{tagline}</p>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">{desc}</p>
                <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 mb-5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700">Difficulty:</span>
                  <div className="flex gap-1">
                    {(["saral", "madhyam", "nipun"] as DifficultyTier[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDiff(game.id, d)}
                        type="button"
                        className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          currentDiff === d ? "bg-sathi-600 text-white shadow-sm" : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {d === "saral" ? "Easy" : d === "madhyam" ? "Medium" : "Hard"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onPlayGame(game.id, currentDiff)}
                type="button"
                className={`w-full py-4 px-6 rounded-2xl text-white font-extrabold text-lg flex items-center justify-center gap-3 cursor-pointer shadow-tactile transition-transform hover:scale-[1.01] ${
                  isNE ? "bg-emerald-600 hover:bg-emerald-700" : "bg-sathi-600 hover:bg-sathi-700"
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{t.common.play} ({currentDiff === "saral" ? "Easy" : currentDiff === "madhyam" ? "Medium" : "Hard"})</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
