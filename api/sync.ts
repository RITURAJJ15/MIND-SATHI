import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory cache for serverless invocation lifetime
let memoryStore: {
  patients: any[];
  caregivers: any[];
  links: any[];
} = {
  patients: [
    {
      id: '11111111-1111-4000-a000-000000000001',
      full_name: 'Ramesh Kumar',
      name: 'Ramesh Kumar',
      preferred_name: 'Ramesh Ji',
      preferredName: 'Ramesh Ji',
      role: 'elderly',
      email: 'ramesh@mindsathi.in',
      phone: '9876543210',
      age: 72,
      gender: 'male',
      city: 'Guwahati',
      state: 'Assam',
      connectionCode: 'MS-RAMESH',
      secondaryLanguage: 'MS-RAMESH',
      secondary_language: 'MS-RAMESH',
      profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      abha_id: '91-4829-1029-4820',
      abhaId: '91-4829-1029-4820',
      pmjay_id: 'PMJAY-AS-84729104',
      pmjayId: 'PMJAY-AS-84729104',
      streak_days: 5,
      streakDays: 5,
      total_xp: 450,
      totalXp: 450,
      level: 2,
      level_title: 'Sadhak Sathi',
      levelTitle: 'Sadhak Sathi',
      createdAt: new Date().toISOString(),
    },
  ],
  caregivers: [],
  links: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const url = req.url || '';
  const [urlPath] = url.split('?');
  const query = req.query || {};

  // 1. Find patient
  if (urlPath.includes('/find-patient') && req.method === 'GET') {
    const q = ((query.q || query.query || query.code || query.email || '') as string).trim().toLowerCase();
    const cleanDigits = q.replace(/\D/g, '');
    const codeNoPrefix = q.replace(/^ms-?/i, '');

    const found = memoryStore.patients.find((p) => {
      const pEmail = (p.email || '').toLowerCase();
      const pCode = (p.connectionCode || p.secondary_language || p.secondaryLanguage || '').toLowerCase();
      const pCodeNoPrefix = pCode.replace(/^ms-?/i, '');
      const pId = (p.id || '').toLowerCase();
      const pName = (p.full_name || p.name || '').toLowerCase();
      const pPhone = (p.phone || '').replace(/\D/g, '');

      if (pEmail && pEmail === q) return true;
      if (pCode && (pCode === q || pCodeNoPrefix === codeNoPrefix)) return true;
      if (pId && (pId === q || pId.startsWith(q) || (codeNoPrefix.length >= 4 && pId.replace(/-/g, '').startsWith(codeNoPrefix)))) return true;
      if (cleanDigits.length >= 10 && pPhone.endsWith(cleanDigits.slice(-10))) return true;
      if (q.length > 2 && pName.includes(q)) return true;
      return false;
    });

    if (found) {
      return res.status(200).json({ success: true, patient: found });
    }
    return res.status(404).json({ success: false, error: 'No patient found' });
  }

  // 2. Store patient
  if (urlPath.includes('/store-patient') && req.method === 'POST') {
    const body = req.body || {};
    const patient = body.patient || body;
    if (!patient?.id) return res.status(400).json({ success: false, error: 'Missing patient ID' });

    const connectionCode = patient.connectionCode || patient.secondary_language || patient.secondaryLanguage || ('MS-' + patient.id.replace(/-/g, '').substring(0, 6).toUpperCase());
    const normalized = {
      ...patient,
      connectionCode,
      secondaryLanguage: connectionCode,
      secondary_language: connectionCode,
      updatedAt: new Date().toISOString(),
    };

    const idx = memoryStore.patients.findIndex((p) => p.id === patient.id || (p.email && patient.email && p.email.toLowerCase() === patient.email.toLowerCase()));
    if (idx >= 0) memoryStore.patients[idx] = { ...memoryStore.patients[idx], ...normalized };
    else memoryStore.patients.push(normalized);

    return res.status(200).json({ success: true, patient: normalized });
  }

  // 3. Store caregiver
  if (urlPath.includes('/store-caregiver') && req.method === 'POST') {
    const body = req.body || {};
    const caregiver = body.caregiver || body;
    if (!caregiver?.email) return res.status(400).json({ success: false, error: 'Missing caregiver email' });

    const cleanEmail = caregiver.email.toLowerCase();
    const normalized = { ...caregiver, email: cleanEmail, updatedAt: new Date().toISOString() };
    const idx = memoryStore.caregivers.findIndex((c) => c.email.toLowerCase() === cleanEmail || (caregiver.id && c.id === caregiver.id));
    if (idx >= 0) memoryStore.caregivers[idx] = { ...memoryStore.caregivers[idx], ...normalized };
    else memoryStore.caregivers.push(normalized);

    return res.status(200).json({ success: true, caregiver: normalized });
  }

  // 4. Get caregiver
  if (urlPath.includes('/get-caregiver') && req.method === 'GET') {
    const email = ((query.email || '') as string).trim().toLowerCase();
    const found = memoryStore.caregivers.find((c) => c.email.toLowerCase() === email);
    if (found) return res.status(200).json({ success: true, caregiver: found });
    return res.status(404).json({ success: false, error: 'Caregiver not found' });
  }

  // 5. Link patient
  if (urlPath.includes('/link-patient') && req.method === 'POST') {
    const { caregiverId, patientId, caregiverEmail, patientEmail, connectionCode } = req.body || {};
    if (!caregiverId || !patientId) return res.status(400).json({ success: false, error: 'Missing IDs' });

    const otherCg = memoryStore.links.find((l) => l.patientId === patientId && l.caregiverId !== caregiverId);
    if (otherCg) {
      return res.status(409).json({ success: false, error: 'Patient is already linked to another caregiver.' });
    }

    memoryStore.links = memoryStore.links.filter((l) => l.caregiverId !== caregiverId && l.caregiverEmail !== caregiverEmail);
    memoryStore.links.push({
      caregiverId,
      patientId,
      caregiverEmail: caregiverEmail?.toLowerCase(),
      patientEmail: patientEmail?.toLowerCase(),
      connectionCode,
      linkedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  }

  // 6. Get assigned patient
  if (urlPath.includes('/get-assigned-patient') && req.method === 'GET') {
    const cgId = (query.caregiverId || '') as string;
    const cgEmail = ((query.caregiverEmail || '') as string).toLowerCase();

    const link = memoryStore.links.find((l) => (cgId && l.caregiverId === cgId) || (cgEmail && l.caregiverEmail === cgEmail));
    if (!link) return res.status(404).json({ success: false, error: 'No patient assigned' });

    const patient = memoryStore.patients.find(
      (p) =>
        p.id === link.patientId ||
        (link.patientEmail && p.email && p.email.toLowerCase() === link.patientEmail.toLowerCase()) ||
        (link.connectionCode && (p.connectionCode === link.connectionCode || p.secondary_language === link.connectionCode)) ||
        ((link.patientId === 'd8a2f3e4-5b6c-7d8e-9f0a-1b2c3d4e5f6a' || link.patientId === '11111111-1111-4000-a000-000000000001') &&
         p.email === 'ramesh@mindsathi.in')
    );
    if (patient) return res.status(200).json({ success: true, patient, link });
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  return res.status(404).json({ success: false, error: 'Not found' });
}
