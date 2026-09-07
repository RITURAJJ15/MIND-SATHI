import { GameMetadata } from '../types/game';

export const COGNITIVE_GAMES: GameMetadata[] = [
  {
    id: 'smriti_sangam',
    title: {
      en: 'Smriti Sangam',
      hi: 'स्मृति संगम (मेमोरी मैच)',
      as: 'স্মৃতি সংগম (স্মৃতি খেল)',
    },
    tagline: {
      en: 'Pairs & Reminiscence Recall',
      hi: 'तस्वीरों और यादों का सुंदर संगम',
      as: 'ছবি আৰু স্মৃতিৰ সুন্দৰ মিলন',
    },
    domain: 'memory',
    domainLabel: {
      en: 'Visual & Episodic Memory',
      hi: 'स्मृति एवं याददाश्त',
      as: 'স্মৃতি আৰু মনত ৰখাৰ ক্ষমতা',
    },
    iconName: 'Sparkles',
    accentColor: '#D26727',
    bgGradient: 'from-amber-500/15 via-orange-500/10 to-transparent',
    durationMinutes: 4,
    bestTimeOfDay: 'morning',
    description: {
      en: 'Flip tiles to find matching pairs of cultural artifacts or familiar family memories. Enhances visual working memory and cognitive agility.',
      hi: 'सुंदर चित्रों और पारिवारिक तस्वीरों के जोड़े खोजें। यह आपकी दृश्य स्मृति और एकाग्रता को मजबूत करता है।',
      as: 'সাংস্কৃতিক বস্তু আৰু পৰিয়ালৰ ছবিৰ মিল বিচাৰি উলিয়াওক। ই আপোনাৰ স্মৃতিশক্তি বৃদ্ধি কৰে।',
    },
    instructions: {
      en: [
        'Tap on any card to reveal the hidden symbol or photo.',
        'Tap a second card to find its matching partner.',
        'If they match, they stay open. If not, remember their places!',
        'Clear all matching pairs to complete the session.'
      ],
      hi: [
        'किसी भी कार्ड को छूकर उसके पीछे का चित्र देखें।',
        'दूसरा कार्ड छूकर उसकी जोड़ी तलाशें।',
        'यदि दोनों समान हैं, तो वे खुले रहेंगे। नहीं तो उनका स्थान याद रखें!',
        'सभी जोड़ियां बनाकर स्मृति सत्र पूरा करें।'
      ],
      as: [
        'লুকাই থকা ছবি চাবলৈ যিকোনো কাৰ্ডত স্পৰ্শ কৰক।',
        'ইয়াৰ জোৰা বিচাৰিবলৈ দ্বিতীয় কাৰ্ডত স্পৰ্শ কৰক।',
        'যদি দুয়োটা একে হয়, তেন্তে খোলা থাকিব। নহ\'লে ঠাইবোৰ মনত ৰাখক!',
        'সকলো জোৰা মিলাই খেল সম্পূৰ্ণ কৰক।'
      ],
    },
  },
  {
    id: 'shabda_mala',
    title: {
      en: 'Shabda Mala',
      hi: 'शब्द माला (भाषा एवं संबंध)',
      as: 'শব্দ মালা (ভাষা সংযোগ)',
    },
    tagline: {
      en: 'Word Association & Verbal Agility',
      hi: 'शब्दों की माला, ज्ञान का उजाला',
      as: 'শব্দৰ মালা, মনৰ জ্যোতি',
    },
    domain: 'language',
    domainLabel: {
      en: 'Language & Semantic Fluency',
      hi: 'भाषा एवं शब्द भंडार',
      as: 'ভাষা আৰু শব্দ চয়ন',
    },
    iconName: 'BookOpen',
    accentColor: '#0F766E',
    bgGradient: 'from-teal-500/15 via-emerald-500/10 to-transparent',
    durationMinutes: 5,
    bestTimeOfDay: 'morning',
    description: {
      en: 'Pair connected ideas, categorize related concepts, and enrich vocabulary. Stimulates left-hemisphere semantic retrieval networks.',
      hi: 'परस्पर जुड़े शब्दों के सही संबंध जोड़ें (जैसे बारिश - छतरी, दिया - बाती)। यह आपकी भाषा क्षमता और स्मरण शक्ति को बढ़ाता है।',
      as: 'সম্পৰ্কিত শব্দসমূহ সংযোগ কৰক (যেনে বৰষুণ - ছাতি, বন্তি - তেল)। ই শব্দভাণ্ডাৰ আৰু স্মৃতি সতেজ ৰাখে।',
    },
    instructions: {
      en: [
        'Read the prompt word carefully.',
        'Choose the word that naturally connects to it from the given options.',
        'Use hints if needed — taking time to think is encouraged!',
        'Complete all rounds to build your verbal fluency.'
      ],
      hi: [
        'दिए गए मुख्य शब्द को ध्यान से पढ़ें।',
        'विकल्पों में से सबसे उपयुक्त जुड़े हुए शब्द को चुनें।',
        'यदि आवश्यकता हो तो संकेत बटन दबाएं।',
        'सभी प्रश्नों के उत्तर देकर अपनी शब्द माला पूरी करें।'
      ],
      as: [
        'মূল শব্দটো ভালদৰে পঢ়ক।',
        'দিয়া বিকল্পসমূহৰ পৰা উপযুক্ত অৰ্থপূৰ্ণ শব্দ বাছক।',
        'প্ৰয়োজন হ\'লে সংকেত বুটাম ব্যৱহাৰ কৰক।',
        'সকলো প্ৰশ্নৰ উত্তৰ দি শব্দ মালা সম্পূৰ্ণ কৰক।'
      ],
    },
  },
  {
    id: 'rangoli_rekha',
    title: {
      en: 'Rangoli Rekha',
      hi: 'रंगोली रेखा (क्रम स्मृति)',
      as: 'ৰঙালী ৰেখা (ক্ৰম স্মৃতি)',
    },
    tagline: {
      en: 'Harmonious Pattern Sequence',
      hi: 'चमकती रंगोली, सुरम्य संगीत',
      as: 'উজ্জ্বল ৰঙালী, সুৰীয়া সংগীত',
    },
    domain: 'working_memory',
    domainLabel: {
      en: 'Working Memory & Sequencing',
      hi: 'कार्यकारी स्मृति व क्रम',
      as: 'কাৰ্যকৰী স্মৃতি আৰু ক্ৰম',
    },
    iconName: 'Palette',
    accentColor: '#B45309',
    bgGradient: 'from-amber-600/15 via-yellow-500/10 to-transparent',
    durationMinutes: 4,
    bestTimeOfDay: 'evening',
    description: {
      en: 'Observe the colorful Rangoli petals light up with gentle musical tones, then repeat the sequence in exact order. Promotes working memory span.',
      hi: 'रंगोली की पंखुड़ियों को संगीत की धुन के साथ चमकते हुए देखें और उसी क्रम में उन्हें दोहराएं।',
      as: 'ৰঙালীৰ পাহিকেইটা সুৰৰ সৈতে জ্বলি উঠা লক্ষ্য কৰক আৰু সেই ক্ৰমতে স্পৰ্শ কৰক।',
    },
    instructions: {
      en: [
        'Watch closely as the Rangoli lights up in a specific sequence.',
        'Listen to the soothing chime associated with each light.',
        'Repeat the sequence by tapping the petals in the same order.',
        'Each round adds one more step to challenge your recall gently.'
      ],
      hi: [
        'रंगोली की पंखुड़ियों को एक विशेष क्रम में चमकते हुए ध्यान से देखें।',
        'हर पंखुड़ी के साथ मधुर स्वर को सुनें।',
        'उसी क्रम में पंखुड़ियों को छूकर क्रम दोहराएं।',
        'हर स्तर पर क्रम धीरे-धीरे बढ़ता जाएगा।'
      ],
      as: [
        'ৰঙালীৰ পাহিবোৰ কেনেকৈ জ্বলে মন দি চাওক।',
        'প্ৰতিটো পাহিৰ মধুৰ শব্দ শুনক।',
        'একে ক্ৰমত পাহিবোৰত স্পৰ্শ কৰি ক্ৰমটো দেখুৱাওক।',
        'প্ৰতিটো ঢাপত ক্ৰমটো লাহে লাহে বাঢ়িব।'
      ],
    },
  },
  {
    id: 'bazaar_hisaab',
    title: {
      en: 'Bazaar Hisaab',
      hi: 'बाज़ार हिसाब (दैनिक गणित)',
      as: 'বজাৰ হিচাপ (দৈনিক গণিত)',
    },
    tagline: {
      en: 'Practical Numeracy & Market Decisions',
      hi: 'रोज़मर्रा की खरीदारी और चुस्त हिसाब',
      as: 'দৈনন্দিন বজাৰ আৰু হিচাপ-নিকাচ',
    },
    domain: 'executive',
    domainLabel: {
      en: 'Executive Function & Everyday Math',
      hi: 'कार्यकारी निर्णय एवं व्यावहारिक गणित',
      as: 'দৈনন্দিন ব্যৱহাৰিক গণিত আৰু বিবেচনা',
    },
    iconName: 'ShoppingBag',
    accentColor: '#1E3A8A',
    bgGradient: 'from-blue-600/15 via-indigo-500/10 to-transparent',
    durationMinutes: 5,
    bestTimeOfDay: 'morning',
    description: {
      en: 'Simulate everyday market visits — buying fresh produce, calculating change, and managing grocery bills. Keeps practical mental numeracy sharp.',
      hi: 'सब्जी, फल और किराना बाज़ार की खरीदारी में सही नोट गिनें और बाकी बचे पैसों का हिसाब लगाएं।',
      as: 'ফল-মূল আৰু শাক-পাচলি কিনাৰ সময়ত সঠিক টকাৰ হিচাপ আৰু খুচুৰা গণনা কৰক।',
    },
    instructions: {
      en: [
        'Read the market scenario (e.g. 2 kg mangoes at ₹40/kg).',
        'Identify total cost or the change owed from the given note.',
        'Select the right currency notes and coins or the correct total.',
        'Take your time — practical accuracy matters most!'
      ],
      hi: [
        'बाज़ार की स्थिति को पढ़ें (जैसे 2 किलो आम ₹40 प्रति किलो)।',
        'दिए गए नोट के अनुसार कुल खर्च या बची हुई राशि का हिसाब लगाएं।',
        'सही विकल्प को चुनें।',
        'आराम से सोचें — सही हिसाब ही सबसे महत्वपूर्ण है।'
      ],
      as: [
        'বজাৰৰ পৰিস্থিতিটো পঢ়ক (যেনে ২ কেজি আম ৪০ টকা দৰত)।',
        'দিয়া টকাৰ পৰা কিমান উভতি পাব বা মুঠ খৰচ হিচাপ কৰক।',
        'সঠিক উত্তৰটো বাছি লওক।',
        'চিন্তা কৰি সঠিক উত্তৰ দিয়ক।'
      ],
    },
  },
  {
    id: 'dhyan_kendra',
    title: {
      en: 'Dhyan Kendra',
      hi: 'ध्यान केंद्र (एकाग्रता एवं सतर्कता)',
      as: 'ধ্যান কেন্দ্ৰ (মনোযোগ আৰু সজাগতা)',
    },
    tagline: {
      en: 'Selective Focus & Visual Reaction',
      hi: 'शांत मन, सचेत दृष्टि',
      as: 'শান্ত মন, তীক্ষ্ণ দৃষ্টি',
    },
    domain: 'attention',
    domainLabel: {
      en: 'Attention & Processing Speed',
      hi: 'ध्यान एवं प्रतिक्रिया गति',
      as: 'মনোযোগ আৰু প্ৰতিক্ৰিয়াৰ গতি',
    },
    iconName: 'Eye',
    accentColor: '#5F8867',
    bgGradient: 'from-emerald-600/15 via-teal-500/10 to-transparent',
    durationMinutes: 3,
    bestTimeOfDay: 'afternoon',
    description: {
      en: 'A soothing focus pond where natural symbols appear. Tap quickly when the target symbol arrives while ignoring distractors. Measures reaction time.',
      hi: 'कमल के शांत तालाब में केवल लक्षित सुनहरे कमल या दीये पर तुरंत टैप करें। यह आपकी सतर्कता और प्रतिक्रिया गति को मापता है।',
      as: 'পদ্ম পুখুৰীত সোণালী পদুম বা বন্তি ওলালেই লগে লগে স্পৰ্শ কৰক। ই মনোযোগ আৰু ক্ষিপ্ৰতা বঢ়ায়।',
    },
    instructions: {
      en: [
        'Look for the target symbol announced at the start.',
        'When the target appears on screen, tap it as quickly as you can.',
        'If a different symbol appears, stay still and do not tap.',
        'Stay relaxed and steady throughout the exercise.'
      ],
      hi: [
        'शुरुआत में बताए गए लक्षित चित्र (जैसे सुनहरा कमल) को याद रखें।',
        'जैसे ही वह स्क्रीन पर आए, तुरंत टैप करें।',
        'यदि कोई दूसरा चित्र आए, तो टैप न करें।',
        'शांत रहें और गहरी सांस लेकर खेलें।'
      ],
      as: [
        'আৰম্ভণিতে দেখুওৱা নিৰ্দিষ্ট চিহ্নটো মনত ৰাখক।',
        'সেই চিহ্ন ওলোৱাৰ লগে লগে তৎক্ষণাৎ স্পৰ্শ কৰক।',
        'অন্য চিহ্ন ওলালে স্পৰ্শ নকৰিব।',
        'ধীৰ-স্থিৰভাৱে মনোযোগ দিয়ক।'
      ],
    },
  },
  {
    id: 'disha_sathi',
    title: {
      en: 'Disha Sathi',
      hi: 'दिशा साथी (स्थान एवं समय बोध)',
      as: 'দিশা সাৰথি (স্থান আৰু সময় বোধ)',
    },
    tagline: {
      en: 'Spatial Orientation & Clock Reading',
      hi: 'समय का ज्ञान, दिशाओं की पहचान',
      as: 'সময় আৰু দিশৰ সঠিক চিনাকি',
    },
    domain: 'visuospatial',
    domainLabel: {
      en: 'Visuospatial & Orientation',
      hi: 'स्थानिक समझ एवं समय बोध',
      as: 'স্থানিক জ্ঞান আৰু সময় নিৰ্ণয়',
    },
    iconName: 'Compass',
    accentColor: '#991B1B',
    bgGradient: 'from-rose-600/15 via-red-500/10 to-transparent',
    durationMinutes: 4,
    bestTimeOfDay: 'afternoon',
    description: {
      en: 'Practice reading traditional clock faces, navigating familiar courtyard directions (Purva, Paschim, Uttar, Dakshin), and spatial puzzles.',
      hi: 'पारंपरिक घड़ी में सही समय पहचानें और दिशाओं (पूर्व, पश्चिम, उत्तर, दक्षिण) के आधार पर सही मार्ग चुनें।',
      as: 'ঘড়ী চাই সময় কোৱা আৰু দিশ (পূব, পশ্চিম, উত্তৰ, দক্ষিণ) অনুসৰি সঠিক পথ বাছি উলিওৱা অভ্যাস কৰক।',
    },
    instructions: {
      en: [
        'Observe the clock hands or the direction compass.',
        'Answer questions regarding the time of day or direction to take.',
        'Helps reinforce temporal orientation and spatial alignment.',
        'Tap the correct choice to proceed.'
      ],
      hi: [
        'घड़ी की सुइयों अथवा दिशा-सूचक को ध्यान से देखें।',
        'पूछे गए समय या सही दिशा का चयन करें।',
        'यह आपके समय और दिशा के बोध को तरोताज़ा रखता है।',
        'सही उत्तर पर टैप करें।'
      ],
      as: [
        'ঘড়ীৰ কাঁটা বা দিশ নিৰ্দেশক মন দি চাওক।',
        'সোধা সময় বা সঠিক দিশ নিৰ্ণয় কৰক।',
        'ই সময় আৰু স্থান সচেতনতা বৃদ্ধি কৰে।',
        'সঠিক উত্তৰত স্পৰ্শ কৰক।'
      ],
    },
  },
  {
    id: 'family_memory',
    title: {
      en: 'Family Recognition',
      hi: 'परिवार पहचान (स्मृति एवं चेहरे)',
      as: 'পৰিয়াল চিনি পোৱা (স্মৃতি আৰু মুখাৱয়ব)',
    },
    tagline: {
      en: 'Facial & Relational Reminiscence',
      hi: 'अपनों की पहचान, पारिवारिक जुड़ाव',
      as: 'আপোনজনৰ চিনাকি আৰু আত্মিক টান',
    },
    domain: 'family_reminiscence',
    domainLabel: {
      en: 'Family Reminiscence & Emotional Memory',
      hi: 'पारिवारिक स्मृति एवं भावनात्मक जुड़ाव',
      as: 'পাৰিবাৰিক স্মৃতি আৰু আৱেগিক সংযোগ',
    },
    iconName: 'HeartHandshake',
    accentColor: '#E11D48',
    bgGradient: 'from-rose-500/15 via-pink-500/10 to-transparent',
    durationMinutes: 4,
    bestTimeOfDay: 'evening',
    description: {
      en: 'Identify real family members and relationships from your personal family photos. Enhances episodic recall, facial recognition, and emotional wellbeing.',
      hi: 'अपनी वास्तविक पारिवारिक तस्वीरों से परिजनों और उनके रिश्तों को पहचानें। यह चेहरे पहचानने और पुरानी यादों को ताज़ा रखने में मदद करता है।',
      as: 'আপোনাৰ প্ৰকৃত পাৰিবাৰিক ছবিৰ পৰা আত্মীয় আৰু সম্বন্ধবোৰ চিনাক্ত কৰক। ই স্মৃতি আৰু চিনাকি মুখ মনত ৰখাত সহায় কৰে।',
    },
    instructions: {
      en: [
        'View the photo of your loved one carefully.',
        'Choose the correct name, photo, or relationship.',
        'Tap the hint button if you need a gentle clue.',
        'Celebrate each correct answer and cherish your family bonds!'
      ],
      hi: [
        'अपने प्रियजन की तस्वीर को ध्यान से देखें।',
        'सही नाम, फोटो या पारिवारिक रिश्ते का चयन करें।',
        'मदद चाहिए तो संकेत बटन पर टैप करें।',
        'प्रत्येक सही उत्तर के साथ अपने पारिवारिक रिश्ते को संजोएं!'
      ],
      as: [
        'আপোনাৰ আপোনজনৰ ছবিখন মন দি চাওক।',
        'সঠিক নাম, ফটো বা সম্পৰ্ক নিৰ্বাচন কৰক।',
        'প্ৰয়োজন হ\'লে ইঙ্গিত বুটামত স্পৰ্শ কৰক।',
        'সকলো প্ৰশ্নৰ উত্তৰ দি আপোন মানুহবোৰক মনত পেলাওক!'
      ],
    },
  },
];
