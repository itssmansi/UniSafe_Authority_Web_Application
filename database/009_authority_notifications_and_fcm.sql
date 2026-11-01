-- ====================================================================
-- UniSafe: Authority Notification System & FCM Device Tokens Migration
-- File: database/009_authority_notifications_and_fcm.sql
-- ====================================================================

-- 1. ENHANCE NOTIFICATIONS TABLE
-- Add columns to support rich role-scoped notifications, deep-linking, and audit metadata.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS notification_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indices for fast lookup by authority, department, and unread state
CREATE INDEX IF NOT EXISTS idx_notifications_authority_id
  ON public.notifications (authority_id);

CREATE INDEX IF NOT EXISTS idx_notifications_dept_read
  ON public.notifications (department, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON public.notifications (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);

-- 2. CREATE AUTHORITY DEVICE TOKENS TABLE FOR FCM WEB PUSH
CREATE TABLE IF NOT EXISTS public.authority_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id UUID NOT NULL REFERENCES public.authorities(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    platform TEXT DEFAULT 'web',
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authority_device_tokens_auth_id
  ON public.authority_device_tokens (authority_id);

CREATE INDEX IF NOT EXISTS idx_authority_device_tokens_token
  ON public.authority_device_tokens (fcm_token);

-- 3. ROW LEVEL SECURITY (RLS) FOR NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorities can view own notifications" ON public.notifications;
CREATE POLICY "Authorities can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  authority_id IN (
    SELECT id FROM public.authorities
    WHERE auth_user_id = auth.uid() OR id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Authorities can update own notifications" ON public.notifications;
CREATE POLICY "Authorities can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  authority_id IN (
    SELECT id FROM public.authorities
    WHERE auth_user_id = auth.uid() OR id::text = auth.uid()::text
  )
)
WITH CHECK (
  authority_id IN (
    SELECT id FROM public.authorities
    WHERE auth_user_id = auth.uid() OR id::text = auth.uid()::text
  )
);

-- Service role and authenticated system functions can insert notifications
DROP POLICY IF EXISTS "Allow notification creation" ON public.notifications;
CREATE POLICY "Allow notification creation"
ON public.notifications
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

-- 4. ROW LEVEL SECURITY FOR AUTHORITY DEVICE TOKENS
ALTER TABLE public.authority_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorities can manage own device tokens" ON public.authority_device_tokens;
CREATE POLICY "Authorities can manage own device tokens"
ON public.authority_device_tokens
FOR ALL
TO authenticated
USING (
  authority_id IN (
    SELECT id FROM public.authorities
    WHERE auth_user_id = auth.uid() OR id::text = auth.uid()::text
  )
)
WITH CHECK (
  authority_id IN (
    SELECT id FROM public.authorities
    WHERE auth_user_id = auth.uid() OR id::text = auth.uid()::text
  )
);

-- 5. RPC FUNCTION: ATOMIC NOTIFICATION CREATION
CREATE OR REPLACE FUNCTION public.create_authority_notification(
  p_authority_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_department TEXT,
  p_notification_type TEXT,
  p_reference_id TEXT,
  p_reference_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  -- Prevent exact duplicate notification within 1 minute
  SELECT id INTO v_notif_id
  FROM public.notifications
  WHERE authority_id = p_authority_id
    AND notification_type = p_notification_type
    AND reference_id = p_reference_id
    AND created_at > (NOW() - INTERVAL '1 minute')
  LIMIT 1;

  IF v_notif_id IS NOT NULL THEN
    RETURN v_notif_id;
  END IF;

  INSERT INTO public.notifications (
    authority_id,
    title,
    body,
    department,
    notification_type,
    reference_id,
    reference_type,
    metadata,
    is_read,
    created_at
  ) VALUES (
    p_authority_id,
    p_title,
    p_body,
    UPPER(p_department),
    p_notification_type,
    p_reference_id,
    p_reference_type,
    p_metadata,
    false,
    NOW()
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_authority_notification TO authenticated, anon, service_role;

-- 6. TRIGGER: NOTIFY BMC AUTHORITY ON NEW ASSIGNED CIVIC COMPLAINT
CREATE OR REPLACE FUNCTION public.fn_trg_notify_new_civic_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trigger only for BMC complaints that are assigned to an authority
  IF (UPPER(NEW.department) = 'BMC' OR NEW.department ILIKE '%municipal%') 
     AND NEW.assigned_authority_id IS NOT NULL THEN
    
    PERFORM public.create_authority_notification(
      NEW.assigned_authority_id,
      'New Civic Complaint Received',
      format('A new %s complaint has been submitted near %s. Please review and assign the complaint.',
             COALESCE(NEW.category, 'civic issue'),
             COALESCE(NULLIF(NEW.address, ''), 'Ward ' || COALESCE(NEW.jurisdiction, 'your ward'))),
      'BMC',
      'NEW_COMPLAINT',
      NEW.id::text,
      'complaint',
      jsonb_build_object(
        'complaint_id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'description', NEW.description,
        'location', NEW.address,
        'ward', NEW.jurisdiction,
        'created_at', NEW.created_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_civic_complaint ON public.complaints;
CREATE TRIGGER trg_notify_new_civic_complaint
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_notify_new_civic_complaint();

-- 7. TRIGGER: NOTIFY BMC AUTHORITY ON WORK COMPLETION DISPUTE
CREATE OR REPLACE FUNCTION public.fn_trg_notify_verification_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When complaint is flagged as disputed, verification failed, or rejected
  IF (NEW.status IN ('disputed', 'verification_failed', 'rejected', 'unresolved')
      AND OLD.status <> NEW.status
      AND NEW.assigned_authority_id IS NOT NULL) THEN

    PERFORM public.create_authority_notification(
      NEW.assigned_authority_id,
      'Completion Verification Failed',
      format('The citizen has reported that complaint #%s is still unresolved. Please review the work completion status.',
             SUBSTRING(NEW.id::text, 1, 8)),
      'BMC',
      'VERIFICATION_DISPUTED',
      NEW.id::text,
      'complaint',
      jsonb_build_object(
        'complaint_id', NEW.id,
        'category', NEW.category,
        'location', NEW.address,
        'citizen_response', 'unresolved',
        'status', NEW.status,
        'verified_at', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_verification_dispute ON public.complaints;
CREATE TRIGGER trg_notify_verification_dispute
AFTER UPDATE OF status ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_notify_verification_dispute();

-- 8. TRIGGER: NOTIFY POLICE AUTHORITY ON NEW SIGHTING REPORT
CREATE OR REPLACE FUNCTION public.fn_trg_notify_new_sighting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mp RECORD;
  v_police RECORD;
  v_count INT := 0;
BEGIN
  -- Retrieve linked missing person details and jurisdiction
  SELECT id, full_name, case_code, jurisdiction
  INTO v_mp
  FROM public.missing_persons
  WHERE id = NEW.missing_person_id;

  -- Notify police officers assigned to the case jurisdiction
  IF v_mp.jurisdiction IS NOT NULL THEN
    FOR v_police IN
      SELECT id
      FROM public.authorities
      WHERE UPPER(department) = 'POLICE'
        AND LOWER(jurisdiction) = LOWER(v_mp.jurisdiction)
    LOOP
      PERFORM public.create_authority_notification(
        v_police.id,
        'New Missing Person Sighting',
        format('A citizen believes they may have spotted %s near %s. Please review the sighting and submitted details.',
               COALESCE(v_mp.full_name, 'a missing person'),
               COALESCE(NULLIF(NEW.location_name, ''), 'reported area')),
        'POLICE',
        'NEW_SIGHTING',
        NEW.id::text,
        'sighting',
        jsonb_build_object(
          'sighting_id', NEW.id,
          'missing_person_id', v_mp.id,
          'case_code', v_mp.case_code,
          'full_name', v_mp.full_name,
          'location', NEW.location_name,
          'jurisdiction', v_mp.jurisdiction,
          'sighting_date', NEW.sighting_date,
          'description', NEW.description
        )
      );
      v_count := v_count + 1;
    END LOOP;
  END IF;

  -- Fallback: If no station-specific police officer matched, notify any police authority
  IF v_count = 0 THEN
    FOR v_police IN
      SELECT id
      FROM public.authorities
      WHERE UPPER(department) = 'POLICE'
      LIMIT 2
    LOOP
      PERFORM public.create_authority_notification(
        v_police.id,
        'New Missing Person Sighting',
        format('A citizen believes they may have spotted %s near %s. Please review the sighting and submitted details.',
               COALESCE(v_mp.full_name, 'a missing person'),
               COALESCE(NULLIF(NEW.location_name, ''), 'reported area')),
        'POLICE',
        'NEW_SIGHTING',
        NEW.id::text,
        'sighting',
        jsonb_build_object(
          'sighting_id', NEW.id,
          'missing_person_id', v_mp.id,
          'case_code', v_mp.case_code,
          'full_name', v_mp.full_name,
          'location', NEW.location_name,
          'jurisdiction', v_mp.jurisdiction,
          'sighting_date', NEW.sighting_date,
          'description', NEW.description
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort citizen sighting submission if notification fails
  RAISE WARNING 'fn_trg_notify_new_sighting failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_sighting ON public.missing_person_sightings;
CREATE TRIGGER trg_notify_new_sighting
AFTER INSERT ON public.missing_person_sightings
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_notify_new_sighting();
