/**
 * UniSafe Authority Portal - Police API & AI Backend Client
 *
 * Provides authenticated client calls for:
 * - Missing persons registry & photo dossier management
 * - Citizen sightings queue & AI face matching
 * - Graceful fallback to Supabase direct queries when Flask AI service is offline
 */

import { supabase } from './supabase.js';

const API_BASE = '/api';
const TOKEN_KEY = 'unisafe_authority_token';
const OFFICER_KEY = 'unisafe_authority_user';

const FALLBACK_TOKEN_KEYS = [
  'unisafe_authority_token',
  'access_token',
  'token',
  'auth_token',
  'authority_token',
];

const FALLBACK_OFFICER_KEYS = [
  'unisafe_authority_user',
  'authority_user',
  'current_user',
  'user',
];

export function getStoredToken() {
  if (typeof window === 'undefined') return null;

  // 1. Check URL parameters
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramToken = urlParams.get('access_token') || urlParams.get('token');
    if (paramToken && paramToken.trim()) {
      const cleanToken = paramToken.trim();
      setStoredToken(cleanToken);
      urlParams.delete('access_token');
      urlParams.delete('token');
      const cleanQuery = urlParams.toString();
      const cleanUrl =
        window.location.pathname +
        (cleanQuery ? `?${cleanQuery}` : '') +
        window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return cleanToken;
    }
  } catch {
    // Ignore URL parsing errors
  }

  // 2. Check primary and fallback keys
  for (const key of FALLBACK_TOKEN_KEYS) {
    try {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (
        val &&
        typeof val === 'string' &&
        val.trim() &&
        val !== 'null' &&
        val !== 'undefined'
      ) {
        return val.trim();
      }
    } catch {
      // Storage access error
    }
  }

  // 3. Inspect Supabase client auth tokens in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        ((key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key === 'supabase.auth.token')
      ) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const sbToken =
            parsed?.access_token || parsed?.currentSession?.access_token;
          if (sbToken && typeof sbToken === 'string') {
            return sbToken.trim();
          }
        }
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  return null;
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      for (const key of FALLBACK_TOKEN_KEYS) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('Storage error', e);
  }
}

export function getStoredOfficer() {
  if (typeof window === 'undefined') return null;

  for (const key of FALLBACK_OFFICER_KEYS) {
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        ((key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key === 'supabase.auth.token')
      ) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user && typeof parsed.user === 'object') {
            return parsed.user;
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

export function setStoredOfficer(user) {
  try {
    if (user) {
      localStorage.setItem(OFFICER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(OFFICER_KEY);
      for (const key of FALLBACK_OFFICER_KEYS) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('Storage error', e);
  }
}

export function getAuthorityLoginUrl() {
  return '/authority/login';
}

export function redirectToAuthorityLogin() {
  if (typeof window === 'undefined') return;
  const loginUrl = getAuthorityLoginUrl();
  const currentPath = window.location.pathname;

  if (currentPath !== loginUrl) {
    const returnUrl = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    window.location.href = `${loginUrl}?redirect=${returnUrl}`;
  }
}

export function clearAuthoritySession() {
  setStoredToken(null);
  setStoredOfficer(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('unisafe:auth_changed', { detail: null }));
  }
}

async function authFetch(url, options = {}) {
  let token = getStoredToken();
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch {
      // Ignore session fetch errors
    }
  }

  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthoritySession();
      redirectToAuthorityLogin();
    }

    let errorMessage = 'An error occurred during request';
    if (data && typeof data === 'object' && data.error) {
      errorMessage = data.error;
      if (data.detected_faces !== undefined) {
        errorMessage += ` (Detected faces: ${data.detected_faces})`;
      }
    } else if (typeof data === 'string' && data.trim()) {
      errorMessage = data;
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function loginAuthority(credentials) {
  const response = await fetch(`${API_BASE}/auth/authority-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await handleResponse(response);
  if (data?.access_token) {
    setStoredToken(data.access_token);
    setStoredOfficer(data.user);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('unisafe:auth_changed', { detail: data.user }));
    }
  }
  return data;
}

export async function getCurrentOfficer() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const response = await authFetch(`${API_BASE}/auth/me`, { method: 'GET' });
    const data = await handleResponse(response);
    if (data?.user) {
      setStoredOfficer(data.user);
    }
    return data?.user;
  } catch {
    return null;
  }
}

export async function logoutAuthority() {
  try {
    await authFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  } catch {
    // Ignore backend logout error
  }
  await supabase.auth.signOut();
  clearAuthoritySession();
}

// ============================================================
// STORAGE & SIGNED URL UTILITIES
// ============================================================

export const STORAGE_BUCKET = 'missing-person-images';
export const DEFAULT_URL_EXPIRY = 3600; // 1 hour

/**
 * Safely generates a time-limited signed URL for an image in the private storage bucket.
 * Handles:
 * - Direct paths: "sightings/xxx.jpg", "missing_people/MP001/photo_1.jpg"
 * - Paths with leading slashes or bucket prefixes
 * - Full URLs that may contain expired tokens or public paths: strips and re-signs fresh
 * - External or non-Supabase URLs: preserved as-is
 */
export async function getSignedStorageUrl(pathOrUrl, expirySeconds = DEFAULT_URL_EXPIRY) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string' || !pathOrUrl.trim()) {
    return null;
  }
  const cleanInput = pathOrUrl.trim();

  // If already an HTTP/HTTPS URL
  if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
    // Check if it is a Supabase storage URL pointing to our bucket
    const bucketMarker = `/${STORAGE_BUCKET}/`;
    const markerIndex = cleanInput.indexOf(bucketMarker);
    if (markerIndex !== -1) {
      // Extract the object path after the bucket name, discarding any expired query token
      let extractedPath = cleanInput.slice(markerIndex + bucketMarker.length);
      const queryIdx = extractedPath.indexOf('?');
      if (queryIdx !== -1) {
        extractedPath = extractedPath.slice(0, queryIdx);
      }
      try {
        const decodedPath = decodeURIComponent(extractedPath);
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(decodedPath, expirySeconds);
        if (data?.signedUrl) return data.signedUrl;
      } catch (err) {
        console.warn('[PoliceService] Failed to re-sign storage URL, returning original:', err.message);
      }
    }
    // Return original URL if external or re-signing not applicable
    return cleanInput;
  }

  // It's a relative storage path (e.g. "sightings/xxx.jpg" or "/missing_people/MP001/photo_1.jpg")
  let cleanPath = cleanInput.replace(/^\/+/, '');
  if (cleanPath.startsWith(`${STORAGE_BUCKET}/`)) {
    cleanPath = cleanPath.slice(`${STORAGE_BUCKET}/`.length);
  }

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(cleanPath, expirySeconds);

    if (error) {
      console.warn(`[PoliceService] Error generating signed URL for "${cleanPath}":`, error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn(`[PoliceService] Exception generating signed URL for "${cleanPath}":`, err.message);
    return null;
  }
}

/**
 * Enriches AI match evaluations with missing-person case metadata and
 * time-limited signed URLs for reference photos.
 */
async function enrichCandidateMatches(aiMatches) {
  if (!Array.isArray(aiMatches) || aiMatches.length === 0) return [];
  const personIds = [...new Set(aiMatches.map((m) => m?.missing_person_id).filter(Boolean))];
  if (personIds.length === 0) return [];

  try {
    const { data: persons } = await supabase
      .from('missing_persons')
      .select('id, case_code, full_name, age, gender, status')
      .in('id', personIds);

    const personMap = new Map((persons || []).map((p) => [p.id, p]));

    const { data: embeddings } = await supabase
      .from('missing_person_embeddings')
      .select('missing_person_id, image_path')
      .in('missing_person_id', personIds);

    const photoMap = new Map();
    for (const emb of embeddings || []) {
      if (!photoMap.has(emb.missing_person_id) && emb.image_path) {
        photoMap.set(emb.missing_person_id, emb.image_path);
      }
    }

    const candidateCases = [];
    for (const match of aiMatches) {
      if (!match || typeof match !== 'object') continue;
      const pid = match.missing_person_id;
      const person = personMap.get(pid) || {};
      const photoPath = photoMap.get(pid);
      const signedRefUrl = photoPath ? await getSignedStorageUrl(photoPath) : null;
      const simScore = typeof match.similarity_score === 'number' ? match.similarity_score : 0.0;

      candidateCases.push({
        face_index: match.face_index || 0,
        missing_person_id: pid,
        case_code: person.case_code || 'N/A',
        full_name: person.full_name || 'Unknown Subject',
        age: person.age,
        gender: person.gender,
        status: person.status || 'Missing',
        similarity_score: simScore,
        similarity_percentage: Math.round(simScore * 1000) / 10,
        match_category: match.match_category || match.status || 'no_match',
        reference_photo_path: photoPath,
        reference_photo_signed_url: signedRefUrl,
        reference_photo_url: signedRefUrl,
      });
    }

    candidateCases.sort((a, b) => b.similarity_score - a.similarity_score);
    return candidateCases;
  } catch (err) {
    console.warn('[PoliceService] Failed to enrich candidate matches:', err.message);
    return [];
  }
}

// ============================================================
// MISSING PERSONS DOSSIERS APIS
// ============================================================

export async function getMissingPersons(status = 'all', limit = null, jurisdiction = null) {
  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') {
      params.set('status', status);
    }
    if (limit && Number(limit) > 0) {
      params.set('limit', String(limit));
    }
    if (jurisdiction && jurisdiction !== 'all') {
      params.set('jurisdiction', jurisdiction);
    }

    const queryString = params.toString();
    const url = `${API_BASE}/missing-persons${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url, { method: 'GET' });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI endpoint unavailable, using Supabase direct query fallback:', err.message);
    try {
      let query = supabase.from('missing_persons').select('*').order('created_at', { ascending: false });
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }
      if (jurisdiction && jurisdiction !== 'all') {
        if (jurisdiction === 'unassigned' || jurisdiction === 'pending') {
          query = query.is('jurisdiction', null);
        } else {
          query = query.ilike('jurisdiction', jurisdiction);
        }
      }
      const { data, error } = await query;
      if (error) {
        // Defensive fallback: If column missing_persons.jurisdiction does not exist (code 42703)
        if (error.code === '42703') {
          console.warn('[PoliceService] Jurisdiction column not yet created on missing_persons, querying without jurisdiction filter.');
          let fallbackQuery = supabase.from('missing_persons').select('*').order('created_at', { ascending: false });
          if (status && status !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', status);
          }
          if (limit && Number(limit) > 0) {
            fallbackQuery = fallbackQuery.limit(Number(limit));
          }
          const { data: fbData, error: fbError } = await fallbackQuery;
          if (fbError) throw fbError;
          return {
            success: true,
            count: fbData?.length || 0,
            missing_persons: fbData || []
          };
        }
        throw error;
      }
      return {
        success: true,
        count: data?.length || 0,
        missing_persons: data || []
      };
    } catch (dbErr) {
      throw dbErr;
    }
  }
}

export async function getMissingPersonDetail(personId) {
  if (!personId) throw new Error('personId is required');
  try {
    const response = await authFetch(`${API_BASE}/missing-persons/${personId}`, {
      method: 'GET',
    });
    const data = await handleResponse(response);
    // Ensure all returned photos have valid signed URLs
    if (data && Array.isArray(data.photos)) {
      for (const p of data.photos) {
        if (!p.signed_url && p.image_path) {
          p.signed_url = await getSignedStorageUrl(p.image_path);
        }
      }
    }
    return data;
  } catch (err) {
    // Preserve HTTP 403 authorization responses: do not attempt fallback or mask authorization errors
    if (err?.status === 403) {
      throw err;
    }
    console.warn('[PoliceService] Flask AI detail endpoint unavailable, using Supabase direct query fallback:', err.message);
    let { data: person, error: personErr } = await supabase
      .from('missing_persons')
      .select('*')
      .eq('id', personId)
      .maybeSingle();

    // If direct query returns nothing or error (e.g. cross-jurisdiction RLS restriction),
    // attempt to load candidate dossier via hardened SECURITY DEFINER RPC
    if (!person && personId) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase
          .rpc('get_candidate_case_dossier', { target_person_id: personId });
        if (!rpcErr && rpcData) {
          person = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          personErr = null;
        }
      } catch (rpcEx) {
        console.warn('[PoliceService] Candidate dossier RPC fallback error:', rpcEx.message);
      }
    }

    if (personErr) throw personErr;
    if (!person) throw new Error('Missing-person case not found');

    // Retrieve all reference photos from missing_person_embeddings
    const { data: embeddings, error: embErr } = await supabase
      .from('missing_person_embeddings')
      .select('id, image_path, det_score, created_at')
      .eq('missing_person_id', personId)
      .order('created_at', { ascending: true });

    if (embErr) {
      console.warn('[PoliceService] Error fetching embeddings for case:', embErr.message);
    }

    const photos = [];
    for (const record of embeddings || []) {
      if (!record.image_path) continue;
      const signedUrl = await getSignedStorageUrl(record.image_path);
      photos.push({
        embedding_id: record.id,
        id: record.id,
        image_path: record.image_path,
        signed_url: signedUrl,
        detection_score: record.det_score,
        created_at: record.created_at,
      });
    }

    const { count: sightingsCount } = await supabase
      .from('missing_person_sightings')
      .select('*', { count: 'exact', head: true })
      .eq('missing_person_id', personId);

    return {
      ...person,
      person,
      photos,
      photo_count: photos.length,
      sightings_count: sightingsCount || 0,
      success: true
    };
  }
}

export async function createMissingPerson(formData) {
  // Collect all files from formData
  const allFiles = [];
  const primaryFile = formData.get('missing_person_image');
  if (primaryFile instanceof File && primaryFile.size > 0) {
    allFiles.push(primaryFile);
  }
  const additional = formData.getAll('additional_images');
  for (const f of additional) {
    if (f instanceof File && f.size > 0 && !allFiles.includes(f)) {
      allFiles.push(f);
    }
  }
  const multiImages = formData.getAll('missing_person_images');
  for (const f of multiImages) {
    if (f instanceof File && f.size > 0 && !allFiles.includes(f)) {
      allFiles.push(f);
    }
  }

  if (allFiles.length === 0) {
    throw new Error('At least one reference photograph is required for facial indexing.');
  }

  // 1. Try Flask AI backend first
  try {
    const response = await authFetch(`${API_BASE}/missing-persons`, {
      method: 'POST',
      body: formData,
    });
    const result = await handleResponse(response);

    // If Flask created the report and additional photos exist, upload them via addCasePhoto
    const personId = result.person_id || result.id;
    if (personId && allFiles.length > 1) {
      for (let i = 1; i < allFiles.length; i++) {
        try {
          const addForm = new FormData();
          addForm.append('missing_person_image', allFiles[i]);
          await addCasePhoto(personId, addForm);
        } catch (addErr) {
          console.warn(`[PoliceService] Additional photo #${i + 1} upload warning:`, addErr.message);
        }
      }
    }
    return result;
  } catch (flaskErr) {
    console.warn('[PoliceService] Flask AI registration endpoint unavailable, executing Supabase direct fallback:', flaskErr.message);

    // 2. Direct Supabase Fallback
    const fullName = formData.get('full_name')?.trim();
    if (!fullName) {
      throw new Error('Full legal name is required.');
    }

    const rawAge = formData.get('age');
    const age = rawAge && rawAge.trim() ? parseInt(rawAge.trim(), 10) : null;
    const gender = formData.get('gender') || null;
    const rawLastSeen = formData.get('last_seen_date');
    let lastSeenDate = null;
    if (rawLastSeen && rawLastSeen.trim()) {
      try {
        lastSeenDate = new Date(rawLastSeen.trim()).toISOString();
      } catch {
        lastSeenDate = rawLastSeen.trim();
      }
    }
    const rawLat = formData.get('latitude');
    const rawLon = formData.get('longitude');
    const latitude = rawLat && rawLat.trim() ? parseFloat(rawLat.trim()) : null;
    const longitude = rawLon && rawLon.trim() ? parseFloat(rawLon.trim()) : null;
    const description = formData.get('description')?.trim() || null;
    const jurisdiction = formData.get('jurisdiction')?.trim() || null;

    let createdPerson = null;
    const uploadedPaths = [];
    const insertedEmbeddingIds = [];

    try {
      // Step A: Insert missing person record
      const personPayload = {
        full_name: fullName,
        age,
        gender,
        last_seen_date: lastSeenDate,
        latitude,
        longitude,
        description,
        status: 'Missing'
      };
      if (jurisdiction && jurisdiction.toLowerCase() !== 'unassigned') {
        personPayload.jurisdiction = jurisdiction;
      }

      let { data: newPerson, error: personInsertErr } = await supabase
        .from('missing_persons')
        .insert(personPayload)
        .select()
        .single();

      // Defensive fallback: If column jurisdiction does not exist (code 42703), retry without jurisdiction
      if (personInsertErr && personInsertErr.code === '42703' && personPayload.jurisdiction) {
        console.warn('[PoliceService] Jurisdiction column not yet created, retrying insert without jurisdiction.');
        delete personPayload.jurisdiction;
        const retryResult = await supabase
          .from('missing_persons')
          .insert(personPayload)
          .select()
          .single();
        newPerson = retryResult.data;
        personInsertErr = retryResult.error;
      }

      if (personInsertErr || !newPerson) {
        throw new Error(`Failed to insert missing person dossier: ${personInsertErr?.message || 'Database insert error'}`);
      }
      createdPerson = newPerson;

      // Ensure case_code exists (generated by DB trigger or fallback generated)
      let caseCode = newPerson.case_code;
      if (!caseCode) {
        caseCode = `MP${String(Date.now()).slice(-4)}`;
        await supabase
          .from('missing_persons')
          .update({ case_code: caseCode })
          .eq('id', newPerson.id);
        createdPerson.case_code = caseCode;
      }

      // Step B: Upload all reference photos and link to missing_person_embeddings
      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const ext = (file.name && file.name.split('.').pop().toLowerCase()) || 'jpg';
        const timestamp = Date.now();
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `photo_${i + 1}.${ext}`;
        const storagePath = `missing_people/${caseCode}/photo_${i + 1}_${timestamp}_${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type || 'image/jpeg',
            upsert: false
          });

        if (uploadErr) {
          throw new Error(`Failed to upload photo #${i + 1} (${file.name}): ${uploadErr.message}`);
        }
        uploadedPaths.push(storagePath);

        const { data: embData, error: embErr } = await supabase
          .from('missing_person_embeddings')
          .insert({
            missing_person_id: createdPerson.id,
            image_path: storagePath,
            det_score: 1.0
          })
          .select()
          .single();

        if (embErr) {
          throw new Error(`Failed to index photo #${i + 1}: ${embErr.message}`);
        }
        if (embData?.id) {
          insertedEmbeddingIds.push(embData.id);
        }
      }

      return {
        success: true,
        message: 'Missing-person report created successfully',
        person_id: createdPerson.id,
        id: createdPerson.id,
        case_code: createdPerson.case_code,
        full_name: createdPerson.full_name,
        photo_count: uploadedPaths.length,
        image_path: uploadedPaths[0],
        detection_score: 1.0,
        person: createdPerson
      };
    } catch (directErr) {
      console.error('[PoliceService] Direct registration fallback failed, cleaning up incomplete artifacts:', directErr);

      // Clean up uploaded storage files
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        } catch (cleanupUploadErr) {
          console.warn('[PoliceService] Failed to clean up uploaded files:', cleanupUploadErr);
        }
      }

      // Clean up inserted embeddings
      if (insertedEmbeddingIds.length > 0) {
        try {
          await supabase.from('missing_person_embeddings').delete().in('id', insertedEmbeddingIds);
        } catch (cleanupEmbErr) {
          console.warn('[PoliceService] Failed to clean up embeddings:', cleanupEmbErr);
        }
      }

      // Clean up person record
      if (createdPerson?.id) {
        try {
          await supabase.from('missing_persons').delete().eq('id', createdPerson.id);
        } catch (cleanupPersonErr) {
          console.warn('[PoliceService] Failed to clean up person record:', cleanupPersonErr);
        }
      }

      throw directErr;
    }
  }
}

export async function updateMissingPerson(personId, updates) {
  if (!personId) throw new Error('personId is required');
  try {
    const response = await authFetch(`${API_BASE}/missing-persons/${personId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI update endpoint unavailable, applying Supabase direct update:', err.message);
    const { data, error } = await supabase
      .from('missing_persons')
      .update(updates)
      .eq('id', personId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, person: data };
  }
}

export async function updateCaseStatus(personId, status, verifiedConfirmation = false, remarks = '') {
  if (!personId) throw new Error('personId is required');
  if (!status) throw new Error('status is required');

  try {
    const response = await authFetch(`${API_BASE}/missing-persons/${personId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        verified_confirmation: verifiedConfirmation,
        remarks,
      }),
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI status update unavailable, applying Supabase direct update:', err.message);
    const { data, error } = await supabase
      .from('missing_persons')
      .update({ status })
      .eq('id', personId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, person: data };
  }
}

export async function addCasePhoto(personId, formData) {
  if (!personId) throw new Error('personId is required');
  try {
    const response = await authFetch(`${API_BASE}/missing-persons/${personId}/photos`, {
      method: 'POST',
      body: formData,
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI add photo endpoint unavailable, using Supabase direct upload fallback:', err.message);

    // 1. Fetch case record to get case_code
    const { data: person, error: personErr } = await supabase
      .from('missing_persons')
      .select('id, case_code')
      .eq('id', personId)
      .single();

    if (personErr || !person) {
      throw new Error('Missing-person case record not found');
    }

    const caseCode = person.case_code || `MP${personId.slice(0, 6)}`;
    const file = formData.get('missing_person_image') || formData.get('file');

    if (!file) {
      throw new Error('A reference photo is required');
    }

    const ext = (file.name && file.name.split('.').pop().toLowerCase()) || 'jpg';
    const timestamp = Date.now();
    const cleanFilename = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `photo_${timestamp}.${ext}`;
    const storagePath = `missing_people/${caseCode}/${timestamp}_${cleanFilename}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      });

    if (uploadErr) {
      throw new Error(`Failed to upload photo to storage: ${uploadErr.message}`);
    }

    // Insert record into missing_person_embeddings
    const { data: newEmbedding, error: embErr } = await supabase
      .from('missing_person_embeddings')
      .insert({
        missing_person_id: personId,
        image_path: storagePath,
        det_score: 1.0
      })
      .select()
      .single();

    if (embErr) {
      // Cleanup uploaded file on DB insert failure
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw new Error(`Failed to save photo record: ${embErr.message}`);
    }

    const signedUrl = await getSignedStorageUrl(storagePath);

    return {
      success: true,
      message: 'Photo uploaded successfully',
      embedding_id: newEmbedding.id,
      image_path: storagePath,
      signed_url: signedUrl,
      detection_score: 1.0,
      photo: {
        embedding_id: newEmbedding.id,
        image_path: storagePath,
        signed_url: signedUrl,
        detection_score: 1.0,
        created_at: newEmbedding.created_at
      }
    };
  }
}

export async function deleteCasePhoto(personId, embeddingId) {
  if (!personId) throw new Error('personId is required');
  if (!embeddingId) throw new Error('embeddingId is required');
  try {
    const response = await authFetch(`${API_BASE}/missing-persons/${personId}/photos`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embedding_id: embeddingId }),
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI delete photo endpoint unavailable, using Supabase direct delete fallback:', err.message);

    // 1. Get embedding record to retrieve image_path
    const { data: embedding, error: fetchErr } = await supabase
      .from('missing_person_embeddings')
      .select('id, image_path, missing_person_id')
      .eq('id', embeddingId)
      .single();

    if (fetchErr || !embedding) {
      throw new Error('Photo embedding record not found');
    }

    // 2. Remove file from storage
    if (embedding.image_path) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([embedding.image_path]);
      } catch (cleanErr) {
        console.warn('[PoliceService] Storage file removal warning:', cleanErr.message);
      }
    }

    // 3. Delete from missing_person_embeddings
    const { error: delErr } = await supabase
      .from('missing_person_embeddings')
      .delete()
      .eq('id', embeddingId);

    if (delErr) {
      throw new Error(`Failed to delete photo record: ${delErr.message}`);
    }

    return {
      success: true,
      message: 'Reference photo removed successfully'
    };
  }
}

// ============================================================
// CITIZEN SIGHTINGS QUEUE APIS
// ============================================================

export async function getSightings(isVerified = 'all', limit = null) {
  try {
    const params = new URLSearchParams();
    if (isVerified && isVerified !== 'all') {
      params.set('is_verified', isVerified);
    }
    if (limit && Number(limit) > 0) {
      params.set('limit', String(limit));
    }

    const queryString = params.toString();
    const url = `${API_BASE}/sightings${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url, { method: 'GET' });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI sightings endpoint unavailable, using Supabase direct query fallback:', err.message);
    let query = supabase.from('missing_person_sightings').select('*').order('created_at', { ascending: false });
    if (isVerified === 'true' || isVerified === true) {
      query = query.eq('is_verified', true);
    } else if (isVerified === 'false' || isVerified === false) {
      query = query.eq('is_verified', false);
    }
    if (limit && Number(limit) > 0) {
      query = query.limit(Number(limit));
    }
    const { data: sightingRecords, error } = await query;
    if (error) throw error;

    const personIds = [...new Set((sightingRecords || []).map((r) => r.missing_person_id).filter(Boolean))];
    const caseMap = new Map();
    if (personIds.length > 0) {
      const { data: cases } = await supabase
        .from('missing_persons')
        .select('id, case_code, full_name, status')
        .in('id', personIds);
      (cases || []).forEach((c) => caseMap.set(c.id, c));
    }

    const enrichedSightings = (sightingRecords || []).map((record) => {
      const c = record.missing_person_id ? caseMap.get(record.missing_person_id) : null;
      const cStatus = c?.status || 'Missing';
      return {
        ...record,
        citizen_note: record.citizen_note || null,
        image_path: record.image_url,
        linked_case_code: c?.case_code || null,
        linked_case_name: c?.full_name || null,
        linked_case_status: c ? cStatus : null,
        is_case_resolved: c ? ['Found', 'Closed'].includes(cStatus) : false,
      };
    });

    return {
      success: true,
      count: enrichedSightings.length,
      sightings: enrichedSightings
    };
  }
}

export async function getSightingDetail(sightingId) {
  if (!sightingId) throw new Error('sightingId is required');
  try {
    const response = await authFetch(`${API_BASE}/sightings/${sightingId}`, {
      method: 'GET',
    });
    const data = await handleResponse(response);
    // Ensure signed image URL is valid
    if (data && !data.signed_image_url && (data.image_url || data.image_path)) {
      data.signed_image_url = await getSignedStorageUrl(data.image_url || data.image_path);
      data.signed_url = data.signed_image_url;
    }
    return data;
  } catch (err) {
    console.warn('[PoliceService] Flask AI sighting detail endpoint unavailable, using Supabase direct query fallback:', err.message);
    const { data: sighting, error } = await supabase
      .from('missing_person_sightings')
      .select('*')
      .eq('id', sightingId)
      .single();

    if (error) throw error;
    if (!sighting) throw new Error('Sighting not found');

    const imagePath = sighting.image_url;
    const signedUrl = await getSignedStorageUrl(imagePath);

    // Enrich linked case if missing_person_id exists
    let linkedCase = null;
    if (sighting.missing_person_id) {
      try {
        const { data: personData } = await supabase
          .from('missing_persons')
          .select('id, case_code, full_name, age, gender, status')
          .eq('id', sighting.missing_person_id)
          .single();
        if (personData) {
          linkedCase = {
            ...personData,
            is_resolved: ['Found', 'Closed'].includes(personData.status)
          };
        }
      } catch (caseErr) {
        console.warn('[PoliceService] Failed to load linked case:', caseErr.message);
      }
    }

    // Enrich candidate cases from ai_matches
    let candidateCases = [];
    if (Array.isArray(sighting.ai_matches) && sighting.ai_matches.length > 0) {
      candidateCases = await enrichCandidateMatches(sighting.ai_matches);
    }

    const sightingResult = {
      ...sighting,
      image_path: imagePath,
      signed_image_url: signedUrl,
      signed_url: signedUrl,
      linked_case: linkedCase,
      linked_case_code: linkedCase?.case_code || null,
      linked_case_name: linkedCase?.full_name || null,
      linked_case_status: linkedCase?.status || null,
      is_case_resolved: Boolean(linkedCase?.is_resolved),
      candidate_cases: candidateCases,
      sighting: {
        ...sighting,
        image_path: imagePath,
        signed_image_url: signedUrl,
        signed_url: signedUrl,
      }
    };

    return sightingResult;
  }
}

export async function findSightingMatches(sightingId) {
  if (!sightingId) throw new Error('sightingId is required');
  try {
    const response = await authFetch(`${API_BASE}/sightings/${sightingId}/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI matching service unavailable, evaluating candidate cases fallback:', err.message);

    const { data: activeCases } = await supabase
      .from('missing_persons')
      .select('id, case_code, full_name, age, gender, status')
      .eq('status', 'Missing')
      .order('created_at', { ascending: false })
      .limit(6);

    const { data: sighting } = await supabase
      .from('missing_person_sightings')
      .select('id, ai_matches, missing_person_id')
      .eq('id', sightingId)
      .single();

    let candidateCases = [];
    if (sighting?.ai_matches && Array.isArray(sighting.ai_matches) && sighting.ai_matches.length > 0) {
      candidateCases = await enrichCandidateMatches(sighting.ai_matches);
    } else if (activeCases && activeCases.length > 0) {
      for (const c of activeCases) {
        const { data: emb } = await supabase
          .from('missing_person_embeddings')
          .select('image_path')
          .eq('missing_person_id', c.id)
          .limit(1)
          .single();
        const photoUrl = emb?.image_path ? await getSignedStorageUrl(emb.image_path) : null;
        candidateCases.push({
          face_index: 0,
          missing_person_id: c.id,
          case_code: c.case_code || 'N/A',
          full_name: c.full_name,
          age: c.age,
          gender: c.gender,
          status: c.status,
          similarity_score: 0.0,
          similarity_percentage: 0.0,
          match_category: 'visual_comparison',
          reference_photo_url: photoUrl,
        });
      }
    }

    return {
      success: true,
      matched: false,
      message: 'Flask AI matching engine is currently offline. Active registered cases loaded for visual officer verification.',
      candidate_cases: candidateCases,
      ai_matches: sighting?.ai_matches || [],
      matched_person_id: sighting?.missing_person_id || null
    };
  }
}

export async function updateSightingVerification(sightingId, action, remarks = '') {
  if (!sightingId) throw new Error('sightingId is required');
  try {
    const response = await authFetch(`${API_BASE}/sightings/${sightingId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, remarks }),
    });
    return await handleResponse(response);
  } catch (err) {
    console.warn('[PoliceService] Flask AI verify endpoint unavailable, applying Supabase direct update:', err.message);
    const isVerified = action === 'verify';
    const { data, error } = await supabase
      .from('missing_person_sightings')
      .update({ is_verified: isVerified })
      .eq('id', sightingId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, sighting: data, is_verified: isVerified, message: `Sighting ${isVerified ? 'verified' : 'unverified'} successfully.` };
  }
}

// ============================================================
// JURISDICTION & STATION ASSIGNMENT APIS
// ============================================================

/**
 * Retrieves unassigned missing-person cases (jurisdiction IS NULL) for police review.
 */
export async function getUnassignedCasesForReview() {
  try {
    // 1. Try atomic RPC first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_unassigned_cases_for_review');
    if (!rpcErr && Array.isArray(rpcData)) {
      return { success: true, count: rpcData.length, missing_persons: rpcData };
    }

    // 2. Direct query fallback
    const { data, error } = await supabase
      .from('missing_persons')
      .select('*')
      .is('jurisdiction', null)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42703') {
        return { success: true, count: 0, missing_persons: [] };
      }
      throw error;
    }
    return { success: true, count: data?.length || 0, missing_persons: data || [] };
  } catch (err) {
    console.warn('[PoliceService] Failed to load unassigned cases for review:', err.message);
    return { success: false, count: 0, missing_persons: [], error: err.message };
  }
}

/**
 * Claims an unassigned missing-person case for the officer's station (e.g. Bandra or Andheri).
 * Enforces the Station Claim Rule: officers can only claim for their own assigned jurisdiction.
 * Protects against concurrent claim races with atomic WHERE jurisdiction IS NULL check.
 */
export async function claimCaseJurisdiction(caseId, targetJurisdiction) {
  if (!caseId) throw new Error('caseId is required');
  if (!targetJurisdiction) throw new Error('targetJurisdiction is required');

  try {
    // 1. Try atomic RPC first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('assign_case_jurisdiction', {
      target_case_id: caseId,
      target_jurisdiction: targetJurisdiction
    });
    if (!rpcErr) {
      return {
        success: true,
        message: `Case successfully claimed for ${targetJurisdiction} station`,
        data: rpcData
      };
    }

    // If RPC returned an authorization error or conflict error, throw immediately
    if (rpcErr.code === '28000' || rpcErr.code === '23505' || rpcErr.code === '42501') {
      throw new Error(rpcErr.message || 'Jurisdiction claim rejected by database rule');
    }

    // 2. Direct Supabase update fallback with atomic WHERE jurisdiction IS NULL
    const { data, error } = await supabase
      .from('missing_persons')
      .update({ jurisdiction: targetJurisdiction })
      .eq('id', caseId)
      .is('jurisdiction', null)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Case could not be claimed. It may have already been claimed by another station or assigned.');
    }

    return {
      success: true,
      message: `Case successfully claimed for ${targetJurisdiction} station`,
      person: data
    };
  } catch (err) {
    console.error('[PoliceService] Error claiming case jurisdiction:', err);
    throw err;
  }
}

