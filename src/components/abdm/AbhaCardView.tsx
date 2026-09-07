import React, { useState } from "react";
import { abdmService } from "../../services/abdmService";
import { useLanguage } from "../../hooks/useLanguage";
import {
  ShieldCheck, QrCode, CheckCircle2, HeartPulse, Search, Loader2,
  AlertCircle, BadgeCheck, ChevronRight, X, RefreshCw,
} from "lucide-react";

type VerifyStep = "ask" | "input" | "verifying" | "verified" | "not_found";

const MOCK_VALID_IDS = [
  "1234-5678-9012", "9876-5432-1098", "4567-8901-2345",
  "PMJAY70-AS-001", "PMJAY70-MN-002", "ABHA-NE-2024",
];

export const AbhaCardView: React.FC = () => {
  const { currentLang } = useLanguage();
  const profile = abdmService.getAbhaProfile();
  const pmjay = abdmService.getPmjayBeneficiaryInfo();

  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [verifyStep, setVerifyStep] = useState<VerifyStep>("ask");
  const [inputId, setInputId] = useState("");
  const [verifiedId, setVerifiedId] = useState("");
  const [inputError, setInputError] = useState("");

  const handleMemberYes = () => {
    setIsMember(true);
    setVerifyStep("input");
    setInputId("");
    setInputError("");
  };

  const handleMemberNo = () => {
    setIsMember(false);
    setVerifyStep("ask");
  };

  const handleVerify = () => {
    const cleaned = inputId.trim();
    if (!cleaned) {
      setInputError(currentLang === "hi" ? "कृपया अपना ID दर्ज करें" : currentLang === "as" ? "অনুগ্ৰহ কৰি আপোনাৰ ID দিয়ক" : "Please enter your ABHA / PM-JAY ID");
      return;
    }
    setInputError("");
    setVerifyStep("verifying");
    // Mock network delay
    setTimeout(() => {
      const found = MOCK_VALID_IDS.some(
        (id) => id.toLowerCase() === cleaned.toLowerCase()
      );
      if (found) {
        setVerifiedId(cleaned.toUpperCase());
        setVerifyStep("verified");
      } else {
        setVerifyStep("not_found");
      }
    }, 1800);
  };

  const handleReset = () => {
    setIsMember(null);
    setVerifyStep("ask");
    setInputId("");
    setInputError("");
    setVerifiedId("");
  };

  const label = {
    title: { en: "Are you an Ayushman Bharat Member?", hi: "क्या आप आयुष्मान भारत के सदस्य हैं?", as: "আপুনি কি আয়ুষ্মান ভাৰতৰ সদস্য?" },
    yes: { en: "Yes, I am a member", hi: "हाँ, मैं सदस्य हूँ", as: "হয়, মই সদস্য" },
    no: { en: "No / Not Sure", hi: "नहीं / पता नहीं", as: "নহয় / নিশ্চিত নহয়" },
    inputLabel: { en: "Enter your ABHA Number or PM-JAY Beneficiary ID", hi: "अपना ABHA नंबर या PM-JAY ID दर्ज करें", as: "আপোনাৰ ABHA নম্বৰ বা PM-JAY ID দিয়ক" },
    verify: { en: "Verify Now", hi: "अभी सत्यापित करें", as: "এতিয়াই যাচাই কৰক" },
    verifying: { en: "Verifying…", hi: "सत्यापित हो रहा है…", as: "যাচাই কৰা হৈছে…" },
    verified: { en: "✅ Verified! Welcome, Ayushman Member", hi: "✅ सत्यापित! स्वागत है, आयुष्मान सदस्य", as: "✅ যাচাই হ'ল! স্বাগতম, আয়ুষ্মান সদস্য" },
    not_found: { en: "ID not found. Please check and try again.", hi: "ID नहीं मिली। कृपया जाँचें और पुनः प्रयास करें।", as: "ID পোৱা নগ'ল। অনুগ্ৰহ কৰি পুনৰ চেষ্টা কৰক।" },
    hint: { en: "Try: 1234-5678-9012 or PMJAY70-AS-001", hi: "उदाहरण: 1234-5678-9012 या PMJAY70-AS-001", as: "উদাহৰণ: 1234-5678-9012 বা PMJAY70-AS-001" },
    noMemberTitle: { en: "How to Enroll in Ayushman Bharat (70+)", hi: "आयुष्मान भारत में कैसे जुड़ें (70+ के लिए)", as: "আয়ুষ্মান ভাৰতত কেনেকৈ যোগ দিব (৭০+)" },
    enrollSteps: {
      en: ["Visit ayushman.gov.in or nearest Common Service Centre (CSC)", "Carry Aadhaar Card (age 70+ auto-eligible)", "Complete eKYC — golden card generated instantly", "Helpline: 14555 (Toll-Free, 24×7)"],
      hi: ["ayushman.gov.in पर जाएं या नजदीकी CSC केंद्र जाएं", "आधार कार्ड लेकर जाएं (70+ आयु स्वत: पात्र)", "eKYC पूरी करें — गोल्डन कार्ड तुरंत मिलेगा", "हेल्पलाइन: 14555 (निःशुल्क, 24×7)"],
      as: ["ayushman.gov.in লৈ যাওক বা নিকটৱৰ্তী CSC কেন্দ্ৰলৈ যাওক", "আধাৰ কাৰ্ড লৈ যাওক (৭০+ বয়স স্বয়ংক্ৰিয়ভাৱে যোগ্য)", "eKYC সম্পূৰ্ণ কৰক — গোল্ডেন কাৰ্ড লগে লগে পাব", "হেল্পলাইন: 14555 (বিনামূলীয়া, ২৪×৭)"],
    },
  };

  const t = (key: keyof typeof label) => {
    const obj = label[key] as any;
    return obj[currentLang] || obj["en"];
  };

  return (
    <div className="space-y-6">
      {/* ── Member Verification Widget ─────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-elder border-2 border-blue-200 overflow-hidden">
        {/* Widget Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <span className="text-white font-extrabold text-sm sm:text-base">
              Ayushman Bharat Member Verification
            </span>
          </div>
          {(verifyStep !== "ask" || isMember !== null) && (
            <button onClick={handleReset} type="button" className="text-blue-200 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* STEP 1: Yes/No toggle */}
          {verifyStep === "ask" && (
            <div className="text-center space-y-5">
              <p className="text-gray-800 font-bold text-base sm:text-lg">{t("title")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleMemberYes}
                  type="button"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-tactile transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {t("yes")}
                </button>
                <button
                  onClick={handleMemberNo}
                  type="button"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-sm border border-gray-300 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-500" />
                  {t("no")}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ID Input */}
          {verifyStep === "input" && (
            <div className="space-y-4">
              <p className="text-gray-800 font-bold text-sm">{t("inputLabel")}</p>
              <div className="relative">
                <input
                  type="text"
                  value={inputId}
                  onChange={(e) => { setInputId(e.target.value); setInputError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="e.g. 1234-5678-9012"
                  className={`w-full border-2 rounded-2xl px-4 py-3.5 text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    inputError ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"
                  }`}
                />
                {inputId && (
                  <button onClick={() => setInputId("")} type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {inputError && (
                <p className="text-red-600 text-xs font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {inputError}
                </p>
              )}
              <p className="text-xs text-gray-400">{t("hint")}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleVerify}
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm shadow-tactile transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  {t("verify")}
                </button>
                <button onClick={handleReset} type="button" className="px-4 py-3.5 rounded-2xl border border-gray-300 bg-gray-50 text-gray-600 font-bold text-sm hover:bg-gray-100 cursor-pointer transition-all">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Verifying spinner */}
          {verifyStep === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-blue-700 font-bold text-sm">{t("verifying")}</p>
              <p className="text-gray-400 text-xs">Checking NHA Beneficiary Registry…</p>
            </div>
          )}

          {/* STEP 4: Verified */}
          {verifyStep === "verified" && (
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <BadgeCheck className="w-10 h-10 text-emerald-600" />
                </div>
              </div>
              <p className="text-emerald-800 font-extrabold text-base">{t("verified")}</p>
              <p className="text-xs font-mono text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl inline-block border">
                ID: {verifiedId}
              </p>
              <p className="text-xs text-gray-500">Your ABHA profile and PM-JAY card are displayed below.</p>
            </div>
          )}

          {/* STEP 5: Not found */}
          {verifyStep === "not_found" && (
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
              </div>
              <p className="text-red-700 font-extrabold text-sm">{t("not_found")}</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => { setVerifyStep("input"); setInputId(""); }}
                  type="button"
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  className="px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 cursor-pointer transition-all"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* No member — enrollment guide */}
          {isMember === false && verifyStep === "ask" && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                <ChevronRight className="w-4 h-4" />
                {t("noMemberTitle")}
              </h4>
              <ol className="space-y-2">
                {((label.enrollSteps as any)[currentLang] || label.enrollSteps.en).map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                    <span className="w-5 h-5 rounded-full bg-amber-300 text-amber-950 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Show ABHA card only if verified or no question asked yet (default demo) */}
      {(verifyStep === "verified" || verifyStep === "ask") && (
        <>
          {/* ABHA Card Graphic */}
          <div className="bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#0F172A] text-white p-6 sm:p-7 rounded-3xl shadow-2xl border-4 border-amber-400 relative overflow-hidden max-w-xl mx-auto">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-400 text-blue-950 font-black rounded-xl flex items-center justify-center text-xs shadow-md">ABDM</div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-amber-300 font-extrabold">National Health Authority (NHA)</div>
                  <div className="text-sm font-bold tracking-tight">Ayushman Bharat Health Account (ABHA)</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VERIFIED</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-5">
              <img src={profile.photoUrl} alt={profile.fullName} className="w-24 h-28 object-cover rounded-2xl border-2 border-amber-300 shadow-md shrink-0" />
              <div className="min-w-0 text-center sm:text-left">
                <h4 className="text-xl sm:text-2xl font-black text-white truncate">{profile.fullName}</h4>
                <div className="text-amber-200 font-mono text-sm sm:text-base font-bold tracking-wider mt-1">ABHA: {profile.abhaNumber}</div>
                <div className="text-xs text-blue-200 font-mono mt-0.5">Address: <span className="text-white font-semibold">{profile.abhaAddress}</span></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-blue-100">
                  <div>DOB: <span className="font-semibold text-white">{profile.dateOfBirth}</span></div>
                  <div>Gender: <span className="font-semibold text-white">{profile.gender}</span></div>
                  <div>State: <span className="font-semibold text-white">{profile.state}</span></div>
                  <div>District: <span className="font-semibold text-white">{profile.district}</span></div>
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-2xl shadow-inner shrink-0 sm:ml-auto">
                <QrCode className="w-16 h-16 text-gray-900" />
                <span className="text-[9px] font-bold text-gray-600 block text-center mt-0.5 uppercase">Scan ABHA</span>
              </div>
            </div>
            <div className="border-t border-white/20 pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-blue-200 gap-2">
              <span>PM-JAY ID: <strong className="text-amber-300 font-mono">{pmjay.pmjayId || "PMJAY-UP-84729104"}</strong></span>
              <span className="text-[10px] text-amber-200 font-semibold">Government of India • Ministry of Health</span>
            </div>
          </div>

          {/* PM-JAY 70+ Coverage Details */}
          <div className="bg-white p-6 rounded-3xl shadow-elder border-2 border-emerald-200 max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl"><HeartPulse className="w-6 h-6" /></div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Senior 70+ Universal Cover</span>
                <h4 className="text-xl font-bold text-gray-900 mt-1">Ayushman Bharat PM-JAY Beneficiary Details</h4>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-center">
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                <span className="text-xs font-bold text-emerald-800 uppercase">Annual Cover</span>
                <div className="text-2xl font-black text-emerald-900">₹5,00,000</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
                <span className="text-xs font-bold text-blue-800 uppercase">Available Balance</span>
                <div className="text-2xl font-black text-blue-900">₹{pmjay.availableBalance.toLocaleString("en-IN")}</div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs text-gray-700 space-y-1.5">
              <div className="font-bold text-gray-900 text-sm mb-1">
                {currentLang === "hi" ? "70+ वरिष्ठ नागरिक निःशुल्क स्वास्थ्य लाभ" : currentLang === "as" ? "৭০+ জ্যেষ্ঠ নাগৰিক বিনামূলীয়া স্বাস্থ্য সুৰক্ষা" : "Key Senior 70+ Healthcare Benefits:"}
              </div>
              {pmjay.eligiblePackages.map((pkg, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  <span>{pkg}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
