-- ==============================================================================
-- 🏛️ VAGOUAPP — SCRIPT MESTRE CONSOLIDADO DE CONVERGÊNCIA TOTAL (SUPABASE SQL v4.0)
-- Data: 07/11/2026 — Cobertura Completa: bol-001 até bol-153
-- Tríade Oficial: mnvapp (Estabelecimentos) ⇄ pvapp (Portal) ⇄ admvapp (Admin Master)
-- ==============================================================================
-- 100% IDEMPOTENTE: Seguro para colar e rodar inteiro no SQL Editor do Supabase.
-- Inclui TODAS as edições anteriores + Logos, Avatares, Pagamento (Pago/À pagar),
-- Permuta em Cascata (A ➔ B ➔ C), Ordenação Cronológica e Trava Anti-Colisão
-- Geotemporal Entre Salões (Salão A ➔ Salão B e B ➔ A).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSÕES POSTGRESQL ESSENCIAIS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA: PUBLIC.SALONS (ESTABELECIMENTOS / PARCEIROS & VITRINES WHITE-LABEL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    trade_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL DEFAULT '',
    slug VARCHAR(100) UNIQUE NOT NULL,
    document_type VARCHAR(20) DEFAULT 'CNPJ',
    document_number VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    phone_landline VARCHAR(30),
    email VARCHAR(255),
    subdomain VARCHAR(100),
    operating_model VARCHAR(50) DEFAULT 'team',
    home_delivery_enabled BOOLEAN DEFAULT FALSE,
    home_delivery_area TEXT,
    home_delivery_travel_fee NUMERIC(10,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    commission_rate NUMERIC(5,2) DEFAULT 15.00,

    -- Localização, Endereço Completo & GIS
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100) DEFAULT 'São Paulo',
    state VARCHAR(10) DEFAULT 'SP',
    cep VARCHAR(20),
    latitude DOUBLE PRECISION DEFAULT -23.5350,
    longitude DOUBLE PRECISION DEFAULT -46.4520,
    formatted_address TEXT,
    google_place_id TEXT,

    -- Identidade Visual, Branding & Theming Dinâmico
    status VARCHAR(30) DEFAULT 'active',
    favicon_url TEXT,
    slogan VARCHAR(120),
    brand_font VARCHAR(60) DEFAULT 'Poppins',
    pix_key VARCHAR(100),
    pix_keys JSONB DEFAULT '[]'::jsonb,
    owner_cpf VARCHAR(20),
    category VARCHAR(100) DEFAULT 'barbearia',
    operating_hours JSONB,
    opening_hours_text TEXT,
    logo_url TEXT,
    logo_light_url TEXT,
    logo_dark_url TEXT,
    cover_url TEXT,
    cover_image_url TEXT,
    theme_preset_id TEXT DEFAULT 'emerald-dark',
    facade_photo_url TEXT,
    interior_photo_url TEXT,
    branding JSONB DEFAULT '{"primaryColor": "#20C933", "secondaryColor": "#0F172A", "themeMode": "dark"}'::jsonb,
    primary_color VARCHAR(20) DEFAULT '#2B82C9',
    secondary_color VARCHAR(20) DEFAULT '#0F172A',
    default_theme VARCHAR(20) DEFAULT 'light',
    pwa_name VARCHAR(150),
    show_slogan BOOLEAN DEFAULT TRUE,
    logo_text_fallback VARCHAR(100),
    logo_text_color VARCHAR(20),
    show_hero_slides BOOLEAN DEFAULT TRUE,
    welcome_style VARCHAR(50) DEFAULT 'atmospheric',

    -- Barra de Títulos das Seções (Section Header)
    section_header_bg_color VARCHAR(30),
    section_header_text_color VARCHAR(30),
    section_header_icon_color VARCHAR(30),
    section_header_bg_style VARCHAR(30) DEFAULT 'glass',
    section_header_border VARCHAR(30) DEFAULT 'bordered',
    section_header_btn_bg_color VARCHAR(30),
    section_header_btn_active_bg_color VARCHAR(30),
    section_header_btn_border VARCHAR(30),
    section_header_btn_shadow VARCHAR(30),
    section_header_btn_blur VARCHAR(30),
    section_header_btn_font VARCHAR(60),

    -- Barra de Navegação Inferior (BottomNav)
    nav_style VARCHAR(30) DEFAULT 'minimal',
    nav_shape VARCHAR(30) DEFAULT 'square',
    nav_border VARCHAR(30) DEFAULT 'bordered',
    nav_bg_style VARCHAR(30) DEFAULT 'solid',
    nav_bg_color VARCHAR(30) DEFAULT '#005CA9',
    nav_btn_bg_color VARCHAR(30),
    nav_btn_active_bg_color VARCHAR(30),
    nav_active_color VARCHAR(30),
    nav_text_color VARCHAR(30),
    nav_btn_shadow VARCHAR(30),
    nav_btn_blur VARCHAR(30),
    nav_btn_font VARCHAR(60),

    -- Espaço Físico, Comodidades, Políticas e Redes
    space_photos JSONB DEFAULT '[]'::jsonb,
    space_description TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    holidays JSONB DEFAULT '[]'::jsonb,
    cancellation_policy JSONB,
    website_url TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    maps_url TEXT,
    bio TEXT,

    -- Avaliações & Métricas
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    rating_count INTEGER DEFAULT 1,
    media_slots_count INTEGER DEFAULT 1,

    -- Modelo de Cobrança / Faturamento
    billing_plan VARCHAR(50) DEFAULT 'PER_APPOINTMENT',
    billing_fee_type VARCHAR(50) DEFAULT 'FIXED',
    billing_fee_value NUMERIC(10,2) DEFAULT 1.50,
    pin_code VARCHAR(30),
    moderation_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'São Paulo',
  ADD COLUMN IF NOT EXISTS state VARCHAR(10) DEFAULT 'SP',
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT -23.5350,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT -46.4520,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pix_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pix_keys JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phone_landline VARCHAR(30),
  ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100),
  ADD COLUMN IF NOT EXISTS opening_hours_text TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_light_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_dark_url TEXT,
  ADD COLUMN IF NOT EXISTS facade_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS interior_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS theme_preset_id TEXT DEFAULT 'emerald-dark',
  ADD COLUMN IF NOT EXISTS space_photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS space_description TEXT,
  ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS section_header_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_text_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_icon_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_bg_style VARCHAR(30) DEFAULT 'glass',
  ADD COLUMN IF NOT EXISTS section_header_border VARCHAR(30) DEFAULT 'bordered',
  ADD COLUMN IF NOT EXISTS section_header_btn_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_btn_active_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_btn_border VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_btn_shadow VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_btn_blur VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_btn_font VARCHAR(60),
  ADD COLUMN IF NOT EXISTS nav_style VARCHAR(30) DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS nav_shape VARCHAR(30) DEFAULT 'square',
  ADD COLUMN IF NOT EXISTS nav_border VARCHAR(30) DEFAULT 'bordered',
  ADD COLUMN IF NOT EXISTS nav_bg_style VARCHAR(30) DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS nav_bg_color VARCHAR(30) DEFAULT '#005CA9',
  ADD COLUMN IF NOT EXISTS nav_btn_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_active_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_active_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_text_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_shadow VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_blur VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_font VARCHAR(60),
  ADD COLUMN IF NOT EXISTS default_theme VARCHAR(20) DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS pwa_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS show_slogan BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS logo_text_fallback VARCHAR(100),
  ADD COLUMN IF NOT EXISTS logo_text_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS show_hero_slides BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS welcome_style VARCHAR(50) DEFAULT 'atmospheric',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(30);

-- ==============================================================================
-- 3. TABELA: PUBLIC.SALON_UI_SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salon_ui_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
    default_theme VARCHAR(20) DEFAULT 'light',
    primary_color VARCHAR(20) DEFAULT '#2B82C9',
    secondary_color VARCHAR(20) DEFAULT '#0F172A',
    brand_font VARCHAR(60) DEFAULT 'Poppins',
    pwa_name VARCHAR(150),
    slogan VARCHAR(120),
    show_slogan BOOLEAN DEFAULT TRUE,
    logo_text_fallback VARCHAR(100),
    logo_text_color VARCHAR(20),
    show_hero_slides BOOLEAN DEFAULT TRUE,
    welcome_style VARCHAR(50) DEFAULT 'atmospheric',
    section_header_bg_color VARCHAR(30),
    section_header_text_color VARCHAR(30),
    section_header_icon_color VARCHAR(30),
    section_header_bg_style VARCHAR(30) DEFAULT 'glass',
    section_header_border VARCHAR(30) DEFAULT 'bordered',
    section_header_btn_bg_color VARCHAR(30),
    section_header_btn_active_bg_color VARCHAR(30),
    section_header_btn_border VARCHAR(30),
    section_header_btn_shadow VARCHAR(30),
    section_header_btn_blur VARCHAR(30),
    section_header_btn_font VARCHAR(60),
    nav_style VARCHAR(30) DEFAULT 'minimal',
    nav_shape VARCHAR(30) DEFAULT 'square',
    nav_border VARCHAR(30) DEFAULT 'bordered',
    nav_bg_style VARCHAR(30) DEFAULT 'solid',
    nav_bg_color VARCHAR(30) DEFAULT '#005CA9',
    nav_btn_bg_color VARCHAR(30),
    nav_btn_active_bg_color VARCHAR(30),
    nav_active_color VARCHAR(30),
    nav_text_color VARCHAR(30),
    nav_btn_shadow VARCHAR(30),
    nav_btn_blur VARCHAR(30),
    nav_btn_font VARCHAR(60),
    branding_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABELAS DE EQUIPE, ADMINS E PROFISSIONAIS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salon_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salon_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.salon_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id UUID,
    username VARCHAR(100),
    email VARCHAR(255),
    password_hash TEXT,
    cpf VARCHAR(20),
    name VARCHAR(255),
    phone VARCHAR(30),
    role VARCHAR(50) DEFAULT 'manager',
    access_level VARCHAR(50) DEFAULT 'manager',
    is_active BOOLEAN DEFAULT TRUE,
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(10),
    cep VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    google_place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    cpf VARCHAR(20) UNIQUE,
    phone_whatsapp VARCHAR(30),
    phone_secondary VARCHAR(30),
    name VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'superadmin',
    access_level VARCHAR(50) DEFAULT 'Superadmin Master',
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    username VARCHAR(100),
    role VARCHAR(150) DEFAULT 'Profissional',
    access_level VARCHAR(50) DEFAULT 'professional',
    avatar_url TEXT,
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    phone_secondary VARCHAR(30),
    email VARCHAR(255),
    cpf VARCHAR(20),
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(10),
    cep VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    google_place_id TEXT,
    specialties TEXT[] DEFAULT ARRAY['cabelo']::TEXT[],
    color_hex VARCHAR(20) DEFAULT '#10B981',
    slot_minutes INTEGER DEFAULT 45,
    commission_rate NUMERIC(5,2) DEFAULT 50.00,
    product_commission_rate NUMERIC(5,2) DEFAULT 10.00,
    contract_type VARCHAR(50),
    status VARCHAR(30) DEFAULT 'active',
    dependents_count INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    use_custom_schedule BOOLEAN DEFAULT FALSE,
    schedule_config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  ADD COLUMN IF NOT EXISTS product_commission_rate NUMERIC(5,2) DEFAULT 10.00,
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

-- ==============================================================================
-- 5. TABELAS DE SERVIÇOS E VAGAS RELÂMPAGO (RADAR)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    category VARCHAR(50) DEFAULT 'cabelo',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    duration_minutes INTEGER DEFAULT 45,
    commission_rate NUMERIC(5,2) DEFAULT 50.00,
    description TEXT,
    image_url TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    slides JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.salon_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    category VARCHAR(50) DEFAULT 'Geral',
    price NUMERIC(10,2) DEFAULT 0.00,
    duration_minutes INTEGER DEFAULT 30,
    commission_rate NUMERIC(5,2) DEFAULT 50.00,
    description TEXT,
    image_url TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    slides JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_title VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'cabelo',
    price NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(10,2),
    date_str VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(30) DEFAULT 'AVAILABLE',
    media_level INTEGER DEFAULT 1,
    video_url TEXT,
    gallery_images TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_flash_deal BOOLEAN DEFAULT TRUE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_count INTEGER DEFAULT 1,
    description TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABELAS DE CLIENTES, PERFIS E DEPENDENTES (VAGOU FAMILY)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    auth_user_id UUID,
    username VARCHAR(100),
    password_hash TEXT,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    cpf VARCHAR(20),
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    phone_secondary VARCHAR(30),
    email VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    access_level VARCHAR(50) DEFAULT 'cliente',
    dependents_count INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    origin_type VARCHAR(50),
    origin_salon_id UUID,
    default_address TEXT,
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(10),
    cep VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    google_place_id TEXT,
    security_question_code TEXT,
    security_answer_normalized TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

UPDATE public.clients
SET
  full_name = COALESCE(NULLIF(TRIM(full_name), ''), name),
  phone_whatsapp = COALESCE(NULLIF(TRIM(phone_whatsapp), ''), phone)
WHERE full_name IS NULL OR phone_whatsapp IS NULL;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email VARCHAR(255),
    name VARCHAR(255),
    full_name VARCHAR(255),
    username VARCHAR(100),
    cpf VARCHAR(20),
    document_number VARCHAR(30),
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    avatar_url TEXT,
    dependents_count INTEGER DEFAULT 0,
    salon_id UUID,
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(10),
    cep VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    google_place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.client_family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) DEFAULT 'filho',
    birth_date VARCHAR(20),
    avatar_url TEXT,
    avatar_emoji VARCHAR(20),
    gender VARCHAR(10),
    notes TEXT,
    autonomy_level VARCHAR(50) DEFAULT 'parent_controlled',
    phone VARCHAR(30),
    email VARCHAR(255),
    emancipated_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dependents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    guardian_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    parent_user_id UUID,
    salon_id UUID,
    full_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    relationship VARCHAR(50) DEFAULT 'filho',
    birth_date VARCHAR(20),
    gender VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(255),
    cpf VARCHAR(20),
    avatar_url TEXT,
    avatar_emoji VARCHAR(20),
    autonomy_level VARCHAR(50) DEFAULT 'parent_controlled',
    emancipated_user_id UUID,
    notes TEXT,
    is_unlinked BOOLEAN DEFAULT FALSE,
    unlinked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- 7. TABELA: PUBLIC.APPOINTMENTS (AGENDAMENTOS, RTLS, PAGAMENTO, PERMUTA & ANTI-COLISÃO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_code VARCHAR(50) UNIQUE NOT NULL,
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    salon_name VARCHAR(255),
    salon_logo_url TEXT,
    salon_lat DOUBLE PRECISION,
    salon_lng DOUBLE PRECISION,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    professional_name VARCHAR(255),
    professional_avatar_url TEXT,
    offer_id UUID REFERENCES public.service_offers(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_user_id UUID,

    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(30) NOT NULL,
    client_email VARCHAR(255),
    client_avatar_url TEXT,

    is_dependent BOOLEAN DEFAULT FALSE,
    dependent_id UUID,
    dependent_name VARCHAR(255),

    service_title VARCHAR(255) NOT NULL,
    service_name VARCHAR(255),
    service_category VARCHAR(50) DEFAULT 'cabelo',
    service_type VARCHAR(30) DEFAULT 'IN_SALON',
    client_address TEXT,
    travel_fee NUMERIC(10,2) DEFAULT 0.00,

    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    service_price NUMERIC(10,2) DEFAULT 0.00,
    final_price NUMERIC(10,2) DEFAULT 0.00,
    discount NUMERIC(10,2) DEFAULT 0.00,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    payment_status VARCHAR(30) DEFAULT 'pending',
    payment_method VARCHAR(50),

    date_str VARCHAR(20) NOT NULL,
    scheduled_date VARCHAR(20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 45,
    status VARCHAR(50) DEFAULT 'CONFIRMADO',
    commission_fee NUMERIC(10,2) DEFAULT 1.50,
    notes TEXT,

    -- Pausa de Vagas & Permuta em Cascata (A ➔ B ➔ C)
    is_blocked_slot BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    chair_order INTEGER DEFAULT 0,
    swap_state JSONB,

    -- Radar Bidirecional de Deslocamento Ao Vivo & RTLS GPS
    service_location_type TEXT DEFAULT 'in_salon',
    transport_mode TEXT DEFAULT 'driving',
    tracking_status TEXT DEFAULT 'idle',
    live_status VARCHAR(50),
    selected_route_summary TEXT,
    route_polyline TEXT,
    current_street_name TEXT,
    route_checkpoints JSONB DEFAULT '[]'::jsonb,
    active_adversity JSONB DEFAULT NULL,
    delay_minutes INTEGER DEFAULT 0,
    client_lat DOUBLE PRECISION,
    client_lng DOUBLE PRECISION,
    distance_km NUMERIC(6,2),
    eta_minutes INTEGER,
    prep_buffer_minutes INTEGER DEFAULT 15,
    cancellation_reason TEXT,
    last_location_update TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS salon_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS salon_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS salon_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS salon_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS professional_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS professional_avatar_url TEXT,
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
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
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

-- Sincronizar payment_status com is_paid e hidratar metadados do salão/profissional nos agendamentos existentes
UPDATE public.appointments
SET payment_status = CASE WHEN is_paid IS TRUE OR paid_at IS NOT NULL THEN 'paid' ELSE COALESCE(payment_status, 'pending') END
WHERE payment_status IS NULL OR (is_paid IS TRUE AND payment_status <> 'paid');

UPDATE public.appointments a
SET
  salon_name = COALESCE(a.salon_name, s.trade_name),
  salon_logo_url = COALESCE(a.salon_logo_url, s.logo_url, s.logo_dark_url, s.logo_light_url),
  salon_lat = COALESCE(a.salon_lat, s.latitude),
  salon_lng = COALESCE(a.salon_lng, s.longitude)
FROM public.salons s
WHERE a.salon_id = s.id
  AND (a.salon_name IS NULL OR a.salon_lat IS NULL OR a.salon_lng IS NULL);

UPDATE public.appointments a
SET
  professional_name = COALESCE(a.professional_name, p.name),
  professional_avatar_url = COALESCE(a.professional_avatar_url, p.avatar_url)
FROM public.professionals p
WHERE a.professional_id = p.id
  AND (a.professional_name IS NULL OR a.professional_avatar_url IS NULL);

-- ==============================================================================
-- 8. TABELAS DE MÍDIA, UTILIDADES, FATURAS E PERGUNTAS DE SEGURANÇA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salon_media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Mídia do Salão',
    url TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'image',
    media_group VARCHAR(50) DEFAULT 'fotos',
    category VARCHAR(50) DEFAULT 'servicos',
    duration_seconds NUMERIC(5,2) DEFAULT 5.00,
    is_cover BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salon_media_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL,
    media_type VARCHAR(20) DEFAULT 'image',
    media_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salon_utilities_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
    energy_meters JSONB DEFAULT '[]'::jsonb,
    energy_readings JSONB DEFAULT '[]'::jsonb,
    water_meters JSONB DEFAULT '[]'::jsonb,
    water_readings JSONB DEFAULT '[]'::jsonb,
    appliances JSONB DEFAULT '[]'::jsonb,
    dre_records JSONB DEFAULT '[]'::jsonb,
    supply_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    reference_month VARCHAR(20) NOT NULL,
    total_appointments INTEGER DEFAULT 0,
    total_amount NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'PENDING',
    pix_code TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    category_label TEXT NOT NULL,
    question_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.security_questions (code, category_label, question_text, is_active)
VALUES
    ('first_pet', 'Animal de estimação', 'Qual o nome do meu animal de estimação?', TRUE),
    ('city_at_10', 'Moradia aos 10 anos', 'Onde vc morou aos 10 anos?', TRUE),
    ('childhood_friend', 'Amigo de infância', 'Nome do seu amigo de infância?', TRUE)
ON CONFLICT (code) DO UPDATE
SET category_label = EXCLUDED.category_label,
    question_text = EXCLUDED.question_text,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS public.user_security_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID,
    question_code TEXT NOT NULL REFERENCES public.security_questions(code) ON UPDATE CASCADE,
    question_text TEXT NOT NULL,
    answer_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, question_code)
);

-- ==============================================================================
-- 9. MOTOR SQL DE CÁLCULO GEOTEMPORAL & TRAVA ANTI-COLISÃO ENTRE SALÕES (bol-153)
-- ==============================================================================

-- 9.1 Calcula o tempo de deslocamento urbano (minutos) entre dois salões (A e B) + margem de segurança
CREATE OR REPLACE FUNCTION public.calculate_inter_salon_travel_minutes(
    lat1 DOUBLE PRECISION,
    lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lng2 DOUBLE PRECISION
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_straight_km DOUBLE PRECISION;
    v_road_km DOUBLE PRECISION;
    v_drive_minutes DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN 30; -- 20 min deslocamento urbano padrão + 10 min margem
    END IF;

    v_straight_km := 6371.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
            cos(radians(lat1)) * cos(radians(lat2)) *
            cos(radians(lng2) - radians(lng1)) +
            sin(radians(lat1)) * sin(radians(lat2))
        ))
    );

    IF v_straight_km < 0.08 THEN
        RETURN 15; -- Salões vizinhos: 5 min deslocamento + 10 min check-in
    END IF;

    -- Fator de tortuosidade viária urbana (1.42x) + velocidade média urbana (16.8 km/h) + 10 min margem
    v_road_km := GREATEST(0.3, v_straight_km * 1.42);
    v_drive_minutes := (v_road_km / 16.8) * 60.0;

    RETURN GREATEST(15, CEIL(v_drive_minutes + 10.0)::INTEGER);
END;
$$;

-- 9.2 RPC para verificar colisão geotemporal entre agendamentos do mesmo cliente no Salão A e Salão B
CREATE OR REPLACE FUNCTION public.check_client_inter_salon_collision(
    p_client_phone TEXT,
    p_client_email TEXT DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_salon_id UUID DEFAULT NULL,
    p_date_str VARCHAR(20) DEFAULT NULL,
    p_start_time TIME DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 45,
    p_exclude_protocol VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    has_conflict BOOLEAN,
    conflicting_protocol VARCHAR(50),
    conflicting_salon_name VARCHAR(255),
    conflicting_start_time TIME,
    conflicting_end_time TIME,
    travel_minutes INTEGER,
    earliest_allowed_time TIME,
    conflict_message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_clean_phone TEXT;
    v_clean_email TEXT;
    v_cand_start_min INTEGER;
    v_cand_dur_min INTEGER;
    v_cand_end_min INTEGER;
    v_target_lat DOUBLE PRECISION;
    v_target_lng DOUBLE PRECISION;
    r RECORD;
    v_apt_start_min INTEGER;
    v_apt_dur_min INTEGER;
    v_apt_end_min INTEGER;
    v_travel_min INTEGER;
    v_earliest_after_min INTEGER;
    v_latest_before_min INTEGER;
BEGIN
    v_clean_phone := REGEXP_REPLACE(COALESCE(p_client_phone, ''), '\D', '', 'g');
    v_clean_email := LOWER(TRIM(COALESCE(p_client_email, '')));

    IF p_date_str IS NULL OR p_start_time IS NULL THEN
        RETURN;
    END IF;

    v_cand_start_min := EXTRACT(HOUR FROM p_start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_start_time)::INTEGER;
    v_cand_dur_min := GREATEST(15, COALESCE(p_duration_minutes, 45));
    v_cand_end_min := v_cand_start_min + v_cand_dur_min;

    IF p_salon_id IS NOT NULL THEN
        SELECT s.latitude, s.longitude INTO v_target_lat, v_target_lng
        FROM public.salons s
        WHERE s.id = p_salon_id;
    END IF;

    FOR r IN
        SELECT
            a.protocol_code,
            a.salon_id,
            COALESCE(a.salon_name, s.trade_name, 'Outro Estabelecimento') AS salon_title,
            a.start_time,
            a.end_time,
            COALESCE(a.duration_minutes, 45) AS dur_min,
            COALESCE(a.salon_lat, s.latitude) AS s_lat,
            COALESCE(a.salon_lng, s.longitude) AS s_lng
        FROM public.appointments a
        LEFT JOIN public.salons s ON s.id = a.salon_id
        WHERE a.date_str = p_date_str
          AND COALESCE(a.is_blocked_slot, FALSE) = FALSE
          AND UPPER(COALESCE(a.status, 'CONFIRMADO')) NOT IN ('CANCELADO', 'CONCLUÍDO', 'CONCLUIDO')
          AND (p_exclude_protocol IS NULL OR a.protocol_code <> p_exclude_protocol)
          AND (
              (p_client_id IS NOT NULL AND a.client_id = p_client_id)
              OR (v_clean_phone <> '' AND REGEXP_REPLACE(COALESCE(a.client_phone, ''), '\D', '', 'g') = v_clean_phone)
              OR (v_clean_email <> '' AND LOWER(TRIM(COALESCE(a.client_email, ''))) = v_clean_email)
          )
    LOOP
        v_apt_start_min := EXTRACT(HOUR FROM r.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM r.start_time)::INTEGER;
        v_apt_dur_min := GREATEST(
            15,
            CASE
                WHEN r.end_time IS NOT NULL AND r.end_time > r.start_time THEN
                    (EXTRACT(HOUR FROM r.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM r.end_time)::INTEGER) - v_apt_start_min
                ELSE r.dur_min
            END
        );
        v_apt_end_min := v_apt_start_min + v_apt_dur_min;

        IF p_salon_id IS NOT NULL AND r.salon_id = p_salon_id THEN
            v_travel_min := 0;
        ELSE
            v_travel_min := public.calculate_inter_salon_travel_minutes(r.s_lat, r.s_lng, v_target_lat, v_target_lng);
        END IF;

        v_earliest_after_min := v_apt_end_min + v_travel_min;
        v_latest_before_min := v_apt_start_min - v_travel_min;

        IF (v_cand_start_min >= v_apt_start_min AND v_cand_start_min < v_earliest_after_min)
           OR (v_cand_start_min < v_apt_start_min AND v_cand_end_min > v_latest_before_min) THEN
            has_conflict := TRUE;
            conflicting_protocol := r.protocol_code;
            conflicting_salon_name := r.salon_title;
            conflicting_start_time := r.start_time;
            conflicting_end_time := (r.start_time + (v_apt_dur_min || ' minutes')::INTERVAL)::TIME;
            travel_minutes := v_travel_min;
            earliest_allowed_time := (TIME '00:00' + (LEAST(1439, v_earliest_after_min) || ' minutes')::INTERVAL)::TIME;
            conflict_message := FORMAT(
                'Conflito geotemporal com %s (%s às %s + %s min de deslocamento). Horário livre a partir das %s.',
                r.salon_title,
                TO_CHAR(r.start_time, 'HH24:MI'),
                TO_CHAR(conflicting_end_time, 'HH24:MI'),
                v_travel_min,
                TO_CHAR(earliest_allowed_time, 'HH24:MI')
            );
            RETURN NEXT;
            RETURN;
        END IF;
    END LOOP;

    RETURN;
END;
$$;

-- 9.3 Trigger de Proteção Anti-Colisão Geotemporal na tabela public.appointments
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_inter_salon_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_conflict RECORD;
BEGIN
    IF COALESCE(NEW.is_blocked_slot, FALSE) = TRUE
       OR UPPER(COALESCE(NEW.status, 'CONFIRMADO')) IN ('CANCELADO', 'CONCLUÍDO', 'CONCLUIDO') THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_conflict
    FROM public.check_client_inter_salon_collision(
        NEW.client_phone,
        NEW.client_email,
        NEW.client_id,
        NEW.salon_id,
        NEW.date_str,
        NEW.start_time,
        COALESCE(NEW.duration_minutes, 45),
        NEW.protocol_code
    )
    WHERE has_conflict = TRUE
    LIMIT 1;

    IF FOUND AND v_conflict.has_conflict IS TRUE THEN
        RAISE EXCEPTION '%', v_conflict.conflict_message
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_inter_salon_collision ON public.appointments;
CREATE TRIGGER trg_prevent_inter_salon_collision
BEFORE INSERT OR UPDATE OF date_str, start_time, end_time, salon_id, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_prevent_inter_salon_collision();

-- ==============================================================================
-- 10. FUNÇÃO RPC: GET_BUSY_SLOTS (CONSULTA DE HORÁRIOS OCUPADOS DO DIA)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_busy_slots(
    p_salon_id UUID,
    p_date_str VARCHAR(20)
)
RETURNS TABLE (
    start_time TIME,
    end_time TIME,
    professional_id UUID,
    professional_name VARCHAR(255)
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        a.start_time,
        a.end_time,
        a.professional_id,
        COALESCE(a.professional_name, p.name) AS professional_name
    FROM public.appointments a
    LEFT JOIN public.professionals p ON p.id = a.professional_id
    WHERE a.salon_id = p_salon_id
      AND a.date_str = p_date_str
      AND UPPER(COALESCE(a.status, 'CONFIRMADO')) NOT IN ('CANCELADO');
$$;

-- ==============================================================================
-- 11. ÍNDICES DE ALTA PERFORMANCE (ORDENAÇÃO CRONOLÓGICA, BUSCAS & RTLS)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_salons_slug ON public.salons(slug);
CREATE INDEX IF NOT EXISTS idx_salons_owner_cpf ON public.salons(owner_cpf);
CREATE INDEX IF NOT EXISTS idx_salons_coords ON public.salons(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_date ON public.appointments(salon_id, date_str);
CREATE INDEX IF NOT EXISTS idx_appointments_chronological ON public.appointments(date_str ASC, start_time ASC);
CREATE INDEX IF NOT EXISTS idx_appointments_client_date ON public.appointments(client_phone, date_str, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON public.appointments(protocol_code);
CREATE INDEX IF NOT EXISTS idx_appointments_live_tracking ON public.appointments(salon_id, date_str, tracking_status);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON public.appointments(salon_id, date_str, status);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON public.clients(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_clients_full_name_lower ON public.clients(LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_professionals_salon_id ON public.professionals(salon_id);
CREATE INDEX IF NOT EXISTS idx_professionals_cpf ON public.professionals(cpf);
CREATE INDEX IF NOT EXISTS idx_service_offers_radar ON public.service_offers(date_str, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_security_answers_lookup ON public.user_security_answers(question_code, answer_normalized);

-- ==============================================================================
-- 12. PERMISSÕES, RLS E STORAGE BUCKETS
-- ==============================================================================
ALTER TABLE public.salons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_ui_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_media_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_media_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_utilities_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_answers DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('salon-media', 'salon-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
