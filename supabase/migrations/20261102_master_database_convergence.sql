-- ==============================================================================
-- 🏛️ VAGOUAPP — SCRIPT MESTRE DE CONVERGÊNCIA TOTAL DO BANCO DE DADOS (SUPABASE)
-- Versão: 3.0.0 — Data: 2026-11-02
-- Tríade Oficial: mnvapp (Estabelecimentos) ⇄ pvapp (Portal) ⇄ admvapp (Admin Master)
-- ==============================================================================
-- 100% IDEMPOTENTE: Seguro para rodar quantas vezes quiser no SQL Editor do Supabase.
-- Garante a criação de todas as tabelas, colunas, índices, RLS e RPCs sem perder dados.
-- ==============================================================================

BEGIN;

-- 1. EXTENSÕES POSTGRESQL ESSENCIAIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA: SALONS (ESTABELECIMENTOS / PARCEIROS & VITRINES WHITE-LABEL)
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
    
    -- Localização, Endereço Completo & GIS (bol-023 / bol-024)
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
    primary_color VARCHAR(20) DEFAULT '#20C933',
    secondary_color VARCHAR(20) DEFAULT '#0F172A',
    default_theme VARCHAR(20) DEFAULT 'dark',
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
    nav_bg_style VARCHAR(30) DEFAULT 'glass',
    nav_bg_color VARCHAR(30),
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

-- Migração Idempotente de Colunas em public.salons
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
  ADD COLUMN IF NOT EXISTS nav_bg_style VARCHAR(30) DEFAULT 'glass',
  ADD COLUMN IF NOT EXISTS nav_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_active_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_active_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_text_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_shadow VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_blur VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_font VARCHAR(60),
  ADD COLUMN IF NOT EXISTS default_theme VARCHAR(20) DEFAULT 'dark',
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
-- 3. TABELA: SALON_UI_SETTINGS (ESPELHO ESTRUTURADO DE CORES, THEMES & UI)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salon_ui_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
    default_theme VARCHAR(20) DEFAULT 'dark',
    primary_color VARCHAR(20) DEFAULT '#20C933',
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
    nav_bg_style VARCHAR(30) DEFAULT 'glass',
    nav_bg_color VARCHAR(30),
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
-- 4. TABELA: SALON_MEMBERS & SALON_USERS (RBAC, EQUIPE & CONTROLE DE ACESSO)
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

-- ==============================================================================
-- 5. TABELA: SYSTEM_ADMINS (SUPERADMIN MASTER CORPORATIVO — admvapp)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    cpf VARCHAR(20) UNIQUE,
    phone_whatsapp VARCHAR(30),
    name VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'superadmin',
    access_level VARCHAR(50) DEFAULT 'Superadmin Master',
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABELA: PROFESSIONALS (ESPECIALISTAS / CORPO PROFISSIONAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(150) DEFAULT 'Profissional',
    access_level VARCHAR(50) DEFAULT 'professional',
    avatar_url TEXT,
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
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
    use_custom_schedule BOOLEAN DEFAULT FALSE,
    schedule_config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migração Idempotente de Colunas em public.professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
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
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS product_commission_rate NUMERIC(5,2) DEFAULT 10.00;

-- ==============================================================================
-- 7. TABELAS: SERVICES & SALON_SERVICES (CATÁLOGO UNIFICADO DE SERVIÇOS)
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

-- ==============================================================================
-- 8. TABELA: SERVICE_OFFERS (RADAR DE VAGAS RELÂMPAGO / HORÁRIOS OCIOSOS)
-- ==============================================================================
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
-- 9. TABELA: CLIENTS & PROFILES (CLIENTES FINAIS & IDENTIDADES DE USUÁRIO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100),
    password_hash TEXT,
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(255),
    avatar_url TEXT,
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
    dependents_count INTEGER DEFAULT 0,
    access_level VARCHAR(50) DEFAULT 'cliente',
    security_question_code TEXT,
    security_answer_normalized TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
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
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS security_question_code TEXT,
  ADD COLUMN IF NOT EXISTS security_answer_normalized TEXT;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email VARCHAR(255),
    name VARCHAR(255),
    cpf VARCHAR(20),
    phone VARCHAR(30),
    avatar_url TEXT,
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

-- ==============================================================================
-- 10. TABELAS: CONTA FAMÍLIA & DEPENDENTES (CLIENT_FAMILY_MEMBERS & DEPENDENTS)
-- ==============================================================================
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
    full_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) DEFAULT 'other',
    birth_date VARCHAR(20),
    notes TEXT,
    is_unlinked BOOLEAN DEFAULT FALSE,
    unlinked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. TABELA: APPOINTMENTS (AGENDAMENTOS, RTLS, LIVE TRACKING & PAUSA DE VAGAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_code VARCHAR(50) UNIQUE NOT NULL,
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    offer_id UUID REFERENCES public.service_offers(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(30) NOT NULL,
    client_email VARCHAR(255),
    
    is_dependent BOOLEAN DEFAULT FALSE,
    dependent_id UUID,
    dependent_name VARCHAR(255),
    
    service_title VARCHAR(255) NOT NULL,
    service_category VARCHAR(50) DEFAULT 'cabelo',
    service_type VARCHAR(30) DEFAULT 'IN_SALON',
    client_address TEXT,
    travel_fee NUMERIC(10,2) DEFAULT 0.00,
    
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    date_str VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMADO',
    commission_fee NUMERIC(10,2) DEFAULT 1.50,
    notes TEXT,
    
    -- Pausa Emergencial de Vagas & Bloqueio Instantâneo (bol-103)
    is_blocked_slot BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    chair_order INTEGER DEFAULT 0,
    swap_state JSONB,
    
    -- Radar Bidirecional de Deslocamento Ao Vivo & RTLS GPS (bol-020)
    service_location_type TEXT DEFAULT 'in_salon',
    transport_mode TEXT DEFAULT 'driving',
    tracking_status TEXT DEFAULT 'idle',
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
    prep_buffer_minutes INTEGER DEFAULT 10,
    cancellation_reason TEXT,
    last_location_update TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migração Idempotente de Colunas em public.appointments (Garante zero falhas no upsert)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_dependent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dependent_id UUID,
  ADD COLUMN IF NOT EXISTS dependent_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_blocked_slot BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS chair_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_state JSONB,
  ADD COLUMN IF NOT EXISTS service_location_type TEXT DEFAULT 'in_salon',
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'driving',
  ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'idle',
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
  ADD COLUMN IF NOT EXISTS prep_buffer_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- ==============================================================================
-- 12. TABELAS: MÍDIA, STORIES & UTILIDADES (SALON_MEDIA_ITEMS & RECORDS)
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

-- ==============================================================================
-- 13. TABELAS: PERGUNTAS SECRETAS & RECUPERAÇÃO DE CONTA (TRÍADE SYNC)
-- ==============================================================================
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
-- 14. ÍNDICES DE ALTA PERFORMANCE (BUSCAS, ROTAS, TELEMETRIA & CPFs)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_salons_slug ON public.salons(slug);
CREATE INDEX IF NOT EXISTS idx_salons_owner_cpf ON public.salons(owner_cpf);
CREATE INDEX IF NOT EXISTS idx_salons_coords ON public.salons(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_date ON public.appointments(salon_id, date_str);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON public.appointments(protocol_code);
CREATE INDEX IF NOT EXISTS idx_appointments_live_tracking ON public.appointments(salon_id, date_str, tracking_status);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_professionals_salon_id ON public.professionals(salon_id);
CREATE INDEX IF NOT EXISTS idx_professionals_cpf ON public.professionals(cpf);
CREATE INDEX IF NOT EXISTS idx_service_offers_radar ON public.service_offers(date_str, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_security_answers_lookup ON public.user_security_answers(question_code, answer_normalized);

-- ==============================================================================
-- 15. FUNÇÃO RPC: GET_OFFERS_IN_RADIUS (RADAR DE VAGAS COM DISTÂNCIA HAVERSINE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_offers_in_radius(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 25.0,
    filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    offer_id UUID,
    salon_id UUID,
    salon_name VARCHAR(255),
    salon_neighborhood VARCHAR(100),
    salon_address TEXT,
    salon_logo TEXT,
    salon_logo_light TEXT,
    salon_logo_dark TEXT,
    operating_model VARCHAR(50),
    home_delivery_enabled BOOLEAN,
    home_delivery_area TEXT,
    home_delivery_travel_fee NUMERIC(10,2),
    professional_name VARCHAR(255),
    professional_avatar TEXT,
    rating_avg NUMERIC(3,2),
    rating_count INTEGER,
    service_title VARCHAR(255),
    category VARCHAR(50),
    price NUMERIC(10,2),
    original_price NUMERIC(10,2),
    date_str VARCHAR(20),
    start_time TIME,
    end_time TIME,
    media_level INTEGER,
    video_url TEXT,
    gallery_images TEXT[],
    distance_meters INTEGER,
    distance_km NUMERIC(5,1),
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        so.id AS offer_id,
        s.id AS salon_id,
        s.trade_name AS salon_name,
        s.neighborhood AS salon_neighborhood,
        s.address AS salon_address,
        s.logo_url AS salon_logo,
        s.logo_light_url AS salon_logo_light,
        s.logo_dark_url AS salon_logo_dark,
        s.operating_model,
        s.home_delivery_enabled,
        s.home_delivery_area,
        s.home_delivery_travel_fee,
        COALESCE(p.name, 'Profissional') AS professional_name,
        p.avatar_url AS professional_avatar,
        s.rating_avg,
        s.rating_count,
        so.service_title,
        so.category,
        so.price,
        so.original_price,
        so.date_str,
        so.start_time,
        so.end_time,
        so.media_level,
        so.video_url,
        so.gallery_images,
        ROUND((
            6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude)) *
                    cos(radians(s.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(s.latitude))
                ))
            )
        )::NUMERIC)::INTEGER AS distance_meters,
        ROUND((
            (6371 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude)) *
                    cos(radians(s.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(s.latitude))
                ))
            ))::NUMERIC
        ), 1) AS distance_km,
        so.expires_at
    FROM public.service_offers so
    JOIN public.salons s ON s.id = so.salon_id
    LEFT JOIN public.professionals p ON p.id = so.professional_id
    WHERE so.status = 'AVAILABLE'
      AND so.expires_at > NOW()
      AND s.is_active = TRUE
      AND (filter_category IS NULL OR filter_category = '' OR LOWER(so.category) = LOWER(filter_category))
      AND (
          6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                  cos(radians(user_lat)) * cos(radians(s.latitude)) *
                  cos(radians(s.longitude) - radians(user_lng)) +
                  sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
          )
      ) <= radius_km
    ORDER BY distance_meters ASC, so.start_time ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- 16. FUNÇÕES RPC: PERGUNTAS SECRETAS & RECUPERAÇÃO DE USERNAME
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_random_security_question()
RETURNS TABLE (
  id UUID,
  code TEXT,
  category_label TEXT,
  question_text TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT sq.id, sq.code, sq.category_label, sq.question_text
  FROM public.security_questions sq
  WHERE sq.is_active = TRUE
  ORDER BY random()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.recover_username_by_security_answer(
  p_question_code TEXT,
  p_answer TEXT,
  p_cpf TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  client_id UUID,
  username TEXT,
  name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized_answer TEXT;
  v_clean_cpf TEXT;
  v_clean_email TEXT;
BEGIN
  v_normalized_answer := LOWER(TRIM(p_answer));
  v_clean_cpf := REGEXP_REPLACE(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));

  RETURN QUERY
  SELECT
    c.id AS client_id,
    c.username,
    c.name,
    c.email
  FROM public.user_security_answers usa
  JOIN public.clients c ON c.id = usa.client_id
  WHERE usa.question_code = p_question_code
    AND LOWER(TRIM(usa.answer_normalized)) = v_normalized_answer
    AND (
      (v_clean_cpf <> '' AND REGEXP_REPLACE(COALESCE(c.cpf, ''), '\D', '', 'g') = v_clean_cpf)
      OR
      (v_clean_email <> '' AND LOWER(TRIM(COALESCE(c.email, ''))) = v_clean_email)
      OR
      (v_clean_cpf = '' AND v_clean_email = '')
    )
  LIMIT 1;
END;
$$;

-- ==============================================================================
-- 17. PERMISSÕES E ROW LEVEL SECURITY (RLS 100% OPERACIONAL NA TRÍADE)
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

-- ==============================================================================
-- 18. STORAGE BUCKETS (AVATARS E SALON-MEDIA)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('salon-media', 'salon-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public storage read avatars" ON storage.objects;
CREATE POLICY "Public storage read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public storage insert avatars" ON storage.objects;
CREATE POLICY "Public storage insert avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public storage update avatars" ON storage.objects;
CREATE POLICY "Public storage update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public storage read salon-media" ON storage.objects;
CREATE POLICY "Public storage read salon-media" ON storage.objects FOR SELECT USING (bucket_id = 'salon-media');

DROP POLICY IF EXISTS "Public storage insert salon-media" ON storage.objects;
CREATE POLICY "Public storage insert salon-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'salon-media');

DROP POLICY IF EXISTS "Public storage update salon-media" ON storage.objects;
CREATE POLICY "Public storage update salon-media" ON storage.objects FOR UPDATE USING (bucket_id = 'salon-media');

COMMIT;
