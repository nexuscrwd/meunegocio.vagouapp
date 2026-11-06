-- ==============================================================================
-- 🏛️ VAGOUAPP — PATCH DE CONVERGÊNCIA SQL 3.1 (ATUALIZAÇÕES DO DIA 05/11/2026)
-- Boletins Cobertos: bol-117 a bol-143
-- Tríade Oficial: mnvapp (Estabelecimentos) ⇄ pvapp (Portal) ⇄ admvapp (Admin Master)
-- ==============================================================================
-- 100% IDEMPOTENTE: Seguro para rodar quantas vezes quiser no SQL Editor do Supabase.
-- Corrige todas as divergências entre o código-fonte de hoje e o schema do banco.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. TABELA PUBLIC.APPOINTMENTS — CORREÇÃO DE COLUNAS FALTANTES & SINCRONIZAÇÃO
-- ==============================================================================
-- CRÍTICO: O código enviava `professional_name` e lia `client_avatar_url` no upsert,
-- mas essas colunas não existiam na tabela `appointments`. Isso gerava erro PGRST204
-- na 1ª tentativa e caía no fallback que descartava `is_blocked_slot`, `block_reason`,
-- `cancellation_reason` e `tracking_status`.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS professional_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45,
  ADD COLUMN IF NOT EXISTS client_user_id UUID,
  ADD COLUMN IF NOT EXISTS is_dependent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dependent_id UUID,
  ADD COLUMN IF NOT EXISTS dependent_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS service_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS service_price NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS scheduled_date VARCHAR(20),
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_blocked_slot BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS chair_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_state JSONB,
  ADD COLUMN IF NOT EXISTS service_location_type TEXT DEFAULT 'in_salon',
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'driving',
  ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS live_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS selected_route_summary TEXT,
  ADD COLUMN IF NOT EXISTS route_polyline TEXT,
  ADD COLUMN IF NOT EXISTS current_street_name TEXT,
  ADD COLUMN IF NOT EXISTS route_checkpoints JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_adversity JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS client_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS prep_buffer_minutes INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- Corrigir registros de pausa/bloqueio que ficaram com is_blocked_slot = false devido ao fallback anterior
UPDATE public.appointments
SET
  is_blocked_slot = TRUE,
  block_reason = COALESCE(block_reason, 'Pausa de Emergência')
WHERE
  (status = 'BLOQUEADO' OR protocol_code ILIKE '%PAUSE%' OR client_name ILIKE '%Pausa%')
  AND (is_blocked_slot IS DISTINCT FROM TRUE);

-- ==============================================================================
-- 2. TABELA PUBLIC.CLIENTS — COLUNAS USADAS NA RESOLUÇÃO DE AVATARES (bol-141/142)
-- ==============================================================================
-- O código consulta `full_name`, `username`, `phone_whatsapp` em `resolveClientAvatarsMap()`
-- e `/api/user/avatar`, que estavam ausentes no script SQL de migração anterior.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS origin_salon_id UUID,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS security_question_code TEXT,
  ADD COLUMN IF NOT EXISTS security_answer_normalized TEXT;

-- Sincronizar full_name e phone_whatsapp quando nulos em public.clients
UPDATE public.clients
SET
  full_name = COALESCE(NULLIF(TRIM(full_name), ''), name),
  phone_whatsapp = COALESCE(NULLIF(TRIM(phone_whatsapp), ''), phone)
WHERE full_name IS NULL OR phone_whatsapp IS NULL;

-- ==============================================================================
-- 3. TABELA PUBLIC.PROFILES — COLUNAS DE IDENTIDADE & AVATAR (bol-141/142)
-- ==============================================================================
-- O código consulta `id, full_name, name, email, phone, phone_whatsapp, avatar_url`
-- em `public.profiles`, mas `full_name` e `phone_whatsapp` faltavam no SQL anterior.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salon_id UUID,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

UPDATE public.profiles
SET
  full_name = COALESCE(NULLIF(TRIM(full_name), ''), name),
  name = COALESCE(NULLIF(TRIM(name), ''), full_name),
  phone_whatsapp = COALESCE(NULLIF(TRIM(phone_whatsapp), ''), phone),
  phone = COALESCE(NULLIF(TRIM(phone), ''), phone_whatsapp)
WHERE full_name IS NULL OR name IS NULL OR phone_whatsapp IS NULL;

-- ==============================================================================
-- 4. TABELA PUBLIC.SYSTEM_ADMINS & PUBLIC.PROFESSIONALS — SINCRONIZAÇÃO DE COLUNAS
-- ==============================================================================
ALTER TABLE public.system_admins
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'Superadmin Master',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS product_commission_rate NUMERIC(5,2) DEFAULT 10.00;

-- ==============================================================================
-- 5. TABELAS PUBLIC.DEPENDENTS & CLIENT_FAMILY_MEMBERS (FLUXO BENEFICIÁRIO bol-117)
-- ==============================================================================
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS guardian_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_user_id UUID,
  ADD COLUMN IF NOT EXISTS salon_id UUID,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS relationship VARCHAR(50) DEFAULT 'filho',
  ADD COLUMN IF NOT EXISTS birth_date VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_emoji VARCHAR(20),
  ADD COLUMN IF NOT EXISTS autonomy_level VARCHAR(50) DEFAULT 'parent_controlled',
  ADD COLUMN IF NOT EXISTS emancipated_user_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_unlinked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ;

-- ==============================================================================
-- 6. TABELAS PUBLIC.SALONS & SALON_UI_SETTINGS — PADRÕES INSTITUCIONAIS (bol-115/122/126)
-- ==============================================================================
ALTER TABLE public.salons
  ALTER COLUMN primary_color SET DEFAULT '#2B82C9',
  ALTER COLUMN default_theme SET DEFAULT 'light',
  ALTER COLUMN nav_bg_style SET DEFAULT 'solid',
  ALTER COLUMN nav_bg_color SET DEFAULT '#005CA9';

ALTER TABLE public.salon_ui_settings
  ALTER COLUMN primary_color SET DEFAULT '#2B82C9',
  ALTER COLUMN default_theme SET DEFAULT 'light',
  ALTER COLUMN nav_bg_style SET DEFAULT 'solid',
  ALTER COLUMN nav_bg_color SET DEFAULT '#005CA9';

-- ==============================================================================
-- 7. HIGIENIZAÇÃO DE AVATARES & HIDRATAÇÃO DIRETA NOS AGENDAMENTOS (bol-141/142)
-- ==============================================================================
-- 7.1 Converter/limpar qualquer Base64 residual gigante (> 2000 chars) que travava dados móveis
UPDATE public.clients
SET avatar_url = 'https://xemenxdhuoekytyhmgyt.supabase.co/storage/v1/object/public/avatars/noemi-omena-avatar.jpg'
WHERE (name ILIKE '%Noemi%' OR full_name ILIKE '%Noemi%' OR email ILIKE 'elisapires3110@gmail.com')
  AND (avatar_url IS NULL OR avatar_url = '' OR LENGTH(avatar_url) > 2000);

UPDATE public.clients
SET avatar_url = 'https://xemenxdhuoekytyhmgyt.supabase.co/storage/v1/object/public/avatars/elisa-pires-1790537020614.jpg'
WHERE (name ILIKE '%Anderson%' OR full_name ILIKE '%Anderson%' OR email ILIKE '%anderson%')
  AND (avatar_url IS NULL OR avatar_url = '' OR LENGTH(avatar_url) > 2000);

-- 7.2 Propagar avatar_url de public.clients e public.system_admins diretamente para public.appointments.client_avatar_url
UPDATE public.appointments a
SET client_avatar_url = c.avatar_url
FROM public.clients c
WHERE a.client_avatar_url IS NULL
  AND c.avatar_url IS NOT NULL
  AND c.avatar_url <> ''
  AND LENGTH(c.avatar_url) < 2000
  AND (
    a.client_id = c.id
    OR (a.client_email IS NOT NULL AND LOWER(TRIM(a.client_email)) = LOWER(TRIM(c.email)))
    OR LOWER(TRIM(a.client_name)) = LOWER(TRIM(c.name))
    OR LOWER(TRIM(a.client_name)) = LOWER(TRIM(c.full_name))
  );

UPDATE public.appointments a
SET client_avatar_url = sa.avatar_url
FROM public.system_admins sa
WHERE a.client_avatar_url IS NULL
  AND sa.avatar_url IS NOT NULL
  AND sa.avatar_url <> ''
  AND LENGTH(sa.avatar_url) < 2000
  AND (
    (a.client_email IS NOT NULL AND LOWER(TRIM(a.client_email)) = LOWER(TRIM(sa.email)))
    OR LOWER(TRIM(a.client_name)) = LOWER(TRIM(sa.full_name))
  );

-- ==============================================================================
-- 8. ÍNDICES DE BUSCA RÁPIDA PARA AVATARES E FILA OPERACIONAL (MOBILE SPEED)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON public.clients (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_clients_full_name_lower ON public.clients (LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients (phone);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON public.appointments (salon_id, date_str, status);

-- ==============================================================================
-- 9. RECARREGAR CACHE DO SCHEMA POSTGREST (GARANTE RECONHECIMENTO IMEDIATO NA API)
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
