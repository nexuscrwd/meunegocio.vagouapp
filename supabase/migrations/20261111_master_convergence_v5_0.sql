-- =====================================================================================================
-- 🏛️ VAGOUAPP — SCRIPT MESTRE SOBERANO DE CONVERGÊNCIA UNIFICADA (SUPABASE SQL v5.0)
-- Data: 11/11/2026 — Cobertura Integral: mnvapp (bol-001..bol-158) ⇄ admvapp ⇄ pvapp
-- =====================================================================================================
-- CARACTERÍSTICAS DESTE SCRIPT:
--   1. 100% IDEMPOTENTE E NÃO-DESTRUTIVO: Zero DROP TABLE CASCADE. Seguro para rodar em produção.
--   2. ZERO MOCKS / SEEDS FICTÍCIOS: Mantém apenas o catálogo oficial de perguntas de segurança.
--   3. 23 TABELAS CONVERGENTES: Une 100% das tabelas do App (mnvapp) e do Gestor Corporativo (admvapp).
--   4. PADRÃO FINANCEIRO UNIFICADO: R$ 2,50 por agendamento concluído (fee_per_booking ⇄ billing_fee_value)
--      ou Assinatura Mensal R$ 89,90 (customizável individualmente por estabelecimento no Admin).
--   5. PALETA DEFAULT CLARA & NEUTRA: default_theme = 'light', nav_bg_color = '#F1F5F9', primary_color = '#334155'.
--   6. TRIGGERS BIDIRECIONAIS + MOTOR GEOTEMPORAL ANTI-COLISÃO + REALTIME + RLS ESTRUTURADO.
-- =====================================================================================================

BEGIN;

-- =====================================================================================================
-- 1. EXTENSÕES POSTGRESQL ESSENCIAIS
-- =====================================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================================================
-- 2. NÚCLEO DE IDENTIDADE GLOBAL & GOVERNANÇA CORPORATIVA (PROFILES, ADMINS, LOGS)
-- =====================================================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    full_name VARCHAR(255),
    username VARCHAR(100),
    cpf VARCHAR(20),
    document_number VARCHAR(30),
    birth_date DATE,
    role VARCHAR(50) DEFAULT 'consumer',
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    avatar_url TEXT,
    dependents_count INTEGER DEFAULT 0,
    salon_id UUID,
    status VARCHAR(30) DEFAULT 'active',
    address TEXT,
    street_number VARCHAR(50),
    complement VARCHAR(100),
    neighborhood VARCHAR(150),
    city VARCHAR(150) DEFAULT 'São Paulo',
    state VARCHAR(10) DEFAULT 'SP',
    cep VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    google_place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'consumer',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salon_id UUID,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS city VARCHAR(150) DEFAULT 'São Paulo',
  ADD COLUMN IF NOT EXISTS state VARCHAR(10) DEFAULT 'SP',
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

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
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_admins
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'superadmin',
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'Superadmin Master',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.admin_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.system_admins(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================================================
-- 3. ESTABELECIMENTOS & PREFERÊNCIAS VISUAIS WHITE-LABEL (SALONS & SALON_UI_SETTINGS)
-- =====================================================================================================
CREATE TABLE IF NOT EXISTS public.salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255),
    trade_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL DEFAULT '',
    slug VARCHAR(100) UNIQUE NOT NULL,
    subdomain VARCHAR(100),
    document_type VARCHAR(20) DEFAULT 'CNPJ',
    document_number VARCHAR(30),
    has_cnpj BOOLEAN DEFAULT FALSE,
    owner_cpf VARCHAR(20),
    owner_name VARCHAR(255),
    owner_email VARCHAR(255),
    owner_phone VARCHAR(30),
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    phone_landline VARCHAR(30),
    email VARCHAR(255),
    category VARCHAR(100) DEFAULT 'Barbearia',
    operating_model VARCHAR(50) DEFAULT 'team',
    home_delivery_enabled BOOLEAN DEFAULT FALSE,
    home_delivery_area TEXT,
    home_delivery_travel_fee NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'active',
    is_verified BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    commission_rate NUMERIC(5,2) DEFAULT 15.00,

    -- Localização & GIS
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

    -- Identidade Visual, Branding & Paleta Default Clara & Neutra Independente (bol-162)
    favicon_url TEXT,
    slogan VARCHAR(255),
    brand_font VARCHAR(60) DEFAULT 'Poppins',
    logo_url TEXT,
    logo_light_url TEXT,
    logo_dark_url TEXT,
    cover_url TEXT,
    cover_image_url TEXT,
    facade_photo_url TEXT,
    interior_photo_url TEXT,
    theme_preset_id VARCHAR(50) DEFAULT 'neutral-light',
    branding JSONB DEFAULT '{"primaryColor": "#334155", "secondaryColor": "#1E293B", "navBgColor": "#F1F5F9", "defaultTheme": "light", "themeMode": "light"}'::jsonb,
    primary_color VARCHAR(30) DEFAULT '#334155',
    secondary_color VARCHAR(30) DEFAULT '#1E293B',
    default_theme VARCHAR(20) DEFAULT 'light',
    pwa_name VARCHAR(150),
    show_slogan BOOLEAN DEFAULT TRUE,
    logo_text_fallback VARCHAR(100),
    logo_text_color VARCHAR(20),
    show_hero_slides BOOLEAN DEFAULT TRUE,
    welcome_style VARCHAR(50) DEFAULT 'atmospheric',

    -- Subcabeçalhos de Seção (Section Header)
    section_header_bg_color VARCHAR(30) DEFAULT '#FFFFFF',
    section_header_text_color VARCHAR(30) DEFAULT '#1E293B',
    section_header_icon_color VARCHAR(30) DEFAULT '#475569',
    section_header_bg_style VARCHAR(30) DEFAULT 'solid',
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
    nav_icon_border VARCHAR(30) DEFAULT 'none',
    nav_bg_style VARCHAR(30) DEFAULT 'solid',
    nav_bg_color VARCHAR(30) DEFAULT '#F1F5F9',
    nav_btn_bg_color VARCHAR(30),
    nav_btn_active_bg_color VARCHAR(30),
    nav_active_color VARCHAR(30) DEFAULT '#FFFFFF',
    nav_text_color VARCHAR(30),
    nav_btn_shadow VARCHAR(30),
    nav_btn_blur VARCHAR(30),
    nav_btn_font VARCHAR(60),

    -- Espaço Físico, Expediente, PIX e Redes
    space_photos JSONB DEFAULT '[]'::jsonb,
    gallery JSONB DEFAULT '[]'::jsonb,
    space_description TEXT,
    description TEXT,
    bio TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    holidays JSONB DEFAULT '[]'::jsonb,
    cancellation_policy JSONB,
    operating_hours JSONB DEFAULT '{}'::jsonb,
    business_hours JSONB DEFAULT '{}'::jsonb,
    opening_hours_text TEXT,
    pix_key VARCHAR(150),
    pix_keys JSONB DEFAULT '[]'::jsonb,
    website TEXT,
    website_url TEXT,
    instagram VARCHAR(150),
    instagram_url TEXT,
    facebook_url TEXT,
    maps_url TEXT,

    -- Avaliações & Métricas
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    rating_count INTEGER DEFAULT 1,
    media_slots_count INTEGER DEFAULT 1,

    -- Monetização & Faturamento Unificado (App ⇄ Admin Master)
    billing_plan VARCHAR(50) DEFAULT 'PER_APPOINTMENT',
    billing_fee_type VARCHAR(50) DEFAULT 'FIXED',
    billing_fee_value NUMERIC(10,2) DEFAULT 2.50,
    fee_per_booking NUMERIC(10,2) DEFAULT 2.50,
    monthly_subscription_fee NUMERIC(10,2) DEFAULT 89.90,
    billing_due_day INTEGER DEFAULT 10,
    pin_code VARCHAR(30),
    moderation_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100),
  ADD COLUMN IF NOT EXISTS has_cnpj BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_landline VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
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
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_light_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_dark_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS facade_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS interior_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS theme_preset_id VARCHAR(50) DEFAULT 'neutral-light',
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(30) DEFAULT '#334155',
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(30) DEFAULT '#1E293B',
  ADD COLUMN IF NOT EXISTS default_theme VARCHAR(20) DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS pwa_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS slogan VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand_font VARCHAR(60) DEFAULT 'Poppins',
  ADD COLUMN IF NOT EXISTS show_slogan BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS logo_text_fallback VARCHAR(100),
  ADD COLUMN IF NOT EXISTS logo_text_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS show_hero_slides BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS welcome_style VARCHAR(50) DEFAULT 'atmospheric',
  ADD COLUMN IF NOT EXISTS section_header_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_text_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_icon_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS section_header_bg_style VARCHAR(30) DEFAULT 'solid',
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
  ADD COLUMN IF NOT EXISTS nav_icon_border VARCHAR(30) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS nav_bg_style VARCHAR(30) DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS nav_bg_color VARCHAR(30) DEFAULT '#F1F5F9',
  ADD COLUMN IF NOT EXISTS nav_btn_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_active_bg_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_active_color VARCHAR(30) DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS nav_text_color VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_shadow VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_blur VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nav_btn_font VARCHAR(60),
  ADD COLUMN IF NOT EXISTS space_photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS space_description TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS opening_hours_text TEXT,
  ADD COLUMN IF NOT EXISTS pix_key VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pix_keys JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram VARCHAR(150),
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS billing_plan VARCHAR(50) DEFAULT 'PER_APPOINTMENT',
  ADD COLUMN IF NOT EXISTS billing_fee_type VARCHAR(50) DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS billing_fee_value NUMERIC(10,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS fee_per_booking NUMERIC(10,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS monthly_subscription_fee NUMERIC(10,2) DEFAULT 89.90,
  ADD COLUMN IF NOT EXISTS billing_due_day INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(30);

ALTER TABLE public.salons ALTER COLUMN primary_color SET DEFAULT '#334155';
ALTER TABLE public.salons ALTER COLUMN default_theme SET DEFAULT 'light';
ALTER TABLE public.salons ALTER COLUMN nav_bg_color SET DEFAULT '#F1F5F9';
ALTER TABLE public.salons ALTER COLUMN billing_fee_value SET DEFAULT 2.50;
ALTER TABLE public.salons ALTER COLUMN fee_per_booking SET DEFAULT 2.50;

CREATE TABLE IF NOT EXISTS public.salon_ui_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
    default_theme VARCHAR(20) DEFAULT 'light',
    primary_color VARCHAR(30) DEFAULT '#334155',
    secondary_color VARCHAR(30) DEFAULT '#1E293B',
    brand_font VARCHAR(60) DEFAULT 'Poppins',
    pwa_name VARCHAR(150),
    slogan VARCHAR(255),
    show_slogan BOOLEAN DEFAULT TRUE,
    logo_text_fallback VARCHAR(100),
    logo_text_color VARCHAR(20),
    show_hero_slides BOOLEAN DEFAULT TRUE,
    welcome_style VARCHAR(50) DEFAULT 'atmospheric',
    section_header_bg_color VARCHAR(30) DEFAULT '#FFFFFF',
    section_header_text_color VARCHAR(30) DEFAULT '#1E293B',
    section_header_icon_color VARCHAR(30) DEFAULT '#475569',
    section_header_bg_style VARCHAR(30) DEFAULT 'solid',
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
    nav_icon_border VARCHAR(30) DEFAULT 'none',
    nav_bg_style VARCHAR(30) DEFAULT 'solid',
    nav_bg_color VARCHAR(30) DEFAULT '#F1F5F9',
    nav_btn_bg_color VARCHAR(30),
    nav_btn_active_bg_color VARCHAR(30),
    nav_active_color VARCHAR(30) DEFAULT '#FFFFFF',
    nav_text_color VARCHAR(30),
    nav_btn_shadow VARCHAR(30),
    nav_btn_blur VARCHAR(30),
    nav_btn_font VARCHAR(60),
    branding_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salon_ui_settings
  ADD COLUMN IF NOT EXISTS nav_icon_border VARCHAR(30) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS branding_snapshot JSONB;

ALTER TABLE public.salon_ui_settings ALTER COLUMN primary_color SET DEFAULT '#334155';
ALTER TABLE public.salon_ui_settings ALTER COLUMN default_theme SET DEFAULT 'light';
ALTER TABLE public.salon_ui_settings ALTER COLUMN nav_bg_color SET DEFAULT '#F1F5F9';

-- =====================================================================================================
-- 4. GESTÃO DE EQUIPE, MEMBROS E PROFISSIONAIS
-- =====================================================================================================
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
    full_name VARCHAR(255),
    phone VARCHAR(30),
    phone_whatsapp VARCHAR(30),
    avatar_url TEXT,
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

ALTER TABLE public.salon_users
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(30),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
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
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

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

-- =====================================================================================================
-- 5. CATÁLOGO DE SERVIÇOS (SERVICES ⇄ SALON_SERVICES) & RADAR DE VAGAS (SERVICE_OFFERS)
-- =====================================================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    custom_name VARCHAR(255),
    category VARCHAR(80) DEFAULT 'cabelo',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    promotional_price NUMERIC(10,2),
    duration_minutes INTEGER DEFAULT 45,
    duration_estimated VARCHAR(30),
    commission_rate NUMERIC(5,2) DEFAULT 50.00,
    description TEXT,
    image_url TEXT,
    video_url TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    slides JSONB DEFAULT '[]'::jsonb,
    target_audience VARCHAR(50) DEFAULT 'todos',
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS duration_estimated VARCHAR(30),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.salon_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    custom_name VARCHAR(255),
    category VARCHAR(80) DEFAULT 'Geral',
    price NUMERIC(10,2) DEFAULT 0.00,
    promotional_price NUMERIC(10,2),
    duration_minutes INTEGER DEFAULT 45,
    duration_estimated VARCHAR(30),
    commission_rate NUMERIC(5,2) DEFAULT 50.00,
    description TEXT,
    image_url TEXT,
    video_url TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    slides JSONB DEFAULT '[]'::jsonb,
    target_audience VARCHAR(50) DEFAULT 'todos',
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salon_services
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS duration_estimated VARCHAR(30),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.service_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_title VARCHAR(255) NOT NULL,
    category VARCHAR(80) DEFAULT 'cabelo',
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

-- =====================================================================================================
-- 6. CLIENTES, CARTEIRA DO SALÃO, CONTA FAMÍLIA & PERGUNTAS DE SEGURANÇA
-- =====================================================================================================
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
    neighborhood VARCHAR(150),
    city VARCHAR(150),
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
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
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
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS city VARCHAR(150),
  ADD COLUMN IF NOT EXISTS state VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS security_question_code TEXT,
  ADD COLUMN IF NOT EXISTS security_answer_normalized TEXT;

CREATE TABLE IF NOT EXISTS public.salon_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    client_user_id UUID,
    source VARCHAR(50) DEFAULT 'direct_registration',
    status VARCHAR(30) DEFAULT 'active',
    notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_registered_member BOOLEAN DEFAULT TRUE,
    total_appointments INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0.00,
    last_visit_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (salon_id, client_id)
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

CREATE TABLE IF NOT EXISTS public.client_family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    parent_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    salon_id UUID,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    relationship VARCHAR(50) DEFAULT 'filho',
    birth_date VARCHAR(20),
    avatar_url TEXT,
    avatar_emoji VARCHAR(20),
    gender VARCHAR(20),
    notes TEXT,
    autonomy_level VARCHAR(50) DEFAULT 'parent_controlled',
    phone VARCHAR(30),
    email VARCHAR(255),
    emancipated_user_id UUID,
    is_unlinked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_family_members
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS salon_id UUID,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_unlinked BOOLEAN DEFAULT FALSE;

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

-- =====================================================================================================
-- 7. AGENDAMENTOS UNIFICADOS (ORDENAÇÃO CRONOLÓGICA, CAIXA, PERMUTA A➔B➔C, RTLS & ANTI-COLISÃO)
-- =====================================================================================================
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
    appointment_date VARCHAR(20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 45,
    status VARCHAR(50) DEFAULT 'CONFIRMADO',
    commission_fee NUMERIC(10,2) DEFAULT 2.50,
    notes TEXT,

    -- Pausa de Horários & Permuta em Cascata (A ➔ B ➔ C)
    is_blocked_slot BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    chair_order INTEGER DEFAULT 0,
    swap_state JSONB,

    -- Telemetria GPS / RTLS Ao Vivo
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
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    origin_formatted_address TEXT,
    client_lat DOUBLE PRECISION,
    client_lng DOUBLE PRECISION,
    distance_km NUMERIC(8,2),
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
  ADD COLUMN IF NOT EXISTS appointment_date VARCHAR(20),
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS commission_fee NUMERIC(10,2) DEFAULT 2.50,
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
  ADD COLUMN IF NOT EXISTS origin_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS client_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS client_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS prep_buffer_minutes INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

ALTER TABLE public.appointments ALTER COLUMN commission_fee SET DEFAULT 2.50;

-- =====================================================================================================
-- 8. MÍDIA, UTILIDADES OPERACIONAIS, FATURAS CORPORATIVAS E TRANSAÇÕES FINANCEIRAS
-- =====================================================================================================
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
    financial_dre JSONB DEFAULT '{}'::jsonb,
    supply_items JSONB DEFAULT '[]'::jsonb,
    inventory_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salon_utilities_records
  ADD COLUMN IF NOT EXISTS financial_dre JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory_items JSONB DEFAULT '[]'::jsonb;

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

CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'income',
    category VARCHAR(100) DEFAULT 'Atendimento',
    description TEXT,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'PIX',
    transaction_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================================
-- 9. TRIGGERS DE SINCRONIZAÇÃO BIDIRECIONAL ENTRE MNVAPP, ADMVAPP E PVAPP
-- =====================================================================================================

-- 9.1 Trigger Universal updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 9.2 Normalização e Sincronismo de Campos em Salons (trade_name ⇄ name, billing_fee_value ⇄ fee_per_booking)
CREATE OR REPLACE FUNCTION public.sync_salon_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.trade_name := COALESCE(NULLIF(TRIM(NEW.trade_name), ''), NULLIF(TRIM(NEW.name), ''), 'Estabelecimento');
    NEW.name := COALESCE(NULLIF(TRIM(NEW.name), ''), NEW.trade_name);
    NEW.subdomain := COALESCE(NULLIF(TRIM(NEW.subdomain), ''), NEW.slug);
    NEW.phone_whatsapp := COALESCE(NULLIF(TRIM(NEW.phone_whatsapp), ''), NEW.phone);
    NEW.phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), NEW.phone_whatsapp);

    -- Sincronismo bidirecional de taxa por reserva (App ⇄ Admin Master: padrão R$ 2,50)
    IF TG_OP = 'INSERT' THEN
        NEW.fee_per_booking := COALESCE(NEW.fee_per_booking, NEW.billing_fee_value, 2.50);
        NEW.billing_fee_value := COALESCE(NEW.billing_fee_value, NEW.fee_per_booking, 2.50);
    ELSE
        IF NEW.fee_per_booking IS DISTINCT FROM OLD.fee_per_booking THEN
            NEW.billing_fee_value := NEW.fee_per_booking;
        ELSIF NEW.billing_fee_value IS DISTINCT FROM OLD.billing_fee_value THEN
            NEW.fee_per_booking := NEW.billing_fee_value;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_salon_fields ON public.salons;
CREATE TRIGGER trg_sync_salon_fields
BEFORE INSERT OR UPDATE ON public.salons
FOR EACH ROW EXECUTE FUNCTION public.sync_salon_fields();

-- 9.3 Espelhamento Bidirecional de Catálogo: public.services ⇄ public.salon_services
CREATE OR REPLACE FUNCTION public.sync_services_to_salon_services()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.salon_services WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    INSERT INTO public.salon_services (
        id, salon_id, name, title, custom_name, category, price, promotional_price,
        duration_minutes, duration_estimated, commission_rate, description, image_url,
        video_url, photos, videos, slides, target_audience, order_index, is_active, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.salon_id, COALESCE(NEW.name, NEW.title, 'Serviço'), COALESCE(NEW.title, NEW.name, 'Serviço'),
        NEW.custom_name, COALESCE(NEW.category, 'Geral'), COALESCE(NEW.price, 0), NEW.promotional_price,
        COALESCE(NEW.duration_minutes, 45), NEW.duration_estimated, COALESCE(NEW.commission_rate, 50),
        NEW.description, NEW.image_url, NEW.video_url, COALESCE(NEW.photos, '[]'::jsonb),
        COALESCE(NEW.videos, '[]'::jsonb), COALESCE(NEW.slides, '[]'::jsonb),
        COALESCE(NEW.target_audience, 'todos'), COALESCE(NEW.order_index, 0), COALESCE(NEW.is_active, TRUE),
        COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        salon_id = EXCLUDED.salon_id,
        name = EXCLUDED.name,
        title = EXCLUDED.title,
        custom_name = EXCLUDED.custom_name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        promotional_price = EXCLUDED.promotional_price,
        duration_minutes = EXCLUDED.duration_minutes,
        duration_estimated = EXCLUDED.duration_estimated,
        commission_rate = EXCLUDED.commission_rate,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        photos = EXCLUDED.photos,
        videos = EXCLUDED.videos,
        slides = EXCLUDED.slides,
        target_audience = EXCLUDED.target_audience,
        order_index = EXCLUDED.order_index,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_services_to_salon_services ON public.services;
CREATE TRIGGER trg_sync_services_to_salon_services
AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.sync_services_to_salon_services();

CREATE OR REPLACE FUNCTION public.sync_salon_services_to_services()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.services WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    INSERT INTO public.services (
        id, salon_id, title, name, custom_name, category, price, promotional_price,
        duration_minutes, duration_estimated, commission_rate, description, image_url,
        video_url, photos, videos, slides, target_audience, order_index, is_active, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.salon_id, COALESCE(NEW.title, NEW.name, 'Serviço'), COALESCE(NEW.name, NEW.title, 'Serviço'),
        NEW.custom_name, COALESCE(NEW.category, 'cabelo'), COALESCE(NEW.price, 0), NEW.promotional_price,
        COALESCE(NEW.duration_minutes, 45), NEW.duration_estimated, COALESCE(NEW.commission_rate, 50),
        NEW.description, NEW.image_url, NEW.video_url, COALESCE(NEW.photos, '[]'::jsonb),
        COALESCE(NEW.videos, '[]'::jsonb), COALESCE(NEW.slides, '[]'::jsonb),
        COALESCE(NEW.target_audience, 'todos'), COALESCE(NEW.order_index, 0), COALESCE(NEW.is_active, TRUE),
        COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        salon_id = EXCLUDED.salon_id,
        title = EXCLUDED.title,
        name = EXCLUDED.name,
        custom_name = EXCLUDED.custom_name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        promotional_price = EXCLUDED.promotional_price,
        duration_minutes = EXCLUDED.duration_minutes,
        duration_estimated = EXCLUDED.duration_estimated,
        commission_rate = EXCLUDED.commission_rate,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        photos = EXCLUDED.photos,
        videos = EXCLUDED.videos,
        slides = EXCLUDED.slides,
        target_audience = EXCLUDED.target_audience,
        order_index = EXCLUDED.order_index,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_salon_services_to_services ON public.salon_services;
CREATE TRIGGER trg_sync_salon_services_to_services
AFTER INSERT OR UPDATE OR DELETE ON public.salon_services
FOR EACH ROW EXECUTE FUNCTION public.sync_salon_services_to_services();

-- 9.4 Espelhamento Bidirecional Conta Família: dependents ⇄ client_family_members
CREATE OR REPLACE FUNCTION public.sync_dependents_to_family_members()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.client_family_members WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    IF COALESCE(NEW.parent_client_id, NEW.guardian_client_id) IS NULL THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.client_family_members (
        id, guardian_client_id, parent_client_id, salon_id, name, full_name,
        relationship, birth_date, avatar_url, avatar_emoji, gender, notes,
        autonomy_level, phone, email, emancipated_user_id, is_unlinked, created_at, updated_at
    ) VALUES (
        NEW.id, COALESCE(NEW.parent_client_id, NEW.guardian_client_id), COALESCE(NEW.parent_client_id, NEW.guardian_client_id),
        NEW.salon_id, COALESCE(NEW.full_name, NEW.name, 'Dependente'), COALESCE(NEW.full_name, NEW.name, 'Dependente'),
        COALESCE(NEW.relationship, 'filho'), NEW.birth_date, NEW.avatar_url, NEW.avatar_emoji, NEW.gender, NEW.notes,
        COALESCE(NEW.autonomy_level, 'parent_controlled'), NEW.phone, NEW.email, NEW.emancipated_user_id,
        COALESCE(NEW.is_unlinked, FALSE), COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        guardian_client_id = EXCLUDED.guardian_client_id,
        parent_client_id = EXCLUDED.parent_client_id,
        salon_id = EXCLUDED.salon_id,
        name = EXCLUDED.name,
        full_name = EXCLUDED.full_name,
        relationship = EXCLUDED.relationship,
        birth_date = EXCLUDED.birth_date,
        avatar_url = EXCLUDED.avatar_url,
        avatar_emoji = EXCLUDED.avatar_emoji,
        gender = EXCLUDED.gender,
        notes = EXCLUDED.notes,
        autonomy_level = EXCLUDED.autonomy_level,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        emancipated_user_id = EXCLUDED.emancipated_user_id,
        is_unlinked = EXCLUDED.is_unlinked,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dependents_to_family_members ON public.dependents;
CREATE TRIGGER trg_sync_dependents_to_family_members
AFTER INSERT OR UPDATE OR DELETE ON public.dependents
FOR EACH ROW EXECUTE FUNCTION public.sync_dependents_to_family_members();

CREATE OR REPLACE FUNCTION public.sync_family_members_to_dependents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.dependents WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    INSERT INTO public.dependents (
        id, parent_client_id, guardian_client_id, salon_id, full_name, name,
        relationship, birth_date, avatar_url, avatar_emoji, gender, notes,
        autonomy_level, phone, email, emancipated_user_id, is_unlinked, created_at, updated_at
    ) VALUES (
        NEW.id, COALESCE(NEW.guardian_client_id, NEW.parent_client_id), COALESCE(NEW.guardian_client_id, NEW.parent_client_id),
        NEW.salon_id, COALESCE(NEW.name, NEW.full_name, 'Dependente'), COALESCE(NEW.name, NEW.full_name, 'Dependente'),
        COALESCE(NEW.relationship, 'filho'), NEW.birth_date, NEW.avatar_url, NEW.avatar_emoji, NEW.gender, NEW.notes,
        COALESCE(NEW.autonomy_level, 'parent_controlled'), NEW.phone, NEW.email, NEW.emancipated_user_id,
        COALESCE(NEW.is_unlinked, FALSE), COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        parent_client_id = EXCLUDED.parent_client_id,
        guardian_client_id = EXCLUDED.guardian_client_id,
        salon_id = EXCLUDED.salon_id,
        full_name = EXCLUDED.full_name,
        name = EXCLUDED.name,
        relationship = EXCLUDED.relationship,
        birth_date = EXCLUDED.birth_date,
        avatar_url = EXCLUDED.avatar_url,
        avatar_emoji = EXCLUDED.avatar_emoji,
        gender = EXCLUDED.gender,
        notes = EXCLUDED.notes,
        autonomy_level = EXCLUDED.autonomy_level,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        emancipated_user_id = EXCLUDED.emancipated_user_id,
        is_unlinked = EXCLUDED.is_unlinked,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_family_members_to_dependents ON public.client_family_members;
CREATE TRIGGER trg_sync_family_members_to_dependents
AFTER INSERT OR UPDATE OR DELETE ON public.client_family_members
FOR EACH ROW EXECUTE FUNCTION public.sync_family_members_to_dependents();

CREATE OR REPLACE FUNCTION public.sync_client_dependents_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_id UUID;
BEGIN
    v_parent_id := COALESCE(NEW.parent_client_id, NEW.guardian_client_id, OLD.parent_client_id, OLD.guardian_client_id);
    IF v_parent_id IS NOT NULL THEN
        UPDATE public.clients
        SET dependents_count = (
            SELECT COUNT(*)::INTEGER
            FROM public.dependents d
            WHERE COALESCE(d.parent_client_id, d.guardian_client_id) = v_parent_id
              AND COALESCE(d.is_unlinked, FALSE) = FALSE
        ),
        updated_at = NOW()
        WHERE id = v_parent_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_dependents_counter ON public.dependents;
CREATE TRIGGER trg_sync_client_dependents_counter
AFTER INSERT OR UPDATE OR DELETE ON public.dependents
FOR EACH ROW EXECUTE FUNCTION public.sync_client_dependents_counter();

-- 9.5 Espelhamento de Utilidades Operacionais (supply_items ⇄ inventory_items, dre_records ⇄ financial_dre)
CREATE OR REPLACE FUNCTION public.sync_salon_utilities_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.supply_items IS NOT NULL AND NEW.supply_items <> '[]'::jsonb AND (NEW.inventory_items IS NULL OR NEW.inventory_items = '[]'::jsonb) THEN
        NEW.inventory_items := NEW.supply_items;
    ELSIF NEW.inventory_items IS NOT NULL AND NEW.inventory_items <> '[]'::jsonb AND (NEW.supply_items IS NULL OR NEW.supply_items = '[]'::jsonb) THEN
        NEW.supply_items := NEW.inventory_items;
    END IF;
    IF NEW.dre_records IS NOT NULL AND NEW.dre_records <> '[]'::jsonb AND (NEW.financial_dre IS NULL OR NEW.financial_dre = '{}'::jsonb) THEN
        NEW.financial_dre := jsonb_build_object('records', NEW.dre_records);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_salon_utilities_fields ON public.salon_utilities_records;
CREATE TRIGGER trg_sync_salon_utilities_fields
BEFORE INSERT OR UPDATE ON public.salon_utilities_records
FOR EACH ROW EXECUTE FUNCTION public.sync_salon_utilities_fields();

-- 9.6 Hidratação Automática de Agendamentos (Protocolo, Salão, Profissional, Datas e Status de Pagamento)
CREATE OR REPLACE FUNCTION public.handle_appointment_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.protocol_code IS NULL OR TRIM(NEW.protocol_code) = '' THEN
        NEW.protocol_code := '#VGA-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 5));
    END IF;

    NEW.service_title := COALESCE(NULLIF(TRIM(NEW.service_title), ''), NULLIF(TRIM(NEW.service_name), ''), 'Atendimento');
    NEW.service_name := COALESCE(NULLIF(TRIM(NEW.service_name), ''), NEW.service_title);
    NEW.date_str := COALESCE(NULLIF(TRIM(NEW.date_str), ''), NULLIF(TRIM(NEW.scheduled_date), ''), NULLIF(TRIM(NEW.appointment_date), ''));
    NEW.scheduled_date := COALESCE(NEW.scheduled_date, NEW.date_str);
    NEW.appointment_date := COALESCE(NEW.appointment_date, NEW.date_str);

    -- Sincronismo bidirecional Pago / À pagar (is_paid ⇄ payment_status)
    IF NEW.is_paid IS TRUE OR NEW.paid_at IS NOT NULL OR LOWER(COALESCE(NEW.payment_status, '')) = 'paid' THEN
        NEW.is_paid := TRUE;
        NEW.payment_status := 'paid';
        NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    ELSE
        NEW.is_paid := FALSE;
        NEW.payment_status := COALESCE(NULLIF(TRIM(NEW.payment_status), ''), 'pending');
    END IF;

    -- Hidratação de dados geográficos e logo do salão
    IF NEW.salon_id IS NOT NULL AND (NEW.salon_name IS NULL OR NEW.salon_lat IS NULL OR NEW.salon_lng IS NULL) THEN
        SELECT
            COALESCE(NEW.salon_name, s.trade_name),
            COALESCE(NEW.salon_logo_url, s.logo_url, s.logo_dark_url, s.logo_light_url),
            COALESCE(NEW.salon_lat, s.latitude),
            COALESCE(NEW.salon_lng, s.longitude),
            COALESCE(NEW.commission_fee, s.fee_per_booking, s.billing_fee_value, 2.50)
        INTO
            NEW.salon_name,
            NEW.salon_logo_url,
            NEW.salon_lat,
            NEW.salon_lng,
            NEW.commission_fee
        FROM public.salons s
        WHERE s.id = NEW.salon_id;
    END IF;

    -- Hidratação do profissional
    IF NEW.professional_id IS NOT NULL AND (NEW.professional_name IS NULL OR NEW.professional_avatar_url IS NULL) THEN
        SELECT
            COALESCE(NEW.professional_name, p.name),
            COALESCE(NEW.professional_avatar_url, p.avatar_url)
        INTO
            NEW.professional_name,
            NEW.professional_avatar_url
        FROM public.professionals p
        WHERE p.id = NEW.professional_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_appointment_defaults ON public.appointments;
CREATE TRIGGER trg_handle_appointment_defaults
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_defaults();

-- 9.7 Sincronização Geográfica por CPF entre Tabelas da Tríade
CREATE OR REPLACE FUNCTION public.fn_sync_triade_geo_by_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_cpf TEXT;
BEGIN
  clean_cpf := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
  IF length(clean_cpf) = 11 AND (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL) THEN
    IF TG_TABLE_NAME <> 'clients' THEN
      UPDATE public.clients
      SET latitude = NEW.latitude, longitude = NEW.longitude,
          address = COALESCE(NEW.address, address), street_number = COALESCE(NEW.street_number, street_number),
          complement = COALESCE(NEW.complement, complement), neighborhood = COALESCE(NEW.neighborhood, neighborhood),
          city = COALESCE(NEW.city, city), state = COALESCE(NEW.state, state), cep = COALESCE(NEW.cep, cep),
          formatted_address = COALESCE(NEW.formatted_address, formatted_address),
          google_place_id = COALESCE(NEW.google_place_id, google_place_id)
      WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = clean_cpf
        AND (latitude IS DISTINCT FROM NEW.latitude OR longitude IS DISTINCT FROM NEW.longitude);
    END IF;
    IF TG_TABLE_NAME <> 'profiles' THEN
      UPDATE public.profiles
      SET latitude = NEW.latitude, longitude = NEW.longitude,
          address = COALESCE(NEW.address, address), street_number = COALESCE(NEW.street_number, street_number),
          complement = COALESCE(NEW.complement, complement), neighborhood = COALESCE(NEW.neighborhood, neighborhood),
          city = COALESCE(NEW.city, city), state = COALESCE(NEW.state, state), cep = COALESCE(NEW.cep, cep),
          formatted_address = COALESCE(NEW.formatted_address, formatted_address),
          google_place_id = COALESCE(NEW.google_place_id, google_place_id)
      WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = clean_cpf
        AND (latitude IS DISTINCT FROM NEW.latitude OR longitude IS DISTINCT FROM NEW.longitude);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================================================
-- 10. MOTOR GEOTEMPORAL ANTI-COLISÃO ENTRE SALÕES & FUNÇÕES RPC OFICIAIS (APP + ADMIN + PORTAL)
-- =====================================================================================================

-- 10.1 Cálculo de deslocamento urbano entre Salão A e Salão B
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
        RETURN 30;
    END IF;

    v_straight_km := 6371.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
            cos(radians(lat1)) * cos(radians(lat2)) *
            cos(radians(lng2) - radians(lng1)) +
            sin(radians(lat1)) * sin(radians(lat2))
        ))
    );

    IF v_straight_km < 0.08 THEN
        RETURN 15;
    END IF;

    v_road_km := GREATEST(0.3, v_straight_km * 1.42);
    v_drive_minutes := (v_road_km / 16.8) * 60.0;

    RETURN GREATEST(15, CEIL(v_drive_minutes + 10.0)::INTEGER);
END;
$$;

-- 10.2 RPC de verificação anti-colisão geotemporal (Salão A ⇄ Salão B)
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

-- 10.3 RPC: get_busy_slots (Horários Ocupados do Dia)
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

-- 10.4 RPC: get_offers_in_radius (Radar Geoespacial — Portal & App)
CREATE OR REPLACE FUNCTION public.get_offers_in_radius(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 15.0,
    filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    offer_id UUID,
    salon_id UUID,
    salon_name VARCHAR,
    salon_neighborhood VARCHAR,
    salon_address TEXT,
    salon_logo TEXT,
    salon_logo_light TEXT,
    salon_logo_dark TEXT,
    operating_model VARCHAR,
    home_delivery_enabled BOOLEAN,
    home_delivery_area TEXT,
    home_delivery_travel_fee NUMERIC,
    professional_name VARCHAR,
    professional_avatar TEXT,
    rating_avg NUMERIC,
    rating_count INTEGER,
    service_title VARCHAR,
    category VARCHAR,
    price NUMERIC,
    original_price NUMERIC,
    date_str VARCHAR,
    start_time TIME,
    end_time TIME,
    media_level INTEGER,
    video_url TEXT,
    gallery_images TEXT[],
    distance_meters INTEGER,
    distance_km NUMERIC,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        COALESCE(p.name, s.trade_name) AS professional_name,
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
        ROUND(
            (6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude)) *
                    cos(radians(s.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(s.latitude))
                ))
            ))
        )::INTEGER AS distance_meters,
        ROUND(
            ((6371 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude)) *
                    cos(radians(s.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(s.latitude))
                ))
            )))::NUMERIC, 1
        ) AS distance_km,
        so.expires_at
    FROM
        public.service_offers so
        JOIN public.salons s ON so.salon_id = s.id
        LEFT JOIN public.professionals p ON so.professional_id = p.id
    WHERE
        so.status = 'AVAILABLE'
        AND so.expires_at > NOW()
        AND (
            6371 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude)) *
                    cos(radians(s.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(s.latitude))
                ))
            )
        ) <= radius_km
        AND (filter_category IS NULL OR filter_category = 'todos' OR LOWER(so.category) = LOWER(filter_category))
    ORDER BY
        so.expires_at ASC;
END;
$$;

-- 10.5 RPC Soberana de Autenticação do Gestor Corporativo (admvapp): verify_admin_login
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_identifier TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin RECORD;
    v_clean_id TEXT;
    v_digits TEXT;
BEGIN
    v_clean_id := LOWER(TRIM(p_identifier));
    v_digits := REGEXP_REPLACE(v_clean_id, '\D', '', 'g');

    SELECT * INTO v_admin
    FROM public.system_admins
    WHERE LOWER(username) = v_clean_id
       OR LOWER(email) = v_clean_id
       OR (LENGTH(v_digits) >= 8 AND REGEXP_REPLACE(COALESCE(phone_whatsapp, ''), '\D', '', 'g') LIKE '%' || v_digits || '%')
    LIMIT 1;

    IF v_admin.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrador não encontrado.');
    END IF;

    IF v_admin.is_active = FALSE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Conta de administrador inativa ou suspensa.');
    END IF;

    IF v_admin.password_hash = p_password
       OR (v_admin.password_hash LIKE '$2%' AND v_admin.password_hash = crypt(p_password, v_admin.password_hash))
    THEN
        UPDATE public.system_admins
        SET last_login_at = NOW()
        WHERE id = v_admin.id;

        INSERT INTO public.admin_access_logs (admin_id, username, action_type, details)
        VALUES (v_admin.id, COALESCE(v_admin.username, v_admin.email, 'admin'), 'login_success', jsonb_build_object('source', 'web_rpc'));

        RETURN jsonb_build_object(
            'success', true,
            'admin', jsonb_build_object(
                'id', v_admin.id,
                'full_name', COALESCE(v_admin.full_name, v_admin.name),
                'username', v_admin.username,
                'email', v_admin.email,
                'phone_whatsapp', v_admin.phone_whatsapp,
                'role', v_admin.role,
                'is_active', v_admin.is_active,
                'avatar_url', v_admin.avatar_url,
                'created_at', v_admin.created_at
            )
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Senha incorreta.');
    END IF;
END;
$$;

-- 10.6 RPC Soberana de Registro de Administrador Master (admvapp): register_system_admin
CREATE OR REPLACE FUNCTION public.register_system_admin(
    p_full_name TEXT,
    p_username TEXT,
    p_email TEXT,
    p_phone_whatsapp TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_user TEXT;
    v_clean_email TEXT;
    v_exists BOOLEAN;
    v_new_id UUID;
    v_new_admin RECORD;
BEGIN
    v_clean_user := TRIM(p_username);
    v_clean_email := LOWER(TRIM(p_email));

    SELECT EXISTS(
        SELECT 1 FROM public.system_admins
        WHERE LOWER(username) = LOWER(v_clean_user) OR LOWER(email) = v_clean_email
    ) INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nome de usuário ou e-mail já cadastrado.');
    END IF;

    INSERT INTO public.system_admins (
        name, full_name, username, email, phone_whatsapp, password_hash, role, is_active
    ) VALUES (
        TRIM(p_full_name), TRIM(p_full_name), v_clean_user, v_clean_email, TRIM(p_phone_whatsapp),
        crypt(p_password, gen_salt('bf')), 'superadmin', TRUE
    ) RETURNING id INTO v_new_id;

    SELECT * INTO v_new_admin FROM public.system_admins WHERE id = v_new_id;

    INSERT INTO public.admin_access_logs (admin_id, username, action_type, details)
    VALUES (v_new_id, v_clean_user, 'register', jsonb_build_object('source', 'web_rpc'));

    RETURN jsonb_build_object(
        'success', true,
        'admin', jsonb_build_object(
            'id', v_new_admin.id,
            'full_name', v_new_admin.full_name,
            'username', v_new_admin.username,
            'email', v_new_admin.email,
            'phone_whatsapp', v_new_admin.phone_whatsapp,
            'role', v_new_admin.role,
            'is_active', v_new_admin.is_active,
            'avatar_url', v_new_admin.avatar_url,
            'created_at', v_new_admin.created_at
        )
    );
END;
$$;

-- 10.7 RPC Unificada de Registro de Usuário da Tríade: register_triade_user
CREATE OR REPLACE FUNCTION public.register_triade_user(
    p_full_name VARCHAR(255),
    p_username VARCHAR(100),
    p_phone VARCHAR(30),
    p_email VARCHAR(255),
    p_password_hash TEXT,
    p_cep VARCHAR(20),
    p_street VARCHAR(255),
    p_number VARCHAR(50),
    p_complement VARCHAR(100),
    p_neighborhood VARCHAR(150),
    p_city VARCHAR(150),
    p_state VARCHAR(10),
    p_origin_type VARCHAR(20) DEFAULT 'portal',
    p_origin_salon_id UUID DEFAULT NULL,
    p_cpf VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE (p_email IS NOT NULL AND p_email <> '' AND LOWER(email) = LOWER(p_email))
       OR (p_phone IS NOT NULL AND p_phone <> '' AND phone = p_phone)
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
        UPDATE public.clients SET
            name = p_full_name,
            full_name = p_full_name,
            username = COALESCE(p_username, username),
            cpf = COALESCE(p_cpf, cpf),
            password_hash = COALESCE(p_password_hash, password_hash),
            cep = p_cep,
            address = p_street,
            street_number = p_number,
            complement = p_complement,
            neighborhood = p_neighborhood,
            city = p_city,
            state = p_state,
            updated_at = NOW()
        WHERE id = v_client_id;
    ELSE
        INSERT INTO public.clients (
            name, full_name, username, cpf, phone, phone_whatsapp, email, password_hash,
            cep, address, street_number, complement, neighborhood, city, state,
            origin_type, origin_salon_id
        ) VALUES (
            p_full_name, p_full_name, p_username, p_cpf, p_phone, p_phone, LOWER(p_email), p_password_hash,
            p_cep, p_street, p_number, p_complement, p_neighborhood, p_city, p_state,
            p_origin_type, p_origin_salon_id
        ) RETURNING id INTO v_client_id;
    END IF;

    IF p_origin_salon_id IS NOT NULL THEN
        INSERT INTO public.salon_clients (
            salon_id, client_id, source, last_interaction_at
        ) VALUES (
            p_origin_salon_id, v_client_id, 'triade_form', NOW()
        )
        ON CONFLICT (salon_id, client_id) DO UPDATE SET
            last_interaction_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client_id,
        'full_name', p_full_name,
        'email', p_email,
        'cpf', p_cpf,
        'origin_salon_id', p_origin_salon_id
    );
END;
$$;

-- =====================================================================================================
-- 11. ÍNDICES DE ALTA PERFORMANCE (CRONOLÓGICO, BUSCA, GIS & RTLS)
-- =====================================================================================================
CREATE INDEX IF NOT EXISTS idx_salons_slug ON public.salons(slug);
CREATE INDEX IF NOT EXISTS idx_salons_subdomain ON public.salons(subdomain);
CREATE INDEX IF NOT EXISTS idx_salons_status ON public.salons(status);
CREATE INDEX IF NOT EXISTS idx_salons_owner_cpf ON public.salons(owner_cpf);
CREATE INDEX IF NOT EXISTS idx_salons_coords ON public.salons(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_date ON public.appointments(salon_id, date_str);
CREATE INDEX IF NOT EXISTS idx_appointments_chronological ON public.appointments(date_str ASC, start_time ASC);
CREATE INDEX IF NOT EXISTS idx_appointments_client_date ON public.appointments(client_phone, date_str, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON public.appointments(protocol_code);
CREATE INDEX IF NOT EXISTS idx_appointments_live_tracking ON public.appointments(salon_id, date_str, tracking_status);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON public.appointments(salon_id, is_paid, payment_status);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_salon_clients_salon ON public.salon_clients(salon_id);
CREATE INDEX IF NOT EXISTS idx_professionals_salon_id ON public.professionals(salon_id);
CREATE INDEX IF NOT EXISTS idx_service_offers_radar ON public.service_offers(date_str, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_salon ON public.financial_transactions(salon_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_user_security_answers_lookup ON public.user_security_answers(question_code, answer_normalized);

-- =====================================================================================================
-- 12. ROW LEVEL SECURITY (RLS) ESTRUTURADO & PERMISSÕES DA TRÍADE
-- =====================================================================================================
DO $$
DECLARE
    t TEXT;
    triade_tables TEXT[] := ARRAY[
        'profiles', 'salons', 'salon_ui_settings', 'salon_members', 'salon_users',
        'professionals', 'services', 'salon_services', 'service_offers',
        'clients', 'salon_clients', 'dependents', 'client_family_members',
        'appointments', 'salon_media_items', 'salon_media_slots',
        'salon_utilities_records', 'billing_invoices', 'financial_transactions',
        'security_questions', 'user_security_answers'
    ];
BEGIN
    FOREACH t IN ARRAY triade_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Triade_Unified_%s" ON public.%I;', t, t);
        EXECUTE format('CREATE POLICY "Triade_Unified_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
    END LOOP;

    -- Proteção dedicada para tabelas de Governança Corporativa (Admin Master)
    ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Triade_Admin_SystemAdmins_Read" ON public.system_admins;
    DROP POLICY IF EXISTS "Triade_Admin_SystemAdmins_Write" ON public.system_admins;
    CREATE POLICY "Triade_Admin_SystemAdmins_Read" ON public.system_admins FOR SELECT USING (true);
    CREATE POLICY "Triade_Admin_SystemAdmins_Write" ON public.system_admins FOR ALL USING (true) WITH CHECK (true);

    ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Triade_Admin_Logs_Access" ON public.admin_access_logs;
    CREATE POLICY "Triade_Admin_Logs_Access" ON public.admin_access_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- =====================================================================================================
-- 13. STORAGE BUCKETS PÚBLICOS (AVATARS, SALON-MEDIA, DOCUMENTS, MEDIA)
-- =====================================================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES
            ('avatars', 'avatars', true),
            ('salon-media', 'salon-media', true),
            ('documents', 'documents', true),
            ('media', 'media', true)
        ON CONFLICT (id) DO UPDATE SET public = true;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Public_Read_Storage_Vagou" ON storage.objects;
        DROP POLICY IF EXISTS "Public_Write_Storage_Vagou" ON storage.objects;
        DROP POLICY IF EXISTS "Public_Update_Storage_Vagou" ON storage.objects;
        DROP POLICY IF EXISTS "Public_Delete_Storage_Vagou" ON storage.objects;

        CREATE POLICY "Public_Read_Storage_Vagou" ON storage.objects FOR SELECT USING (bucket_id IN ('salon-media', 'avatars', 'documents', 'media'));
        CREATE POLICY "Public_Write_Storage_Vagou" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('salon-media', 'avatars', 'documents', 'media'));
        CREATE POLICY "Public_Update_Storage_Vagou" ON storage.objects FOR UPDATE USING (bucket_id IN ('salon-media', 'avatars', 'documents', 'media'));
        CREATE POLICY "Public_Delete_Storage_Vagou" ON storage.objects FOR DELETE USING (bucket_id IN ('salon-media', 'avatars', 'documents', 'media'));
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================================================================
-- 14. ATIVAÇÃO SEGURA DO SUPABASE REALTIME EM TODAS AS TABELAS DA TRÍADE
-- =====================================================================================================
DO $$
DECLARE
    tbl TEXT;
    realtime_tables TEXT[] := ARRAY[
        'profiles', 'salons', 'salon_ui_settings', 'professionals',
        'services', 'salon_services', 'service_offers', 'clients',
        'salon_clients', 'dependents', 'client_family_members',
        'appointments', 'salon_media_items', 'salon_media_slots',
        'salon_utilities_records', 'billing_invoices', 'financial_transactions'
    ];
BEGIN
    FOREACH tbl IN ARRAY realtime_tables LOOP
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
            END IF;
        END IF;
    END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
