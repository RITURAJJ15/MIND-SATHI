import { DailyActivityTask, DailyPlan, DayOfWeek } from '../types/plan';
import { CognitiveDomain, DifficultyTier, GameId } from '../types/game';
import { AccessibilitySettings } from '../types/user';
import { supabase } from '../lib/supabase';
import { authService } from './authService';
import { profileService } from './profileService';
import { soundService } from './soundService';

const STORAGE_KEY_PLANS = 'mind_sathi_daily_plans';
const STORAGE_KEY_SESSIONS = 'mind_sathi_game_sessions';

export interface StoredPlanData {
  completedTaskIds: string[];
  earnedXp: number;
  isAllCompleted: boolean;
  lastUpdated: string;
}

export interface PerformanceSummary {
  totalSessions: number;
  averageAccuracy: number;
  averageScore: number;
  averageDurationSeconds: number;
  weakestDomain?: string;
  strongestDomain?: string;
}

interface DayTemplate {
  dayOfWeek: DayOfWeek;
  domain: CognitiveDomain;
  focusArea: {
    en: string;
    hi: string;
    as: string;
  };
  defaultDifficulty: DifficultyTier;
  recommendedGames: GameId[];
  tasks: Array<Omit<DailyActivityTask, 'completed' | 'completedAt'>>;
}

const WEEKLY_SCHEDULE_TEMPLATES: Record<DayOfWeek, DayTemplate> = {
  Monday: {
    dayOfWeek: 'Monday',
    domain: 'memory',
    focusArea: {
      en: 'Memory Focus (Family Recognition & Recall)',
      hi: 'स्मृति एकाग्रता (पारिवारिक पहचान एवं स्मरण)',
      as: 'স্মৃতি মনোযোগ (পৰিয়ালৰ চিনাকি আৰু মনত পেলোৱা)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['smriti_sangam', 'family_memory', 'sequence_memory'],
    tasks: [
      {
        id: 'mon-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'smriti_sangam',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Sparkles',
        title: {
          en: 'Morning Card Recall',
          hi: 'सुबह का कार्ड स्मरण',
          as: 'পুৱাৰ কাৰ্ড সোঁৱৰণ',
        },
        subtitle: {
          en: 'Play Smriti Sangam (Memory Match)',
          hi: 'स्मृति संगम खेलें',
          as: 'স্মৃতি সংগম খেলক',
        },
        instructions: {
          en: 'Awaken visual episodic recall with a gentle card match session.',
          hi: 'कार्डों के जोड़े बनाकर अपनी दृष्टि स्मृति को सक्रिय करें।',
          as: 'কাৰ্ডৰ জোৰা মিলাই দিনটোৰ মানসিক সতেজতা বৃদ্ধি কৰক।',
        },
      },
      {
        id: 'mon-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Morning Hydration & Warm Water',
          hi: 'प्रातः गुनगुना पानी',
          as: 'পুৱাৰ কুহুমীয়া পানী',
        },
        subtitle: {
          en: 'Drink a glass of warm water to awaken neural flow',
          hi: 'मस्तिष्क व शरीर में स्फूर्ति हेतु एक गिलास पानी पिएं',
          as: 'মগজু আৰু শৰীৰৰ বাবে এগিলাচ কুহুমীয়া পানী খাওক',
        },
        instructions: {
          en: 'Hydration supports neural connectivity and focus for the day.',
          hi: 'जलपान से मस्तिष्क में रक्त संचार और सतर्कता बढ़ती है।',
          as: 'পানী খালে মগজুৰ সতেজতা আৰু স্মৃতিশক্তি বৃদ্ধি পায়।',
        },
      },
      {
        id: 'mon-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'sequence_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Brain',
        title: {
          en: 'Sequence Retention Drill',
          hi: 'क्रम स्मृति अभ्यास',
          as: 'ক্ৰম স্মৃতি অনুশীলন',
        },
        subtitle: {
          en: 'Play Sequence Memory to strengthen short-term retention',
          hi: 'क्रम स्मृति खेलकर अल्पकालिक स्मरण शक्ति मजबूत करें',
          as: 'ক্ৰম অনুসৰি মনত ৰখাৰ খেল খেলক',
        },
        instructions: {
          en: 'Follow repeating sequences to challenge your active working memory.',
          hi: 'दी गई क्रमबद्ध शृंखला को ध्यानपूर्वक याद रखकर दोहराएं।',
          as: 'ক্ৰম অনুসৰি লক্ষ্য ৰাখি একে ধৰণে পুনৰাবৃত্তি কৰক।',
        },
      },
      {
        id: 'mon-task-4',
        timeSlot: 'afternoon',
        type: 'family_reminiscence',
        durationMinutes: 6,
        rewardXp: 40,
        iconName: 'Heart',
        title: {
          en: 'Family Photo Reminiscence',
          hi: 'पारिवारिक सुखद यादें',
          as: 'পৰিয়ালৰ পুৰণি স্মৃতি',
        },
        subtitle: {
          en: 'Look at childhood & family trip photographs',
          hi: 'पारिवारिक यात्रा की पुरानी तस्वीरें देखें',
          as: 'পৰিয়ালৰ ভ্ৰমণৰ পুৰণি ছবি চাওক',
        },
        instructions: {
          en: 'Connecting names with faces stimulates deep episodic memory channels.',
          hi: 'अपनों की तस्वीरें देखकर उनसे जुड़ी सुखद कहानियाँ याद करें।',
          as: 'আপোনজনৰ ছবি চাই পুৰণি ভাল লগা কথাবোৰ মনত পেলাওক।',
        },
      },
      {
        id: 'mon-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'family_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'HeartHandshake',
        title: {
          en: 'Loved Ones Face & Name Match',
          hi: 'अपनों की पहचान संगम',
          as: 'আপোন মানুহৰ মুখ আৰু নামৰ মিল',
        },
        subtitle: {
          en: 'Identify family members and their loving relations',
          hi: 'परिवार के सदस्यों और उनके रिश्तों को पहचानें',
          as: 'পৰিয়ালৰ সদস্য আৰু সম্পৰ্কসমূহ মনত পেলাওক',
        },
        instructions: {
          en: 'Reinforce family face-name recognition in a warm, relaxed setting.',
          hi: 'शाम के समय परिवार के सदस्यों के चेहरे और नामों का अभ्यास करें।',
          as: 'সন্ধিয়া পৰিয়ালৰ সদস্যৰ নাম আৰু মুখ চিনাকি কৰক।',
        },
      },
      {
        id: 'mon-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 10,
        rewardXp: 35,
        iconName: 'PhoneCall',
        title: {
          en: 'Evening Heartfelt Check-in',
          hi: 'संध्या कालीन पारिवारिक वार्तालाप',
          as: 'সন্ধিয়া পৰিয়ালৰ সৈতে কথা-বতৰা',
        },
        subtitle: {
          en: 'Share your day with children or your caregiver',
          hi: 'बच्चों या अपने देखभालकर्ता से दिनचर्या साझा करें',
          as: 'ল’ৰা-ছোৱালী বা কেয়াৰগিভাৰৰ সৈতে কথা পাতক',
        },
        instructions: {
          en: 'Warm social conversation releases dopamine and lowers bedtime anxiety.',
          hi: 'अपनों से बात करने से मन शांत रहता है और अच्छी नींद आती है।',
          as: 'মৰমৰ মানুহৰ সৈতে কথা পাতিলে মনটো শান্ত আৰু আনন্দিত হয়।',
        },
      },
    ],
  },

  Tuesday: {
    dayOfWeek: 'Tuesday',
    domain: 'attention',
    focusArea: {
      en: 'Attention & Focus (Visual Matching & Concentration)',
      hi: 'ध्यान व एकाग्रता (दृष्टि मिलान व सतर्कता)',
      as: 'মনোযোগ আৰু একাগ্রতা (দৃষ্টি মিল আৰু সতৰ্কতা)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['dhyan_kendra', 'object_recognition', 'culture_match'],
    tasks: [
      {
        id: 'tue-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'dhyan_kendra',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Zap',
        title: {
          en: 'Morning Reaction Drill',
          hi: 'सुबह की एकाग्रता व प्रतिक्रिया',
          as: 'পুৱাৰ মনোযোগ আৰু প্ৰতিক্ৰিয়া',
        },
        subtitle: {
          en: 'Play Dhyan Kendra (Focus & Reaction)',
          hi: 'ध्यान केंद्र खेलें',
          as: 'ধ্যান কেন্দ্র খেলক',
        },
        instructions: {
          en: 'Sharpen your reaction speed and sustained visual attention.',
          hi: 'स्क्रीन पर आने वाले संकेतों पर सही समय पर ध्यान केंद्रित करें।',
          as: 'পৰ্দাত অহা সংকেতবোৰত সঠিক সময়ত দৃষ্টি নিৱদ্ধ কৰক।',
        },
      },
      {
        id: 'tue-task-2',
        timeSlot: 'morning',
        type: 'gentle_stretch',
        durationMinutes: 5,
        rewardXp: 30,
        iconName: 'Activity',
        title: {
          en: 'Gentle Neck & Shoulder Release',
          hi: 'सरल ग्रीवा व स्कंध व्यायाम',
          as: 'ডিঙি আৰু কান্ধৰ সহজ ব্যায়াম',
        },
        subtitle: {
          en: '5 gentle head rotations and shoulder shrugs',
          hi: 'गर्दन और कंधों को हल्के-हल्के घुमाएं',
          as: 'ডিঙি আৰু কান্ধ লাহে লাহে ঘূৰাই আৰাম পাওক',
        },
        instructions: {
          en: 'Mild movement stimulates blood circulation directly to the cerebral cortex.',
          hi: 'हल्के खिंचाव से मस्तिष्क में ताज़ा रक्त संचार होता है।',
          as: 'সহজ ব্যায়ামে মগজুলৈ তেজৰ সঞ্চালন উন্নত কৰে।',
        },
      },
      {
        id: 'tue-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'object_recognition',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Eye',
        title: {
          en: 'Everyday Object Spotting',
          hi: 'दैनिक वस्तुओं की पहचान',
          as: 'দৈনন্দিন বস্তুৰ চিনাকি',
        },
        subtitle: {
          en: 'Identify household objects and their purposes',
          hi: 'घरेलू सामानों और उनके उपयोग को पहचानें',
          as: 'ঘৰুৱা বস্তুবোৰ সঠিকভাৱে চিনাক্ত কৰক',
        },
        instructions: {
          en: 'Enhances cognitive visual association and object categorization.',
          hi: 'विभिन्न वस्तुओं को ध्यानपूर्वक देखकर उनके नाम से मिलान करें।',
          as: 'বস্তুবোৰ ভালকৈ লক্ষ্য কৰি শুদ্ধ নামটো বাছক।',
        },
      },
      {
        id: 'tue-task-4',
        timeSlot: 'afternoon',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Afternoon Hydration',
          hi: 'दोपहर का ताज़ा पानी',
          as: 'দুপৰীয়াৰ পানী খোৱা',
        },
        subtitle: {
          en: 'Hydrate with fresh water or herbal tea',
          hi: 'ताज़ा पानी या हर्बल चाय लें',
          as: 'এগিলাচ সতেজ পানী বা চাহ খাওক',
        },
        instructions: {
          en: 'Prevents afternoon fatigue and sustains cognitive vigilance.',
          hi: 'पर्याप्त जल से दोपहर की सुस्ती दूर होती है और सतर्कता बनी रहती है।',
          as: 'পানী খালে দুপৰীয়াৰ ভাগৰ দূৰ হয় আৰু মন সতেজ থাকে।',
        },
      },
      {
        id: 'tue-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'culture_match',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Palette',
        title: {
          en: 'Heritage Cultural Match',
          hi: 'सांस्कृतिक वस्त्र व कला संगम',
          as: 'সাংস্কৃতিক সাজ-পোছাক আৰু শিল্পৰ মিল',
        },
        subtitle: {
          en: 'Match traditional textiles, crafts & instruments',
          hi: 'पारंपरिक वस्त्रों और सांस्कृतिक कलाकृतियों का मिलान करें',
          as: 'পৰম্পৰাগত কাপোৰ আৰু কলাসমূহ মিলাওক',
        },
        instructions: {
          en: 'Connect cultural imagery to reinforce visual-spatial attention.',
          hi: 'सुंदर सांस्कृतिक कलाकृतियों पर ध्यान केंद्रित कर उनका सही जोड़ा बनाएं।',
          as: 'ধুনীয়া সাংস্কৃতিক উপাদানসমূহ লক্ষ্য কৰি মিল বিচাৰক।',
        },
      },
      {
        id: 'tue-task-6',
        timeSlot: 'evening',
        type: 'mindful_breathing',
        durationMinutes: 5,
        rewardXp: 30,
        iconName: 'Wind',
        title: {
          en: 'Sunset Calm & Deep Breathing',
          hi: 'संध्या प्राणायाम व गहरी सांस',
          as: 'সন্ধিয়াৰ প্ৰাণায়াম আৰু দীঘল উশাহ',
        },
        subtitle: {
          en: 'Inhale gently for 4 counts, exhale for 6 counts',
          hi: '4 सेकंड सांस अंदर लें, 6 सेकंड धीरे-धीरे छोड़ें',
          as: '৪ ছেকেণ্ড উশাহ লওক, ৬ ছেকেণ্ডত লাহেকৈ এৰক',
        },
        instructions: {
          en: 'Slow respiration activates the parasympathetic relaxation pathway.',
          hi: 'गहरी सांस लेने से दिनभर की थकान मिटती है और मन शांत होता है।',
          as: 'দীঘল উশাহ-নিশাহে মন আৰু শৰীৰক গভীৰ প্ৰশান্তি দিয়ে।',
        },
      },
    ],
  },

  Wednesday: {
    dayOfWeek: 'Wednesday',
    domain: 'language',
    focusArea: {
      en: 'Language & Verbal Skills (Word Association & Recall)',
      hi: 'भाषा एवं शाब्दिक कौशल (शब्द संगम एवं स्मरण)',
      as: 'ভাষা আৰু শব্দ দক্ষতা (শব্দ সংযোগ আৰু মনত পেলোৱা)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['shabda_mala', 'word_recall', 'ne_states_memory'],
    tasks: [
      {
        id: 'wed-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'shabda_mala',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'BookOpen',
        title: {
          en: 'Morning Word Chain',
          hi: 'सुबह की शब्द माला',
          as: 'পুৱাৰ শব্দ মালা',
        },
        subtitle: {
          en: 'Play Shabda Mala (Word Association)',
          hi: 'शब्द माला खेलें',
          as: 'শব্দ মালা খেলক',
        },
        instructions: {
          en: 'Connect semantically related words to activate verbal fluency pathways.',
          hi: 'आपस में जुड़े शब्दों को पहचान कर भाषा कौशल को ताज़ा करें।',
          as: 'সম্পৰ্কিত শব্দসমূহ বিচাৰি ভাষাৰ গতিশীলতা বৃদ্ধি কৰক।',
        },
      },
      {
        id: 'wed-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Morning Refreshing Water',
          hi: 'प्रातः जलपान',
          as: 'পুৱাৰ পানী খোৱা',
        },
        subtitle: {
          en: 'Enjoy 1 glass of fresh clean water',
          hi: 'एक गिलास ताज़ा पानी पिएं',
          as: 'এগিলাচ পৰিষ্কাৰ পানী খাওক',
        },
        instructions: {
          en: 'Keeps vocal cords and mental channels well lubricated.',
          hi: 'पानी पीने से वाणी और विचार दोनों सहज बने रहते हैं।',
          as: 'পানীয়ে মন আৰু কণ্ঠ দুয়োটাক সজীৱ কৰি ৰাখে।',
        },
      },
      {
        id: 'wed-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'word_recall',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'FileText',
        title: {
          en: 'Verbal Word Recall',
          hi: 'शाब्दिक पुनः स्मरण',
          as: 'শব্দ পুনৰ মনত পেলোৱা',
        },
        subtitle: {
          en: 'Remember words shown earlier and recall them correctly',
          hi: 'दिखाए गए शब्दों को याद रखकर सही उत्तर चुनें',
          as: 'আগতে দেখা শব্দবোৰ মনত পেলাই চিনাক্ত কৰক',
        },
        instructions: {
          en: 'Strengthens hippocampus verbal memory encoding.',
          hi: 'शब्दों की सूची को ध्यान से देखकर कुछ देर बाद याद करें।',
          as: 'শব্দৰ তালিকাখন মন দি চাই পিছত সোঁৱৰক।',
        },
      },
      {
        id: 'wed-task-4',
        timeSlot: 'afternoon',
        type: 'family_reminiscence',
        durationMinutes: 5,
        rewardXp: 35,
        iconName: 'MessageSquare',
        title: {
          en: 'Favorite Proverbs & Song Reminiscence',
          hi: 'पुराने गीत व मनपसंद कहावतें',
          as: 'পুৰণি গান আৰু জতুৱা ঠাঁচ',
        },
        subtitle: {
          en: 'Hum or speak lines from a cherished song or prayer',
          hi: 'अपने मनपसंद भजन या गीत की पंक्तियाँ गुनगुनाएं',
          as: 'মনৰ পছন্দৰ প্ৰাৰ্থনা বা গীতৰ কলি গুণগুণাওক',
        },
        instructions: {
          en: 'Singing familiar lyrics taps into intact musical and linguistic memory.',
          hi: 'पुराने गीतों को गुनगुनाने से मन आनंदित और भाषा सक्रिय होती है।',
          as: 'পুৰণি গীত গুণগুণালে মনটো আনন্দিত আৰু স্মৃতি সতেজ হয়।',
        },
      },
      {
        id: 'wed-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'ne_states_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Map',
        title: {
          en: 'Regional Geography & Capitals',
          hi: 'पूर्वोत्तर राज्य व राजधानियाँ',
          as: 'উত্তৰ-পূবৰ ৰাজ্য আৰু ৰাজধানী',
        },
        subtitle: {
          en: 'Connect states with their beautiful capitals and landscapes',
          hi: 'राज्यों को उनकी राजधानियों और प्राकृतिक सौंदर्य से जोड़ें',
          as: 'ৰাজ্য আৰু ৰাজধানীসমূহৰ নাম মিলাওক',
        },
        instructions: {
          en: 'Reinforces semantic geographical knowledge and spatial memory.',
          hi: 'पूर्वोत्तर भारत के सुंदर राज्यों और उनकी धरोहर को याद करें।',
          as: 'উত্তৰ-পূবৰ সুন্দৰ ঠাইসমূহৰ স্মৃতি মনত পেলাওক।',
        },
      },
      {
        id: 'wed-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 10,
        rewardXp: 35,
        iconName: 'PhoneCall',
        title: {
          en: 'Evening Storytelling Check-in',
          hi: 'अपनों से बातचीत व किस्से',
          as: 'পৰিয়ালৰ সৈতে পুৰণি গল্প কোৱা',
        },
        subtitle: {
          en: 'Tell a short nostalgic story from your youth to a loved one',
          hi: 'बच्चों या परिवार को अपने बचपन का कोई रोचक किस्सा बताएं',
          as: 'ল’ৰা-ছোৱালীক নিজৰ সৰুকালৰ এটা কাহিনী শুনাওক',
        },
        instructions: {
          en: 'Narrative storytelling engages whole-brain executive and emotional circuits.',
          hi: 'कहानियाँ सुनाने से स्मृति जीवंत और संवाद मधुर बनता है।',
          as: 'গল্প ক’লে মগজুৰ চিন্তা আৰু স্মৃতি শক্তি বৃদ্ধি পায়।',
        },
      },
    ],
  },

  Thursday: {
    dayOfWeek: 'Thursday',
    domain: 'executive',
    focusArea: {
      en: 'Problem Solving & Logic (Pattern Sequence & Market Math)',
      hi: 'तार्किक चिंतन व समाधान (पैटर्न शृंखला व दैनिक हिसाब)',
      as: 'যুক্তিসংগত চিন্তা আৰু সমাধান (প্যাটাৰ্ণ আৰু দৈনন্দিন হিচাপ)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['rangoli_rekha', 'bazaar_hisaab', 'number_pattern'],
    tasks: [
      {
        id: 'thu-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'bazaar_hisaab',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'ShoppingBag',
        title: {
          en: 'Morning Market Math',
          hi: 'सुबह का बाज़ार हिसाब',
          as: 'পুৱাৰ বজাৰৰ হিচাপ',
        },
        subtitle: {
          en: 'Play Bazaar Hisaab (Daily Market Math)',
          hi: 'बाज़ार हिसाब खेलें',
          as: 'বজাৰৰ হিচাপ খেলক',
        },
        instructions: {
          en: 'Practice everyday item pricing and mental change calculations.',
          hi: 'सब्जी, फल व दैनिक सामानों का सरल मानसिक हिसाब जोड़ें।',
          as: 'দৈনন্দিন বয়-বস্তুৰ সহজ মানসিক হিচাপ কৰক।',
        },
      },
      {
        id: 'thu-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Morning Hydration Glass',
          hi: 'सुबह का पानी',
          as: 'পুৱাৰ পানী',
        },
        subtitle: {
          en: 'Drink 1 glass of water before mental activities',
          hi: 'हिसाब-किताब से पहले एक गिलास पानी पिएं',
          as: 'হিচাপ-নিকাশৰ আগত এগিলাচ পানী খাওক',
        },
        instructions: {
          en: 'Maintains electrolyte balance necessary for logical clarity.',
          hi: 'पानी पीने से मानसिक स्पष्टता और निर्णय क्षमता बेहतर रहती है।',
          as: 'পানীয়ে চিন্তাৰ স্বচ্ছতা আৰু সঠিক সিদ্ধান্ত লোৱাত সহায় কৰে।',
        },
      },
      {
        id: 'thu-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'rangoli_rekha',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Palette',
        title: {
          en: 'Geometric Pattern Logic',
          hi: 'रंगोली रेखा पैटर्न साधना',
          as: 'ৰঙালী ৰেখাৰ শৃংখলা',
        },
        subtitle: {
          en: 'Play Rangoli Rekha with soothing harmonic patterns',
          hi: 'रंगोली रेखा के सुंदर ज्यामितीय पैटर्न पूरे करें',
          as: 'সুন্দৰ ৰঙালীৰ জ্যামিতিক মিল বিচাৰি খেলক',
        },
        instructions: {
          en: 'Trace visual symmetry and predict sequence continuations.',
          hi: 'पैटर्न की दिशा और रंगों को समझकर सही क्रम चुनें।',
          as: 'ৰেখা আৰু ৰঙৰ সংমিশ্ৰণ লক্ষ্য কৰি শুদ্ধ ক্ৰমটো বাছক।',
        },
      },
      {
        id: 'thu-task-4',
        timeSlot: 'afternoon',
        type: 'gentle_stretch',
        durationMinutes: 4,
        rewardXp: 30,
        iconName: 'Activity',
        title: {
          en: 'Seated Posture Alignment',
          hi: 'कुर्सी पर सरल योगाभ्यास',
          as: 'চকীত বহি সহজ যোগাভ্যাস',
        },
        subtitle: {
          en: 'Sit upright, stretch wrists and roll ankles gently',
          hi: 'सीधे बैठकर कलाई और टखनों को हल्के से घुमाएं',
          as: 'পোণ হৈ বহি হাতৰ মণিবন্ধ আৰু ভৰিৰ গোৰোহা ঘূৰাওক',
        },
        instructions: {
          en: 'Relieves stiffness and brings oxygen to frontal cortex executive lobes.',
          hi: 'हल्का खिंचाव शरीर में स्फूर्ति और मन में ताजगी लाता है।',
          as: 'সহজ আসন আৰু উশাহে শৰীৰত নতুন শক্তি সঞ্চাৰ কৰে।',
        },
      },
      {
        id: 'thu-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'number_pattern',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Hash',
        title: {
          en: 'Gentle Number Sequencing',
          hi: 'संख्या क्रम शृंखला',
          as: 'সংখ্যাৰ ক্ৰম শৃংখলা',
        },
        subtitle: {
          en: 'Identify the next logical number in simple ascending sequences',
          hi: 'सरल गिनती और संख्या शृंखला का अगला अंक पहचानें',
          as: 'সহজ সংখ্যা ক্ৰমৰ পৰৱৰ্তী সংখ্যাটো চিনাক্ত কৰক',
        },
        instructions: {
          en: 'Reinforces parietal and frontal lobe numeric reasoning.',
          hi: 'संख्याओं के बीच के अंतर को समझकर अगला सही अंक चुनें।',
          as: 'সংখ্যাবোৰৰ ব্যৱধান বুজি শুদ্ধ উত্তৰ বাছক।',
        },
      },
      {
        id: 'thu-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 10,
        rewardXp: 35,
        iconName: 'PhoneCall',
        title: {
          en: 'Family Evening Conversation',
          hi: 'अपनों से सुखद बातचीत',
          as: 'পৰিয়ালৰ লগত সুখৰ কথা',
        },
        subtitle: {
          en: 'Plan tomorrow’s meal or garden visit together',
          hi: 'कल के भोजन या बगीचे में टहलने की योजना बनाएं',
          as: 'কাইলৈৰ আহাৰ বা ফুলনিৰ কামৰ পৰিকল্পনা কৰক',
        },
        instructions: {
          en: 'Collaborative planning exercises executive function in real life.',
          hi: 'पारिवारिक योजनाएं बनाने से मस्तिष्क सक्रिय और मन खुशहाल रहता है।',
          as: 'পৰিয়ালৰ সৈতে আলোচনা কৰিলে মন আনন্দিত আৰু সক্ৰিয় থাকে।',
        },
      },
    ],
  },

  Friday: {
    dayOfWeek: 'Friday',
    domain: 'family_reminiscence',
    focusArea: {
      en: 'Family & Social Connection (Faces, Relationships & Heritage)',
      hi: 'पारिवारिक व सामाजिक स्नेह (पहचान, संबंध व संस्कृति)',
      as: 'পৰিয়াল আৰু সামাজিক সম্পৰ্ক (চিনাকি, মৰম আৰু ঐতিহ্য)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['family_memory', 'guess_the_place', 'food_memory'],
    tasks: [
      {
        id: 'fri-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'family_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Heart',
        title: {
          en: 'Family Face & Name Recognition',
          hi: 'परिवार के चेहरों और नामों का संगम',
          as: 'পৰিয়ালৰ মুখ আৰু নামৰ মিল',
        },
        subtitle: {
          en: 'Play Family Memory to match relatives and their warm relations',
          hi: 'पारिवारिक रिश्तों और चेहरों को पहचानें',
          as: 'পৰিয়ালৰ মানুহবোৰৰ নাম আৰু সম্পৰ্ক চিনাকি কৰক',
        },
        instructions: {
          en: 'Matches uploaded photos of children and grandchildren with their names.',
          hi: 'बच्चों और नाती-पोतों की तस्वीरों से उनके रिश्ते पहचानें।',
          as: 'নাতি-নাতিনী আৰু মৰমৰ মানুহৰ ছবি চিনি উলিয়াওক।',
        },
      },
      {
        id: 'fri-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Morning Hydration & Smile',
          hi: 'प्रातः जल एवं मुस्कान',
          as: 'পুৱাৰ পানী আৰু হাঁহি',
        },
        subtitle: {
          en: 'Drink a glass of warm water with a joyful thought',
          hi: 'एक गिलास पानी पिएं और एक सुखद बात याद करें',
          as: 'এগিলাচ কুহুমীয়া পানী খাওক আৰু মনত আনন্দ ৰাখক',
        },
        instructions: {
          en: 'Positive emotions combined with hydration maximize morning mental clarity.',
          hi: 'प्रसन्न मन और जलपान से दिन की शुरुआत बहुत सुंदर होती है।',
          as: 'মন প্ৰফুল্লিত ৰাখি পানী খালে দিনটো খুব ভালদৰে পাৰ হয়।',
        },
      },
      {
        id: 'fri-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'food_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Utensils',
        title: {
          en: 'Traditional Cuisine Recall',
          hi: 'पारंपरिक व्यंजनों की सुगंधित स्मृति',
          as: 'পৰম্পৰাগত খাদ্যৰ সুস্বাদু স্মৃতি',
        },
        subtitle: {
          en: 'Identify regional festive dishes, pitha, and spice blends',
          hi: 'पारंपरिक भोजन, पीठा और मसालों की पहचान करें',
          as: 'ঘৰুৱা পিঠা-পনা আৰু ব্যঞ্জনসমূহ চিনাক্ত কৰক',
        },
        instructions: {
          en: 'Olfactory and culinary memories are among the most durable cognitive links.',
          hi: 'पारंपरिक व्यंजनों के चित्रों से उनके स्वाद और बनाने की विधि याद करें।',
          as: 'পুৰণি সোৱাদৰ ব্যঞ্জনবোৰ মনত পেলাই স্মৃতি সজীৱ কৰক।',
        },
      },
      {
        id: 'fri-task-4',
        timeSlot: 'afternoon',
        type: 'family_reminiscence',
        durationMinutes: 5,
        rewardXp: 40,
        iconName: 'Camera',
        title: {
          en: 'Family Photo Album Browsing',
          hi: 'पारिवारिक एलबम की यात्रा',
          as: 'পৰিয়ালৰ ফটো এলবাম চোৱা',
        },
        subtitle: {
          en: 'Look at photographs of festivals, weddings & birthdays',
          hi: 'त्योहारों व शादी-ब्याह की पुरानी सुंदर तस्वीरें देखें',
          as: 'উৎসৱ আৰু বিয়া-সবাহৰ পুৰণি ছবিবোৰ চাওক',
        },
        instructions: {
          en: 'Reliving family milestones brings deep emotional comfort and stability.',
          hi: 'परिवार के उत्सवों की तस्वीरें देखने से मन में अपनत्व और शांति भर जाती है।',
          as: 'উৎসৱৰ ভাল লগা সময়বোৰ চাই মনত অপৰিসীম আনন্দ লাভ কৰক।',
        },
      },
      {
        id: 'fri-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'guess_the_place',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Compass',
        title: {
          en: 'Cherished Landmarks Memory',
          hi: 'प्रसिद्ध तीर्थ व ऐतिहासिक स्थल',
          as: 'ঐতিহাসিক আৰু পৱিত্ৰ স্থান চিনাকি',
        },
        subtitle: {
          en: 'Guess Kamakhya, Kaziranga, Brahmaputra & historic landmarks',
          hi: 'कामाख्या, काजीरंगा व ब्रह्मपुत्र के पवित्र स्थलों को पहचानें',
          as: 'কামাখ্যা, কাজিৰঙা আৰু ঐতিহ্যমণ্ডিত স্থানসমূহ চিনক',
        },
        instructions: {
          en: 'Visual landmark recognition stimulates spatial temporal cortex memories.',
          hi: 'सुप्रसिद्ध स्थानों के दृश्यों को देखकर उनका सही नाम बताएं।',
          as: 'পৰিচিত স্থানসমূহ চাই সঠিক উত্তৰটো বাছক।',
        },
      },
      {
        id: 'fri-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 12,
        rewardXp: 35,
        iconName: 'PhoneCall',
        title: {
          en: 'Weekend Family Video/Voice Call',
          hi: 'सप्ताहांत अपनों से वीडियो या फोन कॉल',
          as: 'সপ্তাহান্তত পৰিয়ালৰ সৈতে ফোনত কথা-বতৰা',
        },
        subtitle: {
          en: 'Connect with family members to kick off a cozy weekend',
          hi: 'परिवार के साथ हंसते-मुस्कुराते दिन का समापन करें',
          as: 'পৰিয়ালৰ লগত হাঁহি-ধেমালিৰে সন্ধিয়াটো উপভোগ কৰক',
        },
        instructions: {
          en: 'Warm social connection is the greatest buffer against cognitive decline.',
          hi: 'अपनों की आवाज़ और हंसी सुनने से मानसिक स्वास्थ्य को संजीवनी मिलती है।',
          as: 'মৰমৰ মাত শুনিলে মনৰ সকলো দুখ-ভাগৰ আঁতৰি যায়।',
        },
      },
    ],
  },

  Saturday: {
    dayOfWeek: 'Saturday',
    domain: 'working_memory',
    focusArea: {
      en: 'Mixed Cognitive Challenge (Multi-Domain Workout)',
      hi: 'संयुक्त मानसिक अभ्यास (बहु-आयामी मस्तिष्क साधना)',
      as: 'মিশ্ৰিত মানসিক অনুশীলন (বহুমুখী মগজুৰ ব্যায়াম)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['smriti_sangam', 'shabda_mala', 'bazaar_hisaab'],
    tasks: [
      {
        id: 'sat-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'smriti_sangam',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Sparkles',
        title: {
          en: 'Saturday Visual Memory Challenge',
          hi: 'शनिवार दृष्टि स्मरण संगम',
          as: 'শনিবাৰৰ দৃষ্টি স্মৃতি সংগম',
        },
        subtitle: {
          en: 'Pair up cards with speed and confidence',
          hi: 'कार्डों के जोड़े बनाकर आत्मविश्वास बढ़ाएं',
          as: 'কাৰ্ড মিলাই আত্মবিশ্বাস বৃদ্ধি কৰক',
        },
        instructions: {
          en: 'Start the weekend with a comprehensive visual memory match round.',
          hi: 'सप्ताहांत की शुरुआत एकाग्रता और स्मृति के सुंदर अभ्यास से करें।',
          as: 'শনিবাৰৰ পুৱাটো স্মৃতি আৰু মনোযোগৰ খেলৰে আৰম্ভ কৰক।',
        },
      },
      {
        id: 'sat-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Morning Hydration & Fresh Air',
          hi: 'प्रातः जल एवं खुली हवा',
          as: 'পুৱাৰ পানী আৰু মুকলি বতাহ',
        },
        subtitle: {
          en: 'Drink a glass of water while standing near a window or veranda',
          hi: 'खिड़की या बरामदे में खड़े होकर एक गिलास पानी पिएं',
          as: 'বাৰান্দা বা খিৰিকীৰ কাষত ৰৈ এগিলাচ পানী খাওক',
        },
        instructions: {
          en: 'Natural sunlight and water regulate morning circadian rhythms.',
          hi: 'धूप और ताज़ा पानी शरीर की जैविक घड़ी को दुरुस्त रखते हैं।',
          as: 'ৰ’দ আৰু পানীয়ে শৰীৰৰ প্ৰাকৃতিক সতেজতা অক্ষুণ্ণ ৰাখে।',
        },
      },
      {
        id: 'sat-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'shabda_mala',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'BookOpen',
        title: {
          en: 'Midday Word Associations',
          hi: 'दोपहर का शब्द संबंध संगम',
          as: 'দুপৰীয়াৰ শব্দ সংযোগ',
        },
        subtitle: {
          en: 'Link compound words and synonyms',
          hi: 'समानार्थी व संबंधित शब्दों को जोड़ें',
          as: 'অৰ্থপূৰ্ণ শব্দবোৰ সংযোগ কৰক',
        },
        instructions: {
          en: 'Engages dual semantic and lexical cognitive networks simultaneously.',
          hi: 'दोपहर के समय शब्दों के संबंध जोड़कर भाषा का आनंद लें।',
          as: 'শব্দবোৰৰ অৰ্থ বুজি শুদ্ধ সম্পৰ্কবোৰ বাছক।',
        },
      },
      {
        id: 'sat-task-4',
        timeSlot: 'afternoon',
        type: 'gentle_stretch',
        durationMinutes: 5,
        rewardXp: 30,
        iconName: 'Activity',
        title: {
          en: 'Gentle Spinal Twist & Breathe',
          hi: 'हल्का मेरुदंड आसन व सांस',
          as: 'সহজ কঁকাল আৰু পিঠিৰ লৰচৰ',
        },
        subtitle: {
          en: 'Gentle slow twisting motions while seated comfortably',
          hi: 'कुर्सी पर आराम से बैठकर धीरे-धीरे दोनों तरफ घूमें',
          as: 'চকীত বহি লাহে লাহে দুয়োফালে ঘূৰি আৰাম লওক',
        },
        instructions: {
          en: 'Sustained spinal mobility supports overall core neural alertness.',
          hi: 'कमर और पीठ के हल्के घुमाव से शरीर तरोताज़ा महसूस करता है।',
          as: 'পিঠিৰ সহজ লৰচৰে শৰীৰত ন ন স্ফূৰ্তি যোগায়।',
        },
      },
      {
        id: 'sat-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'bazaar_hisaab',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'ShoppingBag',
        title: {
          en: 'Evening Market Calculation',
          hi: 'शाम का बाज़ार खरीदारी हिसाब',
          as: 'সন্ধিয়াৰ বজাৰৰ খৰচ হিচাপ',
        },
        subtitle: {
          en: 'Quick practical everyday grocery arithmetic',
          hi: 'दैनिक बाज़ार की वस्तुओं का त्वरित हिसाब जोड़ें',
          as: 'দৈনন্দিন বস্তুৰ সঠিক খৰচ নিৰ্ণয় কৰক',
        },
        instructions: {
          en: 'Maintains numeric agility and financial self-confidence.',
          hi: 'सरल जोड़-घटाव के साथ अपना गणितीय आत्मविश्वास बनाए रखें।',
          as: 'সহজ যোগ-বিয়োগে মানসিক স্থিৰতা বজাই ৰাখে।',
        },
      },
      {
        id: 'sat-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 10,
        rewardXp: 35,
        iconName: 'PhoneCall',
        title: {
          en: 'Saturday Evening Family Chat',
          hi: 'शनिवार की शाम अपनों के नाम',
          as: 'শনিবাৰৰ সন্ধিয়া আপোনজনৰ সৈতে',
        },
        subtitle: {
          en: 'Share your high score and today’s accomplishments',
          hi: 'परिवार को आज के अपने पूरे किए गए कार्य बताएं',
          as: 'আজিৰ খেলা আৰু কামৰ কথা পৰিয়ালক জনাওক',
        },
        instructions: {
          en: 'Sharing positive milestones boosts self-efficacy and contentment.',
          hi: 'अपनी उपलब्धियों को साझा करने से मन में गहरा संतोष उत्पन्न होता है।',
          as: 'সফলতাৰ কথা ক’লে মনত অনুপ্ৰেৰণা আৰু আনন্দ বাঢ়ে।',
        },
      },
    ],
  },

  Sunday: {
    dayOfWeek: 'Sunday',
    domain: 'visuospatial',
    focusArea: {
      en: 'Light Cognitive Review & Relaxation (Gentle Stimulation & Rest)',
      hi: 'शांत विश्राम व सरल पुनरावलोकन (प्रकृति व मधुर साधना)',
      as: 'শান্ত বিশ্ৰাম আৰু মৃদু অনুশীলন (প্ৰকৃতি আৰু আনন্দময় সাধনা)',
    },
    defaultDifficulty: 'saral',
    recommendedGames: ['nature_memory', 'festival_memory', 'rangoli_rekha'],
    tasks: [
      {
        id: 'sun-task-1',
        timeSlot: 'morning',
        type: 'cognitive_game',
        gameId: 'nature_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Trees',
        title: {
          en: 'Nature & Wildlife Serenity Match',
          hi: 'प्रकृति व वन्यजीव शांत संगम',
          as: 'প্ৰকৃতি আৰু বন্যপ্ৰাণীৰ শান্ত সংগম',
        },
        subtitle: {
          en: 'Enjoy rhinos, orchids, tea gardens & lush hills',
          hi: 'चाय के बागान, एक सींग वाले गैंडे और सुंदर फूलों को पहचानें',
          as: 'চাহ বাগিচা, এশিঙীয়া গঁড় আৰু সুন্দৰ ফুলসমূহ চিনক',
        },
        instructions: {
          en: 'Immersing in serene natural scenes reduces cortisol and fosters calm focus.',
          hi: 'प्रकृति की मनोहर छटा देखकर मन को अत्यंत शांति मिलती है।',
          as: 'প্ৰকৃতিৰ মনোৰম দৃশ্যই মনলৈ গভীৰ প্ৰশান্তি আনি দিয়ে।',
        },
      },
      {
        id: 'sun-task-2',
        timeSlot: 'morning',
        type: 'hydration',
        durationMinutes: 2,
        rewardXp: 25,
        iconName: 'Droplet',
        title: {
          en: 'Sunday Morning Warm Tea/Water',
          hi: 'रविवार प्रातः गुनगुना पेय',
          as: 'দেওবাৰৰ পুৱাৰ কুহুমীয়া চাহ বা পানী',
        },
        subtitle: {
          en: 'Sip slowly and savor every warm drop',
          hi: 'धीमे-धीमे घूंट लेकर आराम से पिएं',
          as: 'লাহে লাহে জুতি লৈ কুহুমীয়া পানী বা চাহ খাওক',
        },
        instructions: {
          en: 'Mindful sipping trains present-moment sensory appreciation.',
          hi: 'ध्यानपूर्वक पीने से वर्तमान क्षण की अनुभूति और शांति मिलती है।',
          as: 'মনোযোগেৰে পান কৰিলে মানসিক স্থিৰতা লাভ হয়।',
        },
      },
      {
        id: 'sun-task-3',
        timeSlot: 'afternoon',
        type: 'cognitive_game',
        gameId: 'festival_memory',
        durationMinutes: 5,
        rewardXp: 50,
        iconName: 'Sparkles',
        title: {
          en: 'Celebrations & Bihu Festivals',
          hi: 'उत्सव व बिहू त्योहारों की मधुर यादें',
          as: 'উৎসৱ আৰু বিহুৰ আনন্দময় সোঁৱৰণ',
        },
        subtitle: {
          en: 'Recall harvest festivals, dhol beats & joyful traditional dances',
          hi: 'ढोल की थाप, बिहू नृत्य और उत्सवों के रंगों को पहचानें',
          as: 'ঢোলৰ মাত, বিহু নাচ আৰু আনন্দৰ উৎসৱসমূহ মনত পেলাওক',
        },
        instructions: {
          en: 'Festive memories trigger positive mood elevation and episodic recall.',
          hi: 'पारंपरिक त्योहारों के रंग देखकर मन में उल्लास भर जाता है।',
          as: 'উৎসৱৰ ভাল লগা স্মৃতিবোৰে মনটোক উল্লাসিত কৰি তোলে।',
        },
      },
      {
        id: 'sun-task-4',
        timeSlot: 'afternoon',
        type: 'mindful_breathing',
        durationMinutes: 6,
        rewardXp: 30,
        iconName: 'Wind',
        title: {
          en: 'Sunday Peace & Mindful Rest',
          hi: 'रविवार शांति व ध्यान साधना',
          as: 'দেওবাৰৰ শান্তি আৰু ধ্যান সাধনা',
        },
        subtitle: {
          en: 'Close eyes, breathe calmly and let thoughts drift like clouds',
          hi: 'आंखें बंद कर शांत बैठें और सांसों पर ध्यान दें',
          as: 'চকু দুটা মুদি শান্ত হৈ বহি উশাহ-নিশাহ লক্ষ্য কৰক',
        },
        instructions: {
          en: 'Allows deep neuro-consolidation of memories formed throughout the week.',
          hi: 'हफ्तेभर के अभ्यासों को शांत मन से विश्राम और शक्ति दें।',
          as: 'সপ্তাহটোৰ সকলো অভিজ্ঞতা মনত স্থিৰ হ’বলৈ বিশ্ৰাম লওক।',
        },
      },
      {
        id: 'sun-task-5',
        timeSlot: 'evening',
        type: 'cognitive_game',
        gameId: 'rangoli_rekha',
        durationMinutes: 4,
        rewardXp: 50,
        iconName: 'Palette',
        title: {
          en: 'Harmonic Relaxing Rangoli',
          hi: 'मधुर संगीत संग रंगोली रेखा',
          as: 'মধুৰ সুৰৰ সৈতে ৰঙালী ৰেখা',
        },
        subtitle: {
          en: 'Gentle pattern tracing with soothing meditative bells',
          hi: 'मधुर संगीत की धुन पर रंगोली का शांत अभ्यास',
          as: 'মৃদু সুৰৰ সৈতে ৰঙালীৰ সুন্দৰ অনুশীলন',
        },
        instructions: {
          en: 'A soothing conclusion to prepare the mind for a peaceful night.',
          hi: 'सुखद संगीत के साथ रात की अच्छी नींद की तैयारी करें।',
          as: 'মধুৰ সংগীতেৰে ৰাতিৰ সুখনিদ্ৰাৰ বাবে মন প্ৰস্তুত কৰক।',
        },
      },
      {
        id: 'sun-task-6',
        timeSlot: 'evening',
        type: 'family_call',
        durationMinutes: 10,
        rewardXp: 35,
        iconName: 'HeartHandshake',
        title: {
          en: 'Weekly Gratitude & Family Blessing',
          hi: 'साप्ताहिक कृतज्ञता व पारिवारिक स्नेह',
          as: 'সাপ্তাহিক কৃতজ্ঞতা আৰু পৰিয়ালৰ আশীৰ্বাদ',
        },
        subtitle: {
          en: 'Exchange blessings and look forward to a vibrant new week',
          hi: 'अपनों को शुभकामनाएं दें और नए हफ्ते का स्वागत करें',
          as: 'আপোনজনক মৰম জনাওক আৰু নতুন সপ্তাহটোৰ বাবে সাজু হওক',
        },
        instructions: {
          en: 'Gratitude resets emotional resilience and strengthens family bonds.',
          hi: 'कृतज्ञता और प्रेम से मन सदा प्रफुल्लित और स्वस्थ रहता है।',
          as: 'কৃতজ্ঞতা আৰু মৰমে মনক সদায়েই নিৰোগী আৰু আনন্দময় কৰি ৰাখে।',
        },
      },
    ],
  },
};

const DAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class DailyPlanService {
  private listeners: Set<(plan: DailyPlan) => void> = new Set();
  private currentActiveDate: string = '';
  private midnightTimer: any = null;

  constructor() {
    this.currentActiveDate = this.getTodayDateStr();
    this.initMidnightWatcher();
  }

  /**
   * Initializes a background interval checking if the local calendar date rolled over past midnight.
   * Auto-refreshes the plan and notifies subscribers without requiring full browser reload.
   */
  private initMidnightWatcher(): void {
    if (typeof window === 'undefined') return;
    if (this.midnightTimer) clearInterval(this.midnightTimer);

    this.midnightTimer = setInterval(() => {
      const nowDate = this.getTodayDateStr();
      if (nowDate !== this.currentActiveDate) {
        console.log(`[DailyPlanService] Midnight date rollover detected: ${this.currentActiveDate} -> ${nowDate}`);
        this.currentActiveDate = nowDate;
        const currentUser = authService.getCurrentUser();
        const userId = currentUser?.id || 'guest';
        // Auto sync new day's plan
        this.syncDailyPlanFromDb(userId, nowDate).then((newPlan) => {
          this.notify(newPlan);
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /** Get today's ISO date string in YYYY-MM-DD for local client timezone */
  public getTodayDateStr(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Compute DayOfWeek for a given YYYY-MM-DD or today */
  public getDayOfWeek(dateStr = this.getTodayDateStr()): DayOfWeek {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return DAY_NAMES[dateObj.getDay()];
  }

  /** Read all stored user plans from localStorage */
  private getAllStoredPlans(): Record<string, Record<string, StoredPlanData>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLANS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** Write all stored user plans to localStorage */
  private saveAllStoredPlans(data: Record<string, Record<string, StoredPlanData>>): void {
    try {
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(data));
    } catch (e) {
      console.warn('[DailyPlanService] Failed to save plans to localStorage:', e);
    }
  }

  /** Get stored plan data for a specific user and date */
  public getStoredPlanData(userId: string, dateStr: string): StoredPlanData | null {
    const all = this.getAllStoredPlans();
    return all[userId]?.[dateStr] || null;
  }

  /**
   * Reads recent gameplay sessions to extract performance metrics.
   * Avoids circular import by reading directly from localStorage.
   */
  public getRecentPerformance(userId: string): PerformanceSummary {
    let sessions: any[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          sessions = parsed.filter((s: any) => s.userId === userId || (!s.userId && userId === 'guest'));
        }
      }
    } catch {
      sessions = [];
    }

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        averageAccuracy: 85,
        averageScore: 90,
        averageDurationSeconds: 120,
      };
    }

    const recent = sessions.slice(0, 15);
    const totalAccuracy = recent.reduce((sum, s) => sum + (typeof s.accuracy === 'number' ? s.accuracy : 80), 0);
    const totalScore = recent.reduce((sum, s) => sum + (typeof s.score === 'number' ? s.score : 80), 0);
    const totalDuration = recent.reduce((sum, s) => sum + (typeof s.durationSeconds === 'number' ? s.durationSeconds : 100), 0);

    const averageAccuracy = Math.round(totalAccuracy / recent.length);
    const averageScore = Math.round(totalScore / recent.length);
    const averageDurationSeconds = Math.round(totalDuration / recent.length);

    return {
      totalSessions: sessions.length,
      averageAccuracy,
      averageScore,
      averageDurationSeconds,
    };
  }

  /**
   * Determines adapted difficulty tier based on recent performance.
   * Accuracy < 65% -> 'saral' (gentle/supportive)
   * Accuracy 65% - 84% -> 'madhyam' (moderate/balanced)
   * Accuracy >= 85% -> 'nipun' (advanced cognitive workout)
   */
  public getAdaptedDifficulty(performance: PerformanceSummary): DifficultyTier {
    if (performance.totalSessions === 0) return 'saral';
    if (performance.averageAccuracy >= 85) return 'nipun';
    if (performance.averageAccuracy >= 65) return 'madhyam';
    return 'saral';
  }

  /**
   * Constructs the deterministic rule-adaptive DailyPlan for a user and date.
   * Ensures consecutive-day game variety.
   */
  public buildAdaptivePlan(userId: string, dateStr: string, performance: PerformanceSummary): DailyPlan {
    const dayOfWeek = this.getDayOfWeek(dateStr);
    const template = WEEKLY_SCHEDULE_TEMPLATES[dayOfWeek] || WEEKLY_SCHEDULE_TEMPLATES.Monday;
    const difficulty = this.getAdaptedDifficulty(performance);

    const stored = this.getStoredPlanData(userId, dateStr);
    const completedSet = new Set(stored?.completedTaskIds || []);

    // Variety guard: look at yesterday's date
    const [y, m, d] = dateStr.split('-').map(Number);
    const prevDateObj = new Date(y, m - 1, d - 1);
    const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`;
    const prevDayOfWeek = this.getDayOfWeek(prevDateStr);
    const prevTemplate = WEEKLY_SCHEDULE_TEMPLATES[prevDayOfWeek];
    const prevGames = new Set(prevTemplate?.recommendedGames || []);

    // Ensure recommended games for today have distinct primary focus from yesterday
    let recommendedGames = [...template.recommendedGames];
    if (recommendedGames.length > 0 && prevGames.has(recommendedGames[0])) {
      // Rotate order so user experiences fresh game variety
      recommendedGames = [...recommendedGames.slice(1), recommendedGames[0]];
    }

    const tasks: DailyActivityTask[] = template.tasks.map((taskTpl) => {
      const isCompleted = completedSet.has(taskTpl.id);
      return {
        ...taskTpl,
        completed: isCompleted,
        completedAt: isCompleted ? stored?.lastUpdated : undefined,
      };
    });

    const completedTasks = tasks.filter((t) => t.completed);
    const earnedXpToday = completedTasks.reduce((sum, t) => sum + t.rewardXp, 0);
    const isAllCompleted = tasks.length > 0 && completedTasks.length === tasks.length;
    const totalXpPossible = tasks.reduce((sum, t) => sum + t.rewardXp, 0);

    const estimatedDuration = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);

    let aiReason = `Today's ${dayOfWeek} plan centers on ${template.focusArea.en} tailored for ${difficulty === 'saral' ? 'gentle, comfortable pacing' : difficulty === 'madhyam' ? 'balanced cognitive vitality' : 'an engaging advanced challenge'}.`;

    return {
      id: `plan-${userId}-${dateStr}`,
      userId,
      date: dateStr,
      dayOfWeek,
      focusArea: template.focusArea.en,
      difficulty,
      estimatedDuration,
      aiReason,
      recommendedGames,
      tasks,
      totalXpPossible,
      earnedXpToday,
      isAllCompleted,
      source: 'rule_adaptive',
    };
  }

  /**
   * Requests Gemini AI to personalize today's daily plan based on structured performance history.
   * If offline, endpoint fails, or Gemini returns invalid data, falls back gracefully to rule-adaptive plan.
   */
  public async fetchAiPersonalization(userId: string, dateStr: string, basePlan: DailyPlan): Promise<DailyPlan> {
    try {
      const performance = this.getRecentPerformance(userId);
      const currentUser = authService.getCurrentUser();
      const currentLang = currentUser?.primaryLanguage || 'en';

      const response = await fetch('/api/gemini/plan-personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: basePlan.dayOfWeek,
          planDate: dateStr,
          baselineFocus: basePlan.focusArea,
          baselineGames: basePlan.recommendedGames,
          performanceSummary: performance,
          userName: currentUser?.name || 'Elderly Senior',
          language: currentLang,
        }),
      });

      if (!response.ok) {
        return basePlan;
      }

      const data = await response.json();
      if (data && typeof data === 'object') {
        const enriched: DailyPlan = {
          ...basePlan,
          focusArea: data.focusArea || basePlan.focusArea,
          difficulty: (['saral', 'madhyam', 'nipun'].includes(data.difficulty) ? data.difficulty : basePlan.difficulty) as DifficultyTier,
          estimatedDuration: typeof data.estimatedDuration === 'number' ? data.estimatedDuration : basePlan.estimatedDuration,
          aiReason: data.reason || basePlan.aiReason,
          recommendedGames: Array.isArray(data.recommendedGames) && data.recommendedGames.length > 0 ? data.recommendedGames : basePlan.recommendedGames,
          source: 'gemini',
        };
        return enriched;
      }
    } catch (e) {
      console.warn('[DailyPlanService] Gemini AI plan personalization fallback:', e);
    }
    return basePlan;
  }

  /**
   * Synchronously builds or returns current daily plan from cache.
   * Fast, reliable, never blocks initial UI mount.
   */
  public getDailyPlan(userId: string, dateStr = this.getTodayDateStr()): DailyPlan {
    const performance = this.getRecentPerformance(userId);
    return this.buildAdaptivePlan(userId, dateStr, performance);
  }

  /**
   * Synchronizes today's daily plan from Supabase `daily_patient_plans` table for real users.
   * If a plan already exists in DB for this date, uses it (idempotent, never regenerates on refresh).
   * If not found, generates a new plan, personalizes it with Gemini AI, saves to DB and returns it.
   */
  public async syncDailyPlanFromDb(userId: string, dateStr = this.getTodayDateStr()): Promise<DailyPlan> {
    const basePlan = this.getDailyPlan(userId, dateStr);
    if (!userId || userId === 'guest') {
      return basePlan;
    }

    const isRealUser = userId.includes('-') && userId.length > 20;
    if (!isRealUser) {
      return basePlan;
    }

    try {
      // 1. Check if daily_patient_plans has a record for (userId, dateStr)
      const { data: dbPlanRecord, error: dbError } = await supabase
        .from('daily_patient_plans')
        .select('*')
        .eq('patient_id', userId)
        .eq('plan_date', dateStr)
        .maybeSingle();

      if (dbPlanRecord && !dbError) {
        // Sync local storage completion states
        const all = this.getAllStoredPlans();
        if (!all[userId]) all[userId] = {};

        const dbCompletedIds: string[] = Array.isArray(dbPlanRecord.tasks)
          ? dbPlanRecord.tasks.filter((t: any) => t.completed).map((t: any) => t.id)
          : [];

        const localCompleted = all[userId][dateStr]?.completedTaskIds || [];
        const mergedCompleted = Array.from(new Set([...localCompleted, ...dbCompletedIds]));

        all[userId][dateStr] = {
          completedTaskIds: mergedCompleted,
          earnedXp: dbPlanRecord.earned_xp || 0,
          isAllCompleted: dbPlanRecord.is_all_completed || false,
          lastUpdated: dbPlanRecord.updated_at || new Date().toISOString(),
        };
        this.saveAllStoredPlans(all);

        // Map DB record to DailyPlan structure
        const tasks: DailyActivityTask[] = Array.isArray(dbPlanRecord.tasks)
          ? dbPlanRecord.tasks.map((t: any) => ({
              ...t,
              completed: mergedCompleted.includes(t.id),
            }))
          : basePlan.tasks;

        const completedCount = tasks.filter((t) => t.completed).length;
        const earnedXpToday = tasks.filter((t) => t.completed).reduce((s, t) => s + (t.rewardXp || 0), 0);

        const restoredPlan: DailyPlan = {
          id: dbPlanRecord.id || `plan-${userId}-${dateStr}`,
          userId,
          date: dateStr,
          dayOfWeek: (dbPlanRecord.day_of_week as DayOfWeek) || basePlan.dayOfWeek,
          focusArea: dbPlanRecord.focus_area || basePlan.focusArea,
          difficulty: (dbPlanRecord.difficulty as DifficultyTier) || basePlan.difficulty,
          estimatedDuration: dbPlanRecord.estimated_duration || basePlan.estimatedDuration,
          aiReason: dbPlanRecord.ai_reason || basePlan.aiReason,
          recommendedGames: dbPlanRecord.recommended_games || basePlan.recommendedGames,
          tasks,
          totalXpPossible: dbPlanRecord.total_xp || basePlan.totalXpPossible,
          earnedXpToday,
          isAllCompleted: tasks.length > 0 && completedCount === tasks.length,
          source: (dbPlanRecord.source as any) || 'rule_adaptive',
        };

        this.notify(restoredPlan);
        return restoredPlan;
      }

      // 2. If no record in DB yet, personalize with Gemini AI and insert
      const personalizedPlan = await this.fetchAiPersonalization(userId, dateStr, basePlan);

      const dbPayload = {
        patient_id: userId,
        plan_date: dateStr,
        day_of_week: personalizedPlan.dayOfWeek,
        focus_area: personalizedPlan.focusArea,
        difficulty: personalizedPlan.difficulty,
        estimated_duration: personalizedPlan.estimatedDuration,
        ai_reason: personalizedPlan.aiReason,
        recommended_games: personalizedPlan.recommendedGames,
        tasks: personalizedPlan.tasks,
        earned_xp: personalizedPlan.earnedXpToday,
        total_xp: personalizedPlan.totalXpPossible,
        is_all_completed: personalizedPlan.isAllCompleted,
        source: personalizedPlan.source || 'rule_adaptive',
      };

      const { data: inserted, error: insertError } = await supabase
        .from('daily_patient_plans')
        .insert(dbPayload)
        .select()
        .maybeSingle();

      if (inserted && !insertError) {
        personalizedPlan.id = inserted.id;
      }

      this.notify(personalizedPlan);
      return personalizedPlan;
    } catch (err) {
      console.warn('[DailyPlanService] DB Sync Exception:', err);
    }

    this.notify(basePlan);
    return basePlan;
  }

  /**
   * Fetches a patient's daily plan for a caregiver to inspect.
   * Reads directly from `public.daily_patient_plans` or generates a deterministic preview.
   */
  public async getPatientDailyPlan(patientId: string, dateStr = this.getTodayDateStr()): Promise<DailyPlan> {
    try {
      const { data, error } = await supabase
        .from('daily_patient_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('plan_date', dateStr)
        .maybeSingle();

      if (data && !error) {
        const tasks: DailyActivityTask[] = Array.isArray(data.tasks) ? data.tasks : [];
        const completedCount = tasks.filter((t) => t.completed).length;
        return {
          id: data.id,
          userId: patientId,
          date: dateStr,
          dayOfWeek: (data.day_of_week as DayOfWeek) || this.getDayOfWeek(dateStr),
          focusArea: data.focus_area || 'Personalized Focus',
          difficulty: (data.difficulty as DifficultyTier) || 'saral',
          estimatedDuration: data.estimated_duration || 15,
          aiReason: data.ai_reason,
          recommendedGames: data.recommended_games || [],
          tasks,
          totalXpPossible: data.total_xp || 200,
          earnedXpToday: data.earned_xp || 0,
          isAllCompleted: tasks.length > 0 && completedCount === tasks.length,
          source: (data.source as any) || 'rule_adaptive',
        };
      }
    } catch (e) {
      console.warn('[DailyPlanService] Error fetching patient daily plan for caregiver:', e);
    }

    // Fallback: build baseline plan
    return this.buildAdaptivePlan(patientId, dateStr, {
      totalSessions: 0,
      averageAccuracy: 80,
      averageScore: 80,
      averageDurationSeconds: 100,
    });
  }

  /**
   * Toggles task completion state.
   * Persists immediately to localStorage, `daily_patient_plans` and `profiles.accessibility.daily_plans`.
   */
  public async toggleTask(userId: string, taskId: string, forceState?: boolean): Promise<DailyPlan> {
    const dateStr = this.getTodayDateStr();
    const currentPlan = this.getDailyPlan(userId, dateStr);
    const targetTask = currentPlan.tasks.find((t) => t.id === taskId);
    if (!targetTask) return currentPlan;

    const nextState = forceState !== undefined ? forceState : !targetTask.completed;
    const all = this.getAllStoredPlans();
    if (!all[userId]) all[userId] = {};
    const existing = all[userId][dateStr] || {
      completedTaskIds: [],
      earnedXp: 0,
      isAllCompleted: false,
      lastUpdated: new Date().toISOString(),
    };

    let updatedIds = [...existing.completedTaskIds];
    if (nextState) {
      if (!updatedIds.includes(taskId)) updatedIds.push(taskId);
      soundService.playMatchSuccess();
      profileService.addXpToCurrentUser(targetTask.rewardXp);
    } else {
      updatedIds = updatedIds.filter((id) => id !== taskId);
    }

    const earnedXp = currentPlan.tasks
      .filter((t) => updatedIds.includes(t.id))
      .reduce((sum, t) => sum + t.rewardXp, 0);
    const isAllCompleted = currentPlan.tasks.length > 0 && updatedIds.length === currentPlan.tasks.length;

    const storedData: StoredPlanData = {
      completedTaskIds: updatedIds,
      earnedXp,
      isAllCompleted,
      lastUpdated: new Date().toISOString(),
    };

    all[userId][dateStr] = storedData;
    this.saveAllStoredPlans(all);

    // Save to Supabase
    const isRealUser = userId.includes('-') && userId.length > 20;
    if (isRealUser) {
      try {
        const updatedTasks = currentPlan.tasks.map((t) => ({
          ...t,
          completed: updatedIds.includes(t.id),
          completedAt: updatedIds.includes(t.id) ? (t.completedAt || new Date().toISOString()) : undefined,
        }));

        // 1. Update daily_patient_plans table
        await supabase
          .from('daily_patient_plans')
          .update({
            tasks: updatedTasks,
            earned_xp: earnedXp,
            is_all_completed: isAllCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq('patient_id', userId)
          .eq('plan_date', dateStr);

        // 2. Also update profiles.accessibility.daily_plans for backwards compatibility
        const currentUser = authService.getCurrentUser();
        const defaultAcc: AccessibilitySettings = {
          fontSize: 'normal',
          highContrast: false,
          textToSpeechAuto: false,
          soundEffects: true,
          speechRate: 0.85,
        };
        const currentAccessibility = currentUser?.accessibility || defaultAcc;
        const currentDailyPlans = currentAccessibility.daily_plans || {};

        const updatedAccessibility = {
          ...defaultAcc,
          ...currentAccessibility,
          daily_plans: {
            ...currentDailyPlans,
            [dateStr]: storedData,
          },
        };

        await supabase
          .from('profiles')
          .update({
            accessibility: updatedAccessibility,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        authService.updateCurrentUserProfile({
          accessibility: updatedAccessibility,
        });

        // 3. Log completion in game_sessions table
        if (nextState) {
          await supabase.from('game_sessions').insert({
            patient_id: userId,
            game_id: targetTask.gameId || `daily_task_${targetTask.type}`,
            score: 100,
            accuracy: 100,
            duration_seconds: (targetTask.durationMinutes || 5) * 60,
            metadata: {
              taskId: targetTask.id,
              taskTitle: targetTask.title.en,
              rewardXp: targetTask.rewardXp,
              completedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.warn('[DailyPlanService] Supabase task persistence error:', err);
      }
    }

    const updatedPlan = this.getDailyPlan(userId, dateStr);
    this.notify(updatedPlan);
    return updatedPlan;
  }

  /**
   * Called whenever a cognitive game is finished.
   * Auto-completes any matching uncompleted task in today's daily plan.
   */
  public async onGameCompleted(userId: string, gameId: string): Promise<void> {
    const dateStr = this.getTodayDateStr();
    const plan = this.getDailyPlan(userId, dateStr);
    const matchingTask = plan.tasks.find((t) => t.gameId === gameId && !t.completed);
    if (matchingTask) {
      await this.toggleTask(userId, matchingTask.id, true);
    }
  }

  /** Subscribe to real-time plan changes */
  public subscribe(listener: (plan: DailyPlan) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(plan: DailyPlan) {
    this.listeners.forEach((l) => l(plan));
  }
}

export const dailyPlanService = new DailyPlanService();
