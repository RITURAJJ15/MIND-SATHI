import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { GameSummaryModal } from './GameSummaryModal';
import {
  CheckCircle, XCircle, HelpCircle, ArrowRight, MapPin, RefreshCw, Star, Zap,
} from 'lucide-react';

// ── Northeast States-Capitals data ────────────────────────────────────────
const NE_STATES = [
  { state: 'Assam', stateHi: 'असम', stateAs: 'অসম', capital: 'Dispur', capitalHi: 'दिसपुर', capitalAs: 'দিছপুৰ', emoji: '🌿', color: 'from-green-500 to-emerald-600' },
  { state: 'Meghalaya', stateHi: 'मेघालय', stateAs: 'মেঘালয়', capital: 'Shillong', capitalHi: 'शिलांग', capitalAs: 'চিলং', emoji: '🌧️', color: 'from-blue-500 to-cyan-600' },
  { state: 'Manipur', stateHi: 'मणिपुर', stateAs: 'মণিপুৰ', capital: 'Imphal', capitalHi: 'इम्फाल', capitalAs: 'ইম্ফল', emoji: '🌸', color: 'from-rose-500 to-pink-600' },
  { state: 'Mizoram', stateHi: 'मिज़ोरम', stateAs: 'মিজোৰাম', capital: 'Aizawl', capitalHi: 'आइज़ॉल', capitalAs: 'আইজল', emoji: '🏔️', color: 'from-purple-500 to-violet-600' },
  { state: 'Nagaland', stateHi: 'नागालैंड', stateAs: 'নাগালেণ্ড', capital: 'Kohima', capitalHi: 'कोहिमा', capitalAs: 'কহিমা', emoji: '🎵', color: 'from-orange-500 to-red-600' },
  { state: 'Tripura', stateHi: 'त्रिपुरा', stateAs: 'ত্ৰিপুৰা', capital: 'Agartala', capitalHi: 'अगरतला', capitalAs: 'আগৰতলা', emoji: '🌺', color: 'from-amber-500 to-orange-600' },
  { state: 'Arunachal Pradesh', stateHi: 'अरुणाचल प्रदेश', stateAs: 'অৰুণাচল প্ৰদেশ', capital: 'Itanagar', capitalHi: 'ईटानगर', capitalAs: 'ইটানগৰ', emoji: '🌄', color: 'from-teal-500 to-cyan-700' },
  { state: 'Sikkim', stateHi: 'सिक्किम', stateAs: 'ছিকিম', capital: 'Gangtok', capitalHi: 'गंगटोक', capitalAs: 'গেংটক', emoji: '🏔️', color: 'from-indigo-500 to-blue-700' },
];

// ── Guess the Place data ───────────────────────────────────────────────────
const LANDMARKS = [
  {
    clue: { en: 'World-famous temple of the Goddess Kamakhya, situated on Nilachal Hill, Guwahati', hi: 'नीलाचल पहाड़ी, गुवाहाटी पर स्थित देवी कामाख्या का विश्वप्रसिद्ध मंदिर', as: 'নীলাচল পাহাৰত অৱস্থিত দেৱী কামাখ্যাৰ বিশ্বখ্যাত মন্দিৰ' },
    answer: 'Kamakhya Temple',
    options: ['Kamakhya Temple', 'Sivasagar Temple', 'Umananda Temple', 'Navagraha Temple'],
    state: 'Assam', emoji: '🛕',
  },
  {
    clue: { en: 'Natural bridges formed by living tree roots in the Khasi Hills — a UNESCO tentative list heritage site', hi: 'खासी पहाड़ियों में जीवित पेड़ की जड़ों से बने प्राकृतिक पुल', as: 'খাছি পাহাৰত জীৱিত গছৰ শিপাৰে গঢ়া প্ৰাকৃতিক দলং' },
    answer: 'Living Root Bridges',
    options: ['Living Root Bridges', 'Double Decker Bridge', 'Mawsmai Cave', 'Dawki River'],
    state: 'Meghalaya', emoji: '🌿',
  },
  {
    clue: { en: 'A floating lake and home of the endangered Sangai deer, Manipur\'s gem', hi: 'एक तैरती झील जहां दुर्लभ संगाई हिरण रहता है — मणिपुर का गहना', as: 'তৈৰি ভাসমান হ্ৰদ য\'ত বিৰল সাংগাই হৰিণ বাস কৰে — মণিপুৰৰ মণি' },
    answer: 'Loktak Lake',
    options: ['Loktak Lake', 'Umiam Lake', 'Sela Lake', 'Kangla Fort'],
    state: 'Manipur', emoji: '🦌',
  },
  {
    clue: { en: 'A 400-year-old Tibetan Buddhist monastery, one of the largest in India, near the McMahon Line', hi: '400 साल पुराना तिब्बती बौद्ध मठ, भारत का सबसे बड़ा', as: '৪০০ বছৰ পুৰণি তিব্বতীয় বৌদ্ধ মঠ, ভাৰতৰ অন্যতম বৃহত্তম' },
    answer: 'Tawang Monastery',
    options: ['Tawang Monastery', 'Rumtek Monastery', 'Namdroling Monastery', 'Pemayangste Monastery'],
    state: 'Arunachal Pradesh', emoji: '⛩️',
  },
  {
    clue: { en: 'A national park famous as the last refuge of the Great Indian One-Horned Rhinoceros', hi: 'एक सींग वाले गैंडे की अंतिम शरण — यह राष्ट्रीय उद्यान', as: 'এক শিঙীয়া গঁড়ৰ শেষ আশ্ৰয়স্থল — এই ৰাষ্ট্ৰীয় উদ্যান' },
    answer: 'Kaziranga National Park',
    options: ['Kaziranga National Park', 'Manas National Park', 'Namdapha National Park', 'Keibul Lamjao'],
    state: 'Assam', emoji: '🦏',
  },
  {
    clue: { en: 'The royal palace of Tripura\'s Maharaja, now a museum with stunning Indo-Saracenic architecture in Agartala', hi: 'त्रिपुरा के महाराजा का महल, अब एक सुंदर संग्रहालय', as: 'ত্ৰিপুৰাৰ মহাৰাজাৰ ৰাজপ্ৰাসাদ, এতিয়া এটি সুন্দৰ জাদুঘৰ' },
    answer: 'Ujjayanta Palace',
    options: ['Ujjayanta Palace', 'Kangla Palace', 'Rajbari Palace', 'Karbala Palace'],
    state: 'Tripura', emoji: '🏛️',
  },
  {
    clue: { en: 'A scenic valley on the border of Nagaland and Manipur, famous for rare Dzukou lily flowers', hi: 'नागालैंड-मणिपुर सीमा पर सुंदर घाटी, दुर्लभ ज़ुकोउ लिली के लिए प्रसिद्ध', as: 'নাগালেণ্ড-মণিপুৰ সীমান্তত সুন্দৰ উপত্যকা, দুৰ্লভ জুকো লিলিৰ বাবে বিখ্যাত' },
    answer: 'Dzukou Valley',
    options: ['Dzukou Valley', 'Valley of Flowers', 'Yumthang Valley', 'Ziro Valley'],
    state: 'Nagaland/Manipur', emoji: '🌸',
  },
  {
    clue: { en: 'The official seat of the Karmapa Lama, a famous Buddhist monastery in Sikkim with beautiful gold stupa', hi: 'करमापा लामा का आधिकारिक आसन, सिक्किम में सुंदर बौद्ध मठ', as: 'কাৰ্মাপা লামাৰ চৰকাৰী আসন, ছিকিমৰ সুন্দৰ বৌদ্ধ মঠ' },
    answer: 'Rumtek Monastery',
    options: ['Rumtek Monastery', 'Pemayangtse', 'Tawang Monastery', 'Namdroling'],
    state: 'Sikkim', emoji: '⛩️',
  },
];

// ── Culture Match data ──────────────────────────────────────────────────────
const CULTURE_ITEMS = [
  { item: 'Bihu', emoji: '💃', state: 'Assam', clue: { en: 'The harvest dance and festival of Assam, celebrated three times a year', hi: 'असम का फसल नृत्य और उत्सव', as: 'অসমৰ শস্য নৃত্য আৰু উৎসৱ' }, options: ['Assam', 'Manipur', 'Nagaland', 'Meghalaya'] },
  { item: 'Hornbill Festival', emoji: '🦜', state: 'Nagaland', clue: { en: 'Festival of Festivals celebrating all Naga tribes, held in Kisama village', hi: 'सभी नागा जनजातियों का उत्सव — किसामा में', as: 'সকলো নাগা জনজাতিৰ উৎসৱ — কিছামা গাঁৱত' }, options: ['Nagaland', 'Mizoram', 'Manipur', 'Arunachal Pradesh'] },
  { item: 'Chapchar Kut', emoji: '🌸', state: 'Mizoram', clue: { en: 'The spring festival of the Mizo people, celebrating jungle-clearing season', hi: 'मिज़ो लोगों का वसंत उत्सव', as: 'মিজো মানুহৰ বসন্ত উৎসৱ' }, options: ['Mizoram', 'Meghalaya', 'Tripura', 'Assam'] },
  { item: 'Wangala Festival', emoji: '🥁', state: 'Meghalaya', clue: { en: 'The 100 Drums Festival of the Garo people, a harvest thanksgiving celebration', hi: 'गारो समुदाय का 100 ड्रम उत्सव, फसल का आभार', as: 'গাৰো সম্প্ৰদায়ৰ ১০০ ঢোল উৎসৱ, শস্যৰ ধন্যবাদ' }, options: ['Meghalaya', 'Tripura', 'Nagaland', 'Assam'] },
  { item: 'Muga Silk', emoji: '🧵', state: 'Assam', clue: { en: 'The world\'s only golden natural silk, unique to Assam', hi: 'विश्व का एकमात्र सुनहरा प्राकृतिक रेशम, असम की विशेषता', as: 'পৃথিৱীৰ একমাত্ৰ সোণালী প্ৰাকৃতিক ৰেচম, অসমৰ বিশেষত্ব' }, options: ['Assam', 'Manipur', 'Tripura', 'Meghalaya'] },
  { item: 'Jaapi (Bamboo Hat)', emoji: '🎩', state: 'Assam', clue: { en: 'Traditional conical bamboo and palm hat, symbol of Assamese culture', hi: 'बांस और ताड़ से बनी पारंपरिक टोपी, असमीया संस्कृति का प्रतीक', as: 'বাঁহ আৰু তালৰ পাতেৰে বনা পৰম্পৰাগত টোপোলা টুপি, অসমীয়া সংস্কৃতিৰ প্ৰতীক' }, options: ['Assam', 'Nagaland', 'Mizoram', 'Meghalaya'] },
  { item: 'Losar Festival', emoji: '🎊', state: 'Sikkim', clue: { en: 'Tibetan New Year celebrated with prayers and butter sculptures in Sikkim', hi: 'सिक्किम में तिब्बती नव वर्ष — प्रार्थना और मक्खन की मूर्तियों के साथ', as: 'ছিকিমত তিব্বতীয় নতুন বছৰ — প্ৰাৰ্থনা আৰু মাখনৰ মূৰ্তি সহ' }, options: ['Sikkim', 'Arunachal Pradesh', 'Manipur', 'Nagaland'] },
  { item: 'Sangai Festival', emoji: '🦌', state: 'Manipur', clue: { en: 'Tourism festival of Manipur celebrating the unique Sangai deer', hi: 'मणिपुर का पर्यटन उत्सव — अनोखे संगाई हिरण को समर्पित', as: 'মণিপুৰৰ পৰ্যটন উৎসৱ — অনন্য সাংগাই হৰিণক উৎসৰ্গিত' }, options: ['Manipur', 'Meghalaya', 'Assam', 'Nagaland'] },
];

// ── Food Memory data ─────────────────────────────────────────────────────────
const FOODS = [
  { name: 'Khar', emoji: '🍲', state: 'Assam', clue: { en: 'A traditional Assamese dish made with raw papaya and alkaline filtrate from burnt banana peel', hi: 'असम का पारंपरिक व्यंजन — कच्चा पपीता और केले के छिलके की राख से', as: 'কেঁচা পেপে আৰু কল গছৰ ছাই পানীৰে তৈয়াৰী অসমীয়া পৰম্পৰাগত ব্যঞ্জন' }, options: ['Khar', 'Eromba', 'Bai', 'Thukpa'] },
  { name: 'Masor Tenga', emoji: '🐟', state: 'Assam', clue: { en: 'A light and sour Assamese fish curry made with tomatoes or lemon', hi: 'नींबू या टमाटर से बनी असम की खट्टी मछली की सब्जी', as: 'মাটি মাহ আৰু লেমু বা টমেটোৰে তৈয়াৰী অসমীয়া টেং মাছৰ আঞ্জা' }, options: ['Masor Tenga', 'Khar', 'Smoked Pork', 'Eromba'] },
  { name: 'Thukpa', emoji: '🍜', state: 'Arunachal/Sikkim', clue: { en: 'A warm noodle soup with vegetables and meat, popular in the Himalayan states', hi: 'हिमालय राज्यों में प्रचलित गर्म नूडल सूप', as: 'হিমালয় ৰাজ্যসমূহত জনপ্ৰিয় উষ্ণ নুডলছ চুপ' }, options: ['Thukpa', 'Momos', 'Wonton Soup', 'Phagsha Paa'] },
  { name: 'Smoked Pork with Bamboo Shoot', emoji: '🥓', state: 'Nagaland', clue: { en: 'Nagaland\'s signature dish — smoked pork cooked with fermented bamboo shoots', hi: 'नागालैंड का प्रसिद्ध व्यंजन — किण्वित बांस की कोंपलों के साथ स्मोक्ड पोर्क', as: 'নাগালেণ্ডৰ বিখ্যাত ব্যঞ্জন — গাজ বাঁহৰ সৈতে ধোঁৱাত শুকোৱা গাহৰিৰ মাংস' }, options: ['Smoked Pork with Bamboo Shoot', 'Bai', 'Eromba', 'Galho'] },
  { name: 'Bai', emoji: '🥬', state: 'Mizoram', clue: { en: 'Mizoram\'s staple dish — mixed greens, vegetables, and pork boiled with local soda', hi: 'मिज़ोरम का मुख्य भोजन — सब्जियां और पोर्क स्थानीय सोडा के साथ', as: 'মিজোৰামৰ প্ৰধান খাদ্য — শাক-পাচলি আৰু গাহৰিৰ মাংস স্থানীয় চোডাৰ সৈতে' }, options: ['Bai', 'Thukpa', 'Khar', 'Jadoh'] },
  { name: 'Jadoh', emoji: '🍚', state: 'Meghalaya', clue: { en: 'A one-pot Khasi rice dish cooked with pork and turmeric', hi: 'खासी समुदाय का चावल और पोर्क से बना एकपाका व्यंजन', as: 'খাছি সম্প্ৰদায়ৰ ভাত আৰু গাহৰিৰ মাংসেৰে তৈয়াৰী এককলহীয়া ব্যঞ্জন' }, options: ['Jadoh', 'Galho', 'Khar', 'Bai'] },
  { name: 'Eromba', emoji: '🌶️', state: 'Manipur', clue: { en: 'A spicy Manipuri dish made from fermented fish (ngari) and boiled vegetables', hi: 'किण्वित मछली और उबली सब्जियों से बना मणिपुर का पारंपरिक व्यंजन', as: 'নগৰী আৰু সিজোৱা পাচলিৰে তৈয়াৰী মণিপুৰী পৰম্পৰাগত ব্যঞ্জন' }, options: ['Eromba', 'Khar', 'Bai', 'Masor Tenga'] },
];

// ── Wildlife data ────────────────────────────────────────────────────────────
const WILDLIFE = [
  { name: 'Great Indian One-Horned Rhinoceros', emoji: '🦏', state: 'Assam (Kaziranga)', clue: { en: 'The world\'s largest concentration of this magnificent animal is in Kaziranga, Assam — an UNESCO World Heritage Site', hi: 'काजीरंगा, असम में इस शानदार जानवर की सबसे बड़ी आबादी है — यूनेस्को विश्व धरोहर', as: 'কাজিৰঙা, অসমত এই বৃহৎ প্ৰাণীটোৰ পৃথিৱীৰ সৰ্ববৃহৎ আবাস — ইউনেস্ক\'ৰ বিশ্ব ঐতিহ্য' }, options: ['Great Indian One-Horned Rhinoceros', 'Bengal Tiger', 'Indian Elephant', 'Snow Leopard'] },
  { name: 'Sangai Deer', emoji: '🦌', state: 'Manipur', clue: { en: 'The brow-antlered deer, Manipur\'s state animal, found only in the floating phumdis of Loktak Lake', hi: 'भौंह-सींग वाला हिरण, मणिपुर का राज्य पशु, लोकतक झील के तैरते घास द्वीपों पर', as: 'ভৰু শিঙীয়া হৰিণ, মণিপুৰৰ ৰাজ্য প্ৰাণী, লোকতক হ্ৰদৰ ভাসমান ফুমদিত পোৱা যায়' }, options: ['Sangai Deer', 'Barasingha', 'Sambar Deer', 'Chital'] },
  { name: 'Red Panda', emoji: '🐼', state: 'Sikkim / Arunachal Pradesh', clue: { en: 'The "original panda" — a shy, rusty-red animal found in Himalayan forests of Sikkim and Arunachal Pradesh', hi: 'हिमालय के जंगलों में पाया जाने वाला शर्मीला लाल पांडा', as: 'হিমালয়ৰ বনত পোৱা লাজুৰীয়া ৰঙা পাণ্ডা' }, options: ['Red Panda', 'Giant Panda', 'Himalayan Bear', 'Snow Leopard'] },
  { name: 'Hoolock Gibbon', emoji: '🐒', state: 'Assam / Arunachal Pradesh', clue: { en: 'India\'s only ape species, found in rainforests of Northeast India, known for its melodious calls', hi: 'भारत की एकमात्र वानर प्रजाति, पूर्वोत्तर के वर्षावनों में पाई जाती है', as: 'ভাৰতৰ একমাত্ৰ বনমানুহ প্ৰজাতি, উত্তৰ-পূৰ্বৰ বৰষুণ অৰণ্যত পোৱা যায়' }, options: ['Hoolock Gibbon', 'Slow Loris', 'Assam Macaque', 'Golden Langur'] },
  { name: 'Golden Langur', emoji: '🐕', state: 'Assam', clue: { en: 'One of the world\'s most endangered primates, found only in a tiny region of western Assam along Bhutan border', hi: 'विश्व के सबसे खतरनाक प्राइमेट में से एक, पश्चिमी असम में भूटान सीमा पर', as: 'পৃথিৱীৰ অন্যতম বিপন্ন প্ৰাইমেট, পশ্চিম অসমত ভূটান সীমান্তত মাত্ৰ পোৱা যায়' }, options: ['Golden Langur', 'Hoolock Gibbon', 'Lion-tailed Macaque', 'Rhesus Macaque'] },
  { name: 'Amur Falcon', emoji: '🦅', state: 'Nagaland', clue: { en: 'A small raptor that makes the world\'s longest overwater migration, resting in Nagaland each October', hi: 'छोटा शिकारी पक्षी जो नागालैंड में हर अक्टूबर आता है', as: 'সৰু চিলনী পক্ষী যি প্ৰতি অক্টোবৰত নাগালেণ্ডত আহে' }, options: ['Amur Falcon', 'Peregrine Falcon', 'Harpy Eagle', 'Osprey'] },
];

// ── Festival data ─────────────────────────────────────────────────────────────
const FESTIVALS = [
  { question: { en: 'Which state celebrates Bihu three times a year — Rongali, Kongali, and Bhogali?', hi: 'रोंगाली, कोंगाली और भोगाली — तीन बार बिहू मनाने वाला राज्य?', as: 'ৰঙালী, কঙালী আৰু ভোগালী — তিনিবাৰ বিহু পালন কৰা ৰাজ্যখন?' }, answer: 'Assam', options: ['Assam', 'Manipur', 'Nagaland', 'Tripura'], emoji: '💃' },
  { question: { en: 'The Hornbill Festival celebrating all Naga tribal cultures is held in which month?', hi: 'हॉर्नबिल महोत्सव — सभी नागा जनजातियों का उत्सव — किस महीने में?', as: 'হ\'ৰ্নবিল উৎসৱ কোন মাহত পালন কৰা হয়?' }, answer: 'December (1-10)', options: ['December (1-10)', 'October', 'March', 'August'], emoji: '🦜' },
  { question: { en: 'Wangala is the 100-drums harvest thanksgiving festival of which community?', hi: '100 ड्रम वाला वांगाला उत्सव किस समुदाय का है?', as: '১০০ ঢোলৰ ৱাংগালা উৎসৱ কোন সম্প্ৰদায়ৰ?' }, answer: 'Garo community (Meghalaya)', options: ['Garo community (Meghalaya)', 'Khasi community', 'Mizo community', 'Naga community'], emoji: '🥁' },
  { question: { en: 'Chapchar Kut is the spring festival of which Northeast state?', hi: 'चाप चार कुट किस पूर्वोत्तर राज्य का वसंत उत्सव है?', as: 'চাপচাৰ কুট উত্তৰ-পূৰ্বৰ কোন ৰাজ্যৰ বসন্ত উৎসৱ?' }, answer: 'Mizoram', options: ['Mizoram', 'Meghalaya', 'Manipur', 'Assam'], emoji: '🌸' },
  { question: { en: 'Lai Haraoba is an ancient festival celebrating divine creation, from which state?', hi: 'लाई हरावबा — दिव्य सृष्टि का प्राचीन उत्सव — किस राज्य का?', as: 'লাই হাৰাওবা — ঐশ্বৰিক সৃষ্টিৰ প্ৰাচীন উৎসৱ — কোন ৰাজ্যৰ?' }, answer: 'Manipur', options: ['Manipur', 'Assam', 'Tripura', 'Nagaland'], emoji: '🙏' },
  { question: { en: 'Losar, the Tibetan New Year, is celebrated with butter sculptures mainly in which state?', hi: 'लोसर — तिब्बती नव वर्ष — मुख्यतः किस राज्य में?', as: 'লোছাৰ — তিব্বতীয় নতুন বছৰ — মুখ্যতঃ কোন ৰাজ্যত পালন কৰা হয়?' }, answer: 'Sikkim', options: ['Sikkim', 'Arunachal Pradesh', 'Meghalaya', 'Assam'], emoji: '🎊' },
  { question: { en: 'The Sangai Festival of Manipur is primarily a tourism festival celebrating which animal?', hi: 'मणिपुर का संगाई उत्सव किस जानवर को समर्पित है?', as: 'মণিপুৰৰ সাংগাই উৎসৱ মুখ্যতঃ কোন প্ৰাণীক উৎসৰ্গিত?' }, answer: 'Sangai Deer (Brow-antlered Deer)', options: ['Sangai Deer (Brow-antlered Deer)', 'One-Horned Rhinoceros', 'Red Panda', 'Amur Falcon'], emoji: '🦌' },
];

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────
interface NortheastCulturalGamesProps {
  gameId: string;
  difficulty?: string;
  onExit: () => void;
}

export const NortheastCulturalGames: React.FC<NortheastCulturalGamesProps> = ({
  gameId, difficulty = 'saral', onExit,
}) => {
  const { currentLang } = useLanguage();
  const { speak } = useSpeech();

  if (gameId === 'ne_states_memory') {
    return <StatesCapitalsGame difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  if (gameId === 'guess_the_place') {
    return <GuessThePlaceGame data={LANDMARKS} difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  if (gameId === 'culture_match') {
    return <CultureMatchGameInner data={CULTURE_ITEMS} difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  if (gameId === 'food_memory') {
    return <MultiChoiceGame title="Northeast Food Memory" emoji="🍛" data={FOODS.map(f => ({ question: f.clue, answer: f.name, options: f.options, emoji: f.emoji }))} difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  if (gameId === 'nature_memory') {
    return <MultiChoiceGame title="Northeast Wildlife" emoji="🦏" data={WILDLIFE.map(w => ({ question: w.clue, answer: w.name, options: w.options, emoji: w.emoji }))} difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  if (gameId === 'festival_memory') {
    return <MultiChoiceGame title="Festival & Tradition Quiz" emoji="🎉" data={FESTIVALS.map(f => ({ question: f.question, answer: f.answer, options: f.options, emoji: f.emoji }))} difficulty={difficulty} onExit={onExit} currentLang={currentLang} speak={speak} />;
  }
  return null;
};

// ── States & Capitals Game ─────────────────────────────────────────────────
const StatesCapitalsGame: React.FC<{ difficulty: string; onExit: () => void; currentLang: string; speak: (t: string) => void }> = ({ difficulty, onExit, currentLang, speak }) => {
  const count = difficulty === 'saral' ? 4 : difficulty === 'madhyam' ? 6 : 8;
  const subset = NE_STATES.slice(0, count);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const shuffledCapitals = [...subset].sort(() => Math.random() - 0.5);

  const score = submitted ? Object.entries(selected).filter(([state, capital]) => {
    const s = subset.find(s => s.state === state);
    return s?.capital === capital;
  }).length : 0;

  const pct = submitted ? Math.round((score / subset.length) * 100) : 0;

  const getStateName = (s: typeof NE_STATES[0]) => currentLang === 'hi' ? s.stateHi : currentLang === 'as' ? s.stateAs : s.state;
  const getCapitalName = (s: typeof NE_STATES[0]) => currentLang === 'hi' ? s.capitalHi : currentLang === 'as' ? s.capitalAs : s.capital;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-emerald-700 via-green-600 to-teal-700 text-white p-6 rounded-3xl shadow-elder">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-black flex items-center gap-2">🗺️ Northeast States & Capitals</h1>
          <button onClick={onExit} type="button" className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl cursor-pointer">Exit</button>
        </div>
        <p className="text-emerald-100 text-sm">Match each Northeast state to its capital city • {count} pairs</p>
      </div>

      {!submitted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* States column */}
          <div className="space-y-3">
            <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider flex items-center gap-2"><MapPin className="w-4 h-4"/>States</h3>
            {subset.map(s => (
              <div key={s.state} className={`p-4 rounded-2xl border-2 transition-all ${selected[s.state] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{s.emoji} {getStateName(s)}</span>
                  {selected[s.state] && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      → {getCapitalName(subset.find(x => x.capital === selected[s.state])!)}
                    </span>
                  )}
                </div>
                <select
                  value={selected[s.state] || ''}
                  onChange={e => setSelected(prev => ({ ...prev, [s.state]: e.target.value }))}
                  className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer font-semibold"
                >
                  <option value="">-- Select Capital --</option>
                  {shuffledCapitals.map(sc => (
                    <option key={sc.capital} value={sc.capital}>{getCapitalName(sc)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Capitals reference column */}
          <div className="space-y-3">
            <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider flex items-center gap-2"><Star className="w-4 h-4"/>Capital Cities</h3>
            <div className="grid grid-cols-2 gap-2">
              {shuffledCapitals.map(sc => (
                <div key={sc.capital} className={`p-3 rounded-2xl border ${Object.values(selected).includes(sc.capital) ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-sm font-bold text-gray-800">{getCapitalName(sc)}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSubmitted(true)}
              type="button"
              disabled={Object.keys(selected).length < subset.length}
              className="mt-4 w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-black text-lg cursor-pointer transition-all shadow-tactile"
            >
              Check Answers ✓
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`p-6 rounded-3xl text-center text-white ${pct >= 70 ? 'bg-emerald-600' : 'bg-amber-600'}`}>
            <div className="text-4xl font-black">{score}/{subset.length}</div>
            <div className="text-lg font-bold mt-1">{pct}% Correct</div>
            <div className="text-sm mt-1 opacity-90">{pct >= 80 ? '🎉 Excellent! Well done!' : pct >= 60 ? '👍 Good effort! Keep going!' : '📚 Keep learning — try again!'}</div>
          </div>
          {subset.map(s => {
            const correct = selected[s.state] === s.capital;
            return (
              <div key={s.state} className={`p-4 rounded-2xl border-2 flex items-center justify-between ${correct ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <span className="font-bold">{s.emoji} {getStateName(s)}</span>
                <div className="flex items-center gap-2">
                  {correct ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-500" />}
                  <span className={`text-sm font-bold ${correct ? 'text-emerald-700' : 'text-red-700'}`}>
                    {getCapitalName(s)}
                    {!correct && selected[s.state] && (
                      <span className="text-gray-500 font-normal"> (You: {getCapitalName(subset.find(x => x.capital === selected[s.state])!)})</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="flex gap-3">
            <button onClick={() => { setSelected({}); setSubmitted(false); }} type="button" className="flex-1 py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold cursor-pointer flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4"/>Play Again</button>
            <button onClick={onExit} type="button" className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">Go Back</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Generic MCQ game for Guess the Place / Food / Wildlife / Festivals ──────
interface McqItem {
  question: { en: string; hi: string; as: string };
  answer: string;
  options: string[];
  emoji: string;
}

const MultiChoiceGame: React.FC<{
  title: string; emoji: string; data: McqItem[]; difficulty: string;
  onExit: () => void; currentLang: string; speak: (t: string) => void;
}> = ({ title, emoji, data, difficulty, onExit, currentLang }) => {
  const count = difficulty === 'saral' ? 5 : difficulty === 'madhyam' ? 7 : data.length;
  const questions = data.slice(0, Math.min(count, data.length));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[idx];
  const qText = q?.question[currentLang as 'en'] || q?.question.en;

  const handleAnswer = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    if (opt === q.answer) setScore(s => s + 10);
  };

  const handleNext = () => {
    if (idx + 1 >= questions.length) { setFinished(true); return; }
    setIdx(i => i + 1);
    setSelected(null);
  };

  const pct = Math.round((score / (questions.length * 10)) * 100);

  if (finished) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className={`p-8 rounded-3xl text-center text-white shadow-xl ${pct >= 70 ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-amber-600 to-orange-700'}`}>
          <div className="text-5xl mb-2">{pct >= 80 ? '🏆' : pct >= 60 ? '🌟' : '💪'}</div>
          <h2 className="text-3xl font-black">{score} / {questions.length * 10}</h2>
          <p className="text-lg font-semibold mt-1 opacity-90">{pct}% Accuracy</p>
          <p className="mt-3 text-base font-bold">{pct >= 80 ? `${emoji} Outstanding cultural knowledge!` : pct >= 60 ? 'Great effort! Keep exploring Northeast India!' : 'Every round teaches something new!'}</p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setIdx(0); setSelected(null); setScore(0); setFinished(false); }} type="button" className="flex-1 py-3 bg-white/20 hover:bg-white/30 rounded-2xl font-bold cursor-pointer flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4"/>Play Again</button>
            <button onClick={onExit} type="button" className="flex-1 py-3 bg-white rounded-2xl text-emerald-800 font-bold cursor-pointer">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-700 via-orange-600 to-red-700 text-white p-5 rounded-3xl shadow-elder">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-black">{emoji} {title}</h1>
          <button onClick={onExit} type="button" className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl cursor-pointer">Exit</button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${((idx) / questions.length) * 100}%` }} />
          </div>
          <span className="text-xs font-bold">{idx + 1}/{questions.length}</span>
          <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">⭐ {score}</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-amber-200">
        <div className="text-4xl text-center mb-4">{q.emoji}</div>
        <p className="text-base sm:text-lg font-bold text-gray-900 text-center leading-relaxed">{qText}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.options.map(opt => {
          const isCorrect = opt === q.answer;
          const isSelected = selected === opt;
          let cls = 'bg-white border-2 border-gray-200 text-gray-900 hover:border-amber-400 hover:bg-amber-50';
          if (selected) {
            if (isCorrect) cls = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900';
            else if (isSelected) cls = 'bg-red-50 border-2 border-red-400 text-red-900';
            else cls = 'bg-gray-50 border-2 border-gray-200 text-gray-400';
          }
          return (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              type="button"
              disabled={!!selected}
              className={`p-4 rounded-2xl font-bold text-left flex items-center justify-between cursor-pointer transition-all ${cls}`}
            >
              <span>{opt}</span>
              {selected && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
              {selected && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={`p-4 rounded-2xl text-sm font-semibold border ${selected === q.answer ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {selected === q.answer ? `✅ Correct! +10 points — ${q.emoji} ${q.answer}` : `❌ The correct answer is: ${q.answer}`}
        </div>
      )}

      {selected && (
        <button
          onClick={handleNext}
          type="button"
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-lg cursor-pointer shadow-tactile flex items-center justify-center gap-2"
        >
          {idx + 1 >= questions.length ? '🏁 See Results' : 'Next Question'}
          <ArrowRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// ── Guess the Place (uses MCQ engine with LANDMARKS data) ───────────────────
const GuessThePlaceGame: React.FC<{
  data: typeof LANDMARKS; difficulty: string; onExit: () => void; currentLang: string; speak: (t: string) => void;
}> = ({ data, difficulty, onExit, currentLang, speak }) => (
  <MultiChoiceGame
    title="Guess the Landmark"
    emoji="🏛️"
    data={data.map(l => ({ question: l.clue, answer: l.answer, options: l.options, emoji: l.emoji }))}
    difficulty={difficulty}
    onExit={onExit}
    currentLang={currentLang}
    speak={speak}
  />
);

// ── Culture Match (uses MCQ with state as answer) ───────────────────────────
const CultureMatchGameInner: React.FC<{
  data: typeof CULTURE_ITEMS; difficulty: string; onExit: () => void; currentLang: string; speak: (t: string) => void;
}> = ({ data, difficulty, onExit, currentLang, speak }) => (
  <MultiChoiceGame
    title="Culture & Festival Match"
    emoji="🎭"
    data={data.map(c => ({ question: c.clue, answer: c.state, options: c.options, emoji: c.emoji }))}
    difficulty={difficulty}
    onExit={onExit}
    currentLang={currentLang}
    speak={speak}
  />
);
