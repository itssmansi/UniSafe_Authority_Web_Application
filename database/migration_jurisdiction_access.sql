-- ====================================================================
-- UniSafe: Simple Jurisdiction-Based Access for Police Missing Persons
-- File: database/migration_jurisdiction_access.sql
-- ====================================================================

-- 1. ADD JURISDICTION COLUMN TO MISSING_PERSONS
ALTER TABLE public.missing_persons 
ADD COLUMN IF NOT EXISTS jurisdiction text;

-- Create performance index for jurisdiction lookups
CREATE INDEX IF NOT EXISTS idx_missing_persons_jurisdiction 
ON public.missing_persons (jurisdiction);

-- 2. VERIFIED INITIAL DATA MIGRATION
-- Only assign MP005 (Hetal Rana) to Bandra as verified.
-- Leave MP001, MP002, MP003, MP006 unassigned (NULL) for station review.
UPDATE public.missing_persons 
SET jurisdiction = 'Bandra' 
WHERE case_code = 'MP005';

-- 3. HELPER FUNCTIONS TO RETRIEVE CALLER CREDENTIALS SAFELY
CREATE OR REPLACE FUNCTION public.current_authority_jurisdiction()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jurisdiction 
  FROM public.authorities 
  WHERE auth_user_id = auth.uid() 
     OR id::text = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_police_authority()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.authorities 
    WHERE (auth_user_id = auth.uid() OR id::text = auth.uid()::text)
      AND UPPER(department) = 'POLICE'
  );
$$;

-- 4. ATOMIC CASE JURISDICTION CLAIM RPC
-- Enforces Station Claim Rule:
-- - An officer can ONLY claim an unassigned case for their own assigned jurisdiction.
-- - Prevents concurrent claim races via atomic WHERE jurisdiction IS NULL check.
CREATE OR REPLACE FUNCTION public.assign_case_jurisdiction(
  target_case_id uuid,
  target_jurisdiction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_jur text;
  rows_affected int;
  updated_case record;
BEGIN
  -- Verify caller is a verified police officer
  IF NOT public.is_police_authority() THEN
    RAISE EXCEPTION 'Access denied: Only authorized police officers can claim case jurisdiction.'
      USING ERRCODE = '42501';
  END IF;

  caller_jur := public.current_authority_jurisdiction();

  -- Enforce Station Claim Rule: officer can only claim for their own station
  IF caller_jur IS NOT NULL AND LOWER(caller_jur) <> LOWER(target_jurisdiction) THEN
    RAISE EXCEPTION 'Station Mismatch: An officer assigned to % cannot assign cases to %.', caller_jur, target_jurisdiction
      USING ERRCODE = '28000';
  END IF;

  -- Atomic update: only update if jurisdiction is currently NULL (unassigned)
  UPDATE public.missing_persons
  SET jurisdiction = target_jurisdiction
  WHERE id = target_case_id 
    AND jurisdiction IS NULL
  RETURNING id, case_code, full_name, jurisdiction, status INTO updated_case;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Conflict: Case % has already been claimed or does not exist.', target_case_id
      USING ERRCODE = '23505';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Case successfully claimed for %s station', target_jurisdiction),
    'case', to_jsonb(updated_case)
  );
END;
$$;

-- 5. RPC TO RETRIEVE UNASSIGNED CASES FOR POLICE STATION REVIEW
CREATE OR REPLACE FUNCTION public.get_unassigned_cases_for_review()
RETURNS TABLE (
  id uuid,
  case_code text,
  full_name text,
  age integer,
  gender text,
  last_seen_date timestamptz,
  latitude double precision,
  longitude double precision,
  description text,
  status text,
  jurisdiction text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_police_authority() THEN
    RAISE EXCEPTION 'Access denied: Only authorized police officers can review unassigned cases.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    mp.id,
    mp.case_code,
    mp.full_name,
    mp.age,
    mp.gender,
    mp.last_seen_date,
    mp.latitude,
    mp.longitude,
    mp.description,
    mp.status,
    mp.jurisdiction,
    mp.created_at
  FROM public.missing_persons mp
  WHERE mp.jurisdiction IS NULL
  ORDER BY mp.created_at DESC;
END;
$$;

-- 6. HARDENED CROSS-JURISDICTION CANDIDATE CASE DOSSIER RPC
-- Allows viewing read-only case details when a case appears in an AI sighting match,
-- without granting general SELECT access to all cases across the database.
CREATE OR REPLACE FUNCTION public.get_candidate_case_dossier(target_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_valid_candidate boolean := false;
  case_row record;
  photos_arr jsonb;
BEGIN
  -- 1. Authorization check: Caller must be a verified police officer
  IF NOT public.is_police_authority() THEN
    RAISE EXCEPTION 'Access denied: Caller is not a verified police officer.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Verify person is a candidate in at least one sighting using safe text comparison
  SELECT EXISTS (
    SELECT 1 
    FROM public.missing_person_sightings s
    WHERE s.missing_person_id = target_person_id
       OR (
         s.ai_matches IS NOT NULL 
         AND jsonb_typeof(s.ai_matches) = 'array'
         AND EXISTS (
           SELECT 1 
           FROM jsonb_array_elements(s.ai_matches) match
           WHERE (match->>'missing_person_id') = target_person_id::text
         )
       )
  ) INTO is_valid_candidate;

  IF NOT is_valid_candidate THEN
    RAISE EXCEPTION 'Access restricted: Requested person dossier is not linked to any active sighting candidate.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Retrieve case record (read-only)
  SELECT id, case_code, full_name, age, gender, last_seen_date, latitude, longitude, description, status, jurisdiction, created_at
  INTO case_row
  FROM public.missing_persons
  WHERE id = target_person_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 4. Retrieve reference photos
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'embedding_id', e.id,
      'image_path', e.image_path,
      'det_score', e.det_score,
      'created_at', e.created_at
    ) ORDER BY e.created_at ASC
  ), '[]'::jsonb)
  INTO photos_arr
  FROM public.missing_person_embeddings e
  WHERE e.missing_person_id = target_person_id;

  RETURN jsonb_build_object(
    'id', case_row.id,
    'case_code', case_row.case_code,
    'full_name', case_row.full_name,
    'age', case_row.age,
    'gender', case_row.gender,
    'last_seen_date', case_row.last_seen_date,
    'latitude', case_row.latitude,
    'longitude', case_row.longitude,
    'description', case_row.description,
    'status', case_row.status,
    'jurisdiction', case_row.jurisdiction,
    'created_at', case_row.created_at,
    'photos', photos_arr,
    'is_cross_jurisdiction_read_only', true
  );
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES FOR MISSING_PERSONS
ALTER TABLE public.missing_persons ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies on missing_persons if any
DROP POLICY IF EXISTS "police_select_station_and_unassigned" ON public.missing_persons;
DROP POLICY IF EXISTS "police_insert_station_cases" ON public.missing_persons;
DROP POLICY IF EXISTS "police_update_station_cases" ON public.missing_persons;
DROP POLICY IF EXISTS "police_delete_station_cases" ON public.missing_persons;

-- A) SELECT Policy:
-- - Station officer can see cases assigned to their station
-- - Officers can see unassigned cases for review
-- - Anonymous users have zero access (no auth bypass)
CREATE POLICY "police_select_station_and_unassigned"
ON public.missing_persons
FOR SELECT
TO authenticated
USING (
  public.is_police_authority()
  AND (
    jurisdiction IS NULL
    OR jurisdiction = public.current_authority_jurisdiction()
  )
);

-- B) INSERT Policy:
-- - Officers can insert cases for their station or unassigned
CREATE POLICY "police_insert_station_cases"
ON public.missing_persons
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_police_authority()
  AND (
    jurisdiction IS NULL
    OR jurisdiction = public.current_authority_jurisdiction()
  )
);

-- C) UPDATE Policy:
-- - Station officers can update their own station's cases (or claim unassigned cases)
CREATE POLICY "police_update_station_cases"
ON public.missing_persons
FOR UPDATE
TO authenticated
USING (
  public.is_police_authority()
  AND (
    jurisdiction = public.current_authority_jurisdiction()
    OR jurisdiction IS NULL
  )
)
WITH CHECK (
  public.is_police_authority()
  AND jurisdiction = public.current_authority_jurisdiction()
);

-- D) DELETE Policy:
-- - Station officers can delete their own station's cases
CREATE POLICY "police_delete_station_cases"
ON public.missing_persons
FOR DELETE
TO authenticated
USING (
  public.is_police_authority()
  AND jurisdiction = public.current_authority_jurisdiction()
);

-- 8. STORAGE POLICIES FOR MISSING-PERSON-IMAGES BUCKET
-- Ensure citizens can upload and view sighting images,
-- while reference photos under missing_people/ are restricted to authorized police.

DROP POLICY IF EXISTS "Allow public read of sighting images" ON storage.objects;
DROP POLICY IF EXISTS "Allow citizen upload to sightings" ON storage.objects;
DROP POLICY IF EXISTS "Allow police manage reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow police read reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow police insert reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow police delete reference photos" ON storage.objects;

-- Sighting uploads by citizens (no auth barrier required for citizen reports)
CREATE POLICY "Allow citizen upload to sightings"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'missing-person-images' 
  AND (storage.foldername(name))[1] = 'sightings'
);

-- Sighting images read access: Public and police can view citizen sightings
CREATE POLICY "Allow public read of sighting images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'missing-person-images'
  AND (storage.foldername(name))[1] = 'sightings'
);

-- Reference photos read access:
-- Restricted to authorized police officers for:
-- 1) Their station's cases or unassigned cases
-- 2) Active cross-jurisdiction sighting candidates
CREATE POLICY "Allow police read reference photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'missing-person-images'
  AND (storage.foldername(name))[1] = 'missing_people'
  AND public.is_police_authority()
  AND EXISTS (
    SELECT 1 
    FROM public.missing_persons mp
    WHERE mp.case_code = (storage.foldername(name))[2]
      AND (
        mp.jurisdiction IS NULL
        OR mp.jurisdiction = public.current_authority_jurisdiction()
        OR EXISTS (
          SELECT 1 
          FROM public.missing_person_sightings s
          WHERE s.missing_person_id = mp.id
             OR (
               s.ai_matches IS NOT NULL 
               AND jsonb_typeof(s.ai_matches) = 'array'
               AND EXISTS (
                 SELECT 1 
                 FROM jsonb_array_elements(s.ai_matches) match
                 WHERE (match->>'missing_person_id') = mp.id::text
               )
             )
        )
      )
  )
);

-- Reference photos upload access:
-- Restricted to station police officers for their own station's cases (or unassigned)
CREATE POLICY "Allow police insert reference photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'missing-person-images'
  AND (storage.foldername(name))[1] = 'missing_people'
  AND public.is_police_authority()
  AND EXISTS (
    SELECT 1 
    FROM public.missing_persons mp
    WHERE mp.case_code = (storage.foldername(name))[2]
      AND (
        mp.jurisdiction IS NULL
        OR mp.jurisdiction = public.current_authority_jurisdiction()
      )
  )
);

-- Reference photos delete access:
-- Restricted to station police officers for their own station's cases
CREATE POLICY "Allow police delete reference photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'missing-person-images'
  AND (storage.foldername(name))[1] = 'missing_people'
  AND public.is_police_authority()
  AND EXISTS (
    SELECT 1 
    FROM public.missing_persons mp
    WHERE mp.case_code = (storage.foldername(name))[2]
      AND (
        mp.jurisdiction IS NULL
        OR mp.jurisdiction = public.current_authority_jurisdiction()
      )
  )
);

