-- ==============================================================================
-- 📜 ECOSSISTEMA VAGOUAPP — ESQUEMA DE BANCO DE DADOS SUPABASE (POSTGRESQL + POSTGIS)
-- Versão: 2.2.0 (Tríade Oficial Consolidada: Portal Cliente, Meu Negócio, Admin Vagou)
-- Atualização: PostGIS, Modelos Operacionais, Realtime, Mídias de Impacto, 
--              Gatilho de Reserva Automática, Avaliações e RPCs Otimizadas.
-- ==============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Tabela de Estabelecimentos e Profissionais Autônomos
CREATE TABLE IF NOT EXISTS public.salons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    trade_name VARCHAR(150) NOT NULL,            -- Nome Fantasia / Nome Comercial
    legal_name VARCHAR(150),                     -- Razão Social
    document_type VARCHAR(10) DEFAULT 'CNPJ',    -- 'CNPJ' ou 'CPF'
    document_number VARCHAR(30),                 -- Número do Documento
    legal_representative VARCHAR(100),           -- Nome do Responsável Legal / Titular
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Gestor autenticado
    
    -- Modelo Operacional
    operating_model VARCHAR(30) DEFAULT 'team',  -- 'solo', 'team', 'home_delivery', 'hybrid'
    
    -- Atendimento em Domicílio / Condomínio
    home_delivery_enabled BOOLEAN DEFAULT FALSE,
    home_delivery_area TEXT,                     -- Descrição das áreas/condomínios atendidos
    home_delivery_travel_fee NUMERIC(10,2) DEFAULT 0.00, -- Taxa de deslocamento (R$)
    home_delivery_is_free_condo BOOLEAN DEFAULT FALSE,   -- Isento para moradores do condomínio base
    home_delivery_max_distance_km NUMERIC(5,1) DEFAULT 15.0,
    
    -- Contatos
    phone_whatsapp VARCHAR(20) NOT NULL,         -- WhatsApp Principal para reservas
    phone_landline VARCHAR(20),
    email VARCHAR(120) NOT NULL,
    
    -- Localização e GIS
    address TEXT NOT NULL,
    neighborhood VARCHAR(80) NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(2) DEFAULT 'SP',
    postal_code VARCHAR(15),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),                  -- PostGIS Point para cálculo geoespacial
    
    -- Identidade Visual PWA & Theming
    logo_url TEXT,                               -- Logotipo padrão
    logo_light_url TEXT,                         -- Logotipo versão Clara
    logo_dark_url TEXT,                          -- Logotipo versão Escura
    app_icon_url TEXT,                           -- Ícone do app
    banner_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#20C933',
    secondary_color VARCHAR(7) DEFAULT '#0F172A',
    custom_domain VARCHAR(150) UNIQUE,
    
    -- Avaliações & Reputação
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    rating_count INT DEFAULT 1,
    
    -- Governança & Status
    registration_level INT DEFAULT 1,            -- 1: Básico, 2: Em Prazo, 3: Verificado
    registration_due_date TIMESTAMPTZ,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Faturamento Vagou (Admin)
    billing_model VARCHAR(30) DEFAULT 'PER_APPOINTMENT', -- 'PER_APPOINTMENT', 'SUBSCRIPTION', 'HYBRID', 'EXEMPT'
    commission_type VARCHAR(20) DEFAULT 'FIXED',         -- 'FIXED' ou 'PERCENTAGE'
    commission_value NUMERIC(10,2) DEFAULT 1.50,         -- R$ 1,50 por agendamento inicial
    subscription_monthly_fee NUMERIC(10,2) DEFAULT 0.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices Espaciais e de Busca
CREATE INDEX IF NOT EXISTS salons_geom_idx ON public.salons USING GIST (geom);
CREATE INDEX IF NOT EXISTS salons_slug_idx ON public.salons (slug);
CREATE INDEX IF NOT EXISTS salons_owner_idx ON public.salons (owner_user_id);

-- Trigger para manter PostGIS geom sincronizado
CREATE OR REPLACE FUNCTION update_salon_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_salon_geom ON public.salons;
CREATE TRIGGER trg_update_salon_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.salons
FOR EACH ROW EXECUTE FUNCTION update_salon_geom();


-- 3. Tabela de Profissionais (Equipe ou Dono Solitário)
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(60) NOT NULL,                   -- ex: "Master Barber", "Cabeleireira"
    avatar_url TEXT,
    phone VARCHAR(20),
    specialties TEXT[] NOT NULL DEFAULT '{}',
    color_hex VARCHAR(7) DEFAULT '#20C933',
    slot_duration_minutes INT DEFAULT 30,
    is_owner BOOLEAN DEFAULT FALSE,
    system_role VARCHAR(20) DEFAULT 'admin',     -- 'admin', 'staff', 'receptionist'
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    rating_count INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    schedule_config JSONB DEFAULT '[]'::jsonb,   -- Expediente semanal configurado
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS professionals_salon_idx ON public.professionals (salon_id, is_active);


-- 4. Tabela de Serviços Ofertados
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    category VARCHAR(60) NOT NULL DEFAULT 'Geral', -- 'Cabelo', 'Barba', 'Unhas', 'Estética', 'Sobrancelha'
    price NUMERIC(10,2) NOT NULL,
    promotional_price NUMERIC(10,2),
    duration_estimated VARCHAR(30) DEFAULT '30 min',
    duration_minutes INT DEFAULT 30,
    is_home_delivery_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    video_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_salon_idx ON public.services (salon_id, is_active);
CREATE INDEX IF NOT EXISTS services_category_idx ON public.services (category);


-- 5. Biblioteca de Mídias de Impacto (Máximo 5 Slots por Salão)
CREATE TABLE IF NOT EXISTS public.salon_media_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    slot_number INT CHECK (slot_number BETWEEN 1 AND 5),
    media_type VARCHAR(10) NOT NULL,             -- 'video' (5s) ou 'image'
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    title VARCHAR(100),
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salon_id, slot_number)
);


-- 6. Tabela de Vagas Relâmpago do Radar
CREATE TABLE IF NOT EXISTS public.service_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    original_price NUMERIC(10,2) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    date_str DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Mídia associada
    media_level INT DEFAULT 1,                   -- 1: Fallback, 2: Carrossel Fotos, 3: Vídeo 5s
    video_url TEXT,
    gallery_images TEXT[] DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'AVAILABLE',      -- 'AVAILABLE', 'BOOKED', 'EXPIRED', 'CANCELLED'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offers_status_expires_idx ON public.service_offers (status, expires_at);
CREATE INDEX IF NOT EXISTS offers_salon_idx ON public.service_offers (salon_id);


-- 7. Tabela de Clientes Finais
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone_whatsapp VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    push_token TEXT,
    push_enabled BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    favorite_salon_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_auth_user_idx ON public.clients (auth_user_id);


-- 8. Tabela Central de Agendamentos Efetivados
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_code VARCHAR(16) UNIQUE NOT NULL,    -- ex: 'VG-9482'
    offer_id UUID REFERENCES public.service_offers(id) ON DELETE SET NULL,
    salon_id UUID NOT NULL REFERENCES public.salons(id),
    professional_id UUID NOT NULL REFERENCES public.professionals(id),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    
    -- Dados do Cliente
    client_name VARCHAR(120) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    client_email VARCHAR(120),
    
    -- Tipo de Atendimento
    service_type VARCHAR(30) DEFAULT 'IN_SALON',  -- 'IN_SALON' ou 'HOME_DELIVERY'
    client_address TEXT,                         -- Condomínio, Bloco, Apto (se a domicílio)
    travel_fee NUMERIC(10,2) DEFAULT 0.00,
    
    -- Serviço & Valores
    service_title VARCHAR(120) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(10,2) GENERATED ALWAYS AS (price + travel_fee) STORED,
    date_str DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Estados
    status VARCHAR(30) DEFAULT 'CONFIRMADO',     -- 'CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO', 'NO_SHOW'
    
    -- Controle de Faturamento
    commission_fee NUMERIC(10,2) NOT NULL DEFAULT 1.50,
    billed_in_invoice_id UUID,
    
    booked_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appts_salon_status_idx ON public.appointments (salon_id, status, date_str);
CREATE INDEX IF NOT EXISTS appts_client_idx ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS appts_protocol_idx ON public.appointments (protocol_code);


-- 9. Tabela de Faturamento / Fechamento Mensal (Admin)
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    month_reference VARCHAR(7) NOT NULL,         -- 'YYYY-MM'
    billing_model VARCHAR(30) DEFAULT 'PER_APPOINTMENT',
    total_appointments INT DEFAULT 0,
    total_gmv NUMERIC(12,2) DEFAULT 0.00,
    commission_per_appointment NUMERIC(10,2) DEFAULT 1.50,
    vagou_commission_total NUMERIC(10,2) DEFAULT 0.00,
    subscription_fee NUMERIC(10,2) DEFAULT 0.00,
    total_amount_due NUMERIC(10,2) GENERATED ALWAYS AS (vagou_commission_total + subscription_fee) STORED,
    status VARCHAR(20) DEFAULT 'PENDING',
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salon_id, month_reference)
);


-- ==============================================================================
-- 🚀 GATILHOS INTELIGENTES (TRIGGERS)
-- ==============================================================================

-- Gatilho para marcar a vaga relâmpago como BOOKED assim que o agendamento for inserido
CREATE OR REPLACE FUNCTION on_appointment_booked_offer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.offer_id IS NOT NULL THEN
        UPDATE public.service_offers
        SET status = 'BOOKED'
        WHERE id = NEW.offer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_appointment_booked_offer ON public.appointments;
CREATE TRIGGER trg_on_appointment_booked_offer
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION on_appointment_booked_offer();


-- ==============================================================================
-- 🌐 FUNÇÃO RPC POSTGIS — RADAR POR RAIO DE KM
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_offers_in_radius(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 5.0,
    filter_category VARCHAR DEFAULT NULL
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
    rating_count INT,
    service_title VARCHAR,
    category VARCHAR,
    price NUMERIC,
    original_price NUMERIC,
    date_str DATE,
    start_time TIME,
    end_time TIME,
    media_level INT,
    video_url TEXT,
    gallery_images TEXT[],
    distance_meters INT,
    distance_km NUMERIC,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id AS offer_id,
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
        p.name AS professional_name,
        p.avatar_url AS professional_avatar,
        s.rating_avg,
        s.rating_count,
        o.service_title,
        o.category,
        o.price,
        o.original_price,
        o.date_str,
        o.start_time,
        o.end_time,
        o.media_level,
        o.video_url,
        o.gallery_images,
        ROUND(ST_Distance(s.geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography))::INT AS distance_meters,
        ROUND((ST_Distance(s.geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000.0)::NUMERIC, 1) AS distance_km,
        o.expires_at
    FROM public.service_offers o
    JOIN public.salons s ON o.salon_id = s.id
    JOIN public.professionals p ON o.professional_id = p.id
    WHERE o.status = 'AVAILABLE'
      AND o.expires_at > NOW()
      AND (filter_category IS NULL OR filter_category = 'todos' OR o.category ILIKE '%' || filter_category || '%')
      AND ST_DWithin(s.geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_km * 1000)
    ORDER BY distance_meters ASC, o.expires_at ASC;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- ⚡ SUPABASE REALTIME (NOTIFICAÇÕES INSTANTÂNEAS)
-- ==============================================================================

DO $$
BEGIN
    -- Adicionar tabelas à publicação realtime se existirem
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.service_offers;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;


-- ==============================================================================
-- 🔒 POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_media_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- 1. SALONS
DROP POLICY IF EXISTS "Public salons are viewable by everyone" ON public.salons;
CREATE POLICY "Public salons are viewable by everyone" 
ON public.salons FOR SELECT 
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Owners can update their own salon" ON public.salons;
CREATE POLICY "Owners can update their own salon" 
ON public.salons FOR ALL 
USING (auth.uid() = owner_user_id);

-- 2. PROFESSIONALS
DROP POLICY IF EXISTS "Active professionals are viewable by everyone" ON public.professionals;
CREATE POLICY "Active professionals are viewable by everyone" 
ON public.professionals FOR SELECT 
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Salon owners can manage professionals" ON public.professionals;
CREATE POLICY "Salon owners can manage professionals" 
ON public.professionals FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.salons 
        WHERE salons.id = professionals.salon_id 
        AND salons.owner_user_id = auth.uid()
    )
);

-- 3. SERVICES
DROP POLICY IF EXISTS "Active services are viewable by everyone" ON public.services;
CREATE POLICY "Active services are viewable by everyone" 
ON public.services FOR SELECT 
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Salon owners can manage services" ON public.services;
CREATE POLICY "Salon owners can manage services" 
ON public.services FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.salons 
        WHERE salons.id = services.salon_id 
        AND salons.owner_user_id = auth.uid()
    )
);

-- 4. SERVICE_OFFERS (Radar)
DROP POLICY IF EXISTS "Available offers are viewable by everyone" ON public.service_offers;
CREATE POLICY "Available offers are viewable by everyone" 
ON public.service_offers FOR SELECT 
USING (status = 'AVAILABLE' AND expires_at > NOW());

DROP POLICY IF EXISTS "Salon owners can manage offers" ON public.service_offers;
CREATE POLICY "Salon owners can manage offers" 
ON public.service_offers FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.salons 
        WHERE salons.id = service_offers.salon_id 
        AND salons.owner_user_id = auth.uid()
    )
);

-- 5. APPOINTMENTS
DROP POLICY IF EXISTS "Clients can view their own appointments" ON public.appointments;
CREATE POLICY "Clients can view their own appointments" 
ON public.appointments FOR SELECT 
USING (
    auth.uid() IS NOT NULL AND (
        client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.salons 
            WHERE salons.id = appointments.salon_id 
            AND salons.owner_user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
CREATE POLICY "Anyone can create appointments" 
ON public.appointments FOR INSERT 
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Salon owners can manage their salon appointments" ON public.appointments;
CREATE POLICY "Salon owners can manage their salon appointments" 
ON public.appointments FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.salons 
        WHERE salons.id = appointments.salon_id 
        AND salons.owner_user_id = auth.uid()
    )
);

-- 6. CLIENTS
DROP POLICY IF EXISTS "Clients can manage their own profile" ON public.clients;
CREATE POLICY "Clients can manage their own profile" 
ON public.clients FOR ALL 
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can insert their profile on signup" ON public.clients;
CREATE POLICY "Clients can insert their profile on signup" 
ON public.clients FOR INSERT 
WITH CHECK (auth_user_id = auth.uid());
