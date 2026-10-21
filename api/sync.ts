import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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

  // 1. Enforce verified authentication header for all sync operations
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Authorization bearer token missing.',
    });
  }

  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: 'Persistent storage is not configured on the server.',
    });
  }

  const url = req.url || '';
  const [rawPath] = url.split('?');
  const query = req.query || {};
  const actionFromQuery = ((query.action || query.route || '') as string).toLowerCase();
  const urlPath = `${rawPath} /${actionFromQuery}`;

  const token = authHeader.substring(7).trim();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.',
    });
  }

  // Helper: check if caller has admin role
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isCallerAdmin = callerProfile?.role === 'admin' || user.app_metadata?.role === 'admin';

  try {
    // ── 1. Find patient (Authenticated Caregiver Connection Lookup) ───────────
    if (urlPath.includes('/find-patient') && req.method === 'GET') {
      const q = ((query.q || query.query || query.code || query.email || '') as string).trim().toLowerCase();
      if (!q) {
        return res.status(400).json({ success: false, error: 'Query parameter required' });
      }

      // A. Try find_patient_for_connection RPC with caller's authenticated context
      try {
        const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: rpcData, error: rpcErr } = await userClient.rpc('find_patient_for_connection', {
          identifier: q,
        });

        if (!rpcErr && rpcData) {
          const rows = Array.isArray(rpcData) ? rpcData : [rpcData];
          if (rows.length > 0 && rows[0]?.id) {
            return res.status(200).json({ success: true, patient: rows[0] });
          }
        }
      } catch {
        // Fall through to query lookup below
      }

      // B. Query public.profiles using safe minimal projection
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

      let queryBuilder = supabase
        .from('profiles')
        .select('id, full_name, preferred_name, role, email, phone, age, gender, city, state, northeast_region, profile_photo_url, connection_code, streak_days, total_xp, level, level_title, has_completed_onboarding, created_at')
        .in('role', ['elderly', 'patient']);

      if (isUuid) {
        queryBuilder = queryBuilder.eq('id', q);
      } else if (q.includes('@')) {
        queryBuilder = queryBuilder.ilike('email', q);
      } else {
        queryBuilder = queryBuilder.or(`connection_code.ilike.${q},phone.ilike.%${q}%`);
      }

      const { data: ptData, error: ptErr } = await queryBuilder.limit(1).maybeSingle();

      if (!ptErr && ptData) {
        const pt = ptData as Record<string, any>;
        return res.status(200).json({
          success: true,
          patient: {
            ...pt,
            name: pt.full_name,
            preferredName: pt.preferred_name,
            avatarUrl: pt.profile_photo_url,
            connectionCode: pt.connection_code,
            streakDays: pt.streak_days,
            totalXp: pt.total_xp,
            levelTitle: pt.level_title,
          },
        });
      }

      return res.status(404).json({ success: false, error: 'No patient found matching search criteria' });
    }

    // ── 2. Store / update patient profile (Strict Patient Ownership Check) ───
    if (urlPath.includes('/store-patient') && req.method === 'POST') {
      const body = req.body || {};
      const patient = body.patient || body;
      if (!patient?.id) {
        return res.status(400).json({ success: false, error: 'Missing patient ID' });
      }

      // Ownership enforcement: Caller can only update their own profile unless admin
      if (user.id !== patient.id && !isCallerAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only update your own patient profile.',
        });
      }

      const payload: Record<string, any> = {
        id: patient.id,
        updated_at: new Date().toISOString(),
      };

      if (patient.name || patient.full_name) payload.full_name = patient.name || patient.full_name;
      if (patient.preferredName || patient.preferred_name) payload.preferred_name = patient.preferredName || patient.preferred_name;
      if (patient.phone) payload.phone = patient.phone;
      if (patient.age) payload.age = patient.age;
      if (patient.gender) payload.gender = patient.gender;
      if (patient.city) payload.city = patient.city;
      if (patient.state) payload.state = patient.state;
      if (patient.connectionCode || patient.connection_code) payload.connection_code = patient.connectionCode || patient.connection_code;
      if (patient.profile_photo_url || patient.avatarUrl) payload.profile_photo_url = patient.profile_photo_url || patient.avatarUrl;

      const { error: upsertErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (upsertErr) {
        return res.status(500).json({ success: false, error: 'Failed to persist patient record in database' });
      }

      return res.status(200).json({ success: true, patient: payload });
    }

    // ── 3. Link caregiver and patient (Strict Caregiver Ownership Check) ─────
    if (urlPath.includes('/link-patient') && req.method === 'POST') {
      const { caregiverId, patientId, relationship = 'Caregiver' } = req.body || {};
      if (!caregiverId || !patientId) {
        return res.status(400).json({ success: false, error: 'caregiverId and patientId are required' });
      }

      // Ownership enforcement: Caller must be the caregiver being linked (or admin)
      if (user.id !== caregiverId && !isCallerAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only link patients to your own caregiver account.',
        });
      }

      // Check if patient is already linked to another caregiver
      const { data: existingLink } = await supabase
        .from('caregiver_patient')
        .select('caregiver_id')
        .eq('patient_id', patientId)
        .neq('caregiver_id', caregiverId)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (existingLink) {
        return res.status(409).json({
          success: false,
          error: 'Patient is already linked to another caregiver.',
        });
      }

      // Upsert relationship into public.caregiver_patient
      const { error: linkErr } = await supabase.from('caregiver_patient').upsert(
        {
          caregiver_id: caregiverId,
          patient_id: patientId,
          relationship,
          status: 'approved',
          approved_at: new Date().toISOString(),
        },
        { onConflict: 'caregiver_id,patient_id' }
      );

      if (linkErr) {
        console.error('[SyncApi] Link error:', linkErr);
        return res.status(500).json({ success: false, error: 'Failed to establish patient link in database' });
      }

      return res.status(200).json({ success: true, message: 'Caregiver and patient linked successfully' });
    }

    // ── 4. Unlink patient (Strict Caregiver or Patient Ownership Check) ──────
    if (urlPath.includes('/unlink-patient') && req.method === 'POST') {
      const { caregiverId, patientId } = req.body || {};
      if (!caregiverId) {
        return res.status(400).json({ success: false, error: 'caregiverId is required' });
      }

      // Ownership enforcement: Caller must be either the caregiver or the patient (or admin)
      if (user.id !== caregiverId && user.id !== patientId && !isCallerAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only unlink connections associated with your account.',
        });
      }

      let deleteQuery = supabase.from('caregiver_patient').delete().eq('caregiver_id', caregiverId);
      if (patientId) {
        deleteQuery = deleteQuery.eq('patient_id', patientId);
      }

      const { error: unlinkErr } = await deleteQuery;
      if (unlinkErr) {
        return res.status(500).json({ success: false, error: 'Failed to remove patient link from database' });
      }

      return res.status(200).json({ success: true, message: 'Link removed successfully' });
    }

    // ── 5. Get assigned patient for caregiver (Strict Caregiver Ownership) ───
    if (urlPath.includes('/get-assigned-patient') && req.method === 'GET') {
      const cgId = (query.caregiverId || '') as string;
      if (!cgId) {
        return res.status(400).json({ success: false, error: 'caregiverId query parameter is required' });
      }

      // Ownership enforcement: Caller can only view patients assigned to themselves (or admin)
      if (user.id !== cgId && !isCallerAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only view patients assigned to your own caregiver account.',
        });
      }

      // Query caregiver_patient join
      const { data: linkRows, error: linkErr } = await supabase
        .from('caregiver_patient')
        .select('patient_id, relationship, status, approved_at')
        .eq('caregiver_id', cgId)
        .eq('status', 'approved')
        .limit(1);

      if (linkErr || !linkRows || linkRows.length === 0) {
        return res.status(404).json({ success: false, error: 'No assigned patient found for caregiver' });
      }

      const patientId = linkRows[0].patient_id;
      const { data: patientProfile, error: ptErr } = await supabase
        .from('profiles')
        .select('id, full_name, preferred_name, role, email, phone, age, gender, city, state, northeast_region, profile_photo_url, connection_code, streak_days, total_xp, level, level_title, has_completed_onboarding, created_at')
        .eq('id', patientId)
        .maybeSingle();

      if (ptErr || !patientProfile) {
        return res.status(404).json({ success: false, error: 'Assigned patient profile not found' });
      }

      const pt = patientProfile as Record<string, any>;
      return res.status(200).json({
        success: true,
        patient: {
          ...pt,
          name: pt.full_name,
          preferredName: pt.preferred_name,
          avatarUrl: pt.profile_photo_url,
          connectionCode: pt.connection_code,
          streakDays: pt.streak_days,
          totalXp: pt.total_xp,
          levelTitle: pt.level_title,
        },
        link: linkRows[0],
      });
    }

    // ── 6. Get caregiver by email (Authenticated Caregiver Lookup) ───────────
    if (urlPath.includes('/get-caregiver') && req.method === 'GET') {
      const email = ((query.email || '') as string).trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, error: 'email query parameter required' });
      }

      const { data: cgData, error: cgErr } = await supabase
        .from('profiles')
        .select('id, full_name, preferred_name, role, email, phone, profile_photo_url, created_at')
        .eq('role', 'caregiver')
        .ilike('email', email)
        .maybeSingle();

      if (!cgErr && cgData) {
        return res.status(200).json({ success: true, caregiver: cgData });
      }

      return res.status(404).json({ success: false, error: 'Caregiver profile not found' });
    }

    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  } catch (error: any) {
    console.error('[SyncApi] Internal error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error processing sync request' });
  }
}
