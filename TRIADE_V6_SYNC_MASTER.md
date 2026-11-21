# 🏛️ COMUNICADO MESTRE & MANUAL DE ADAPTAÇÃO DA TRÍADE — VAGOUAPP v6.0

> **STATUS OFICIAL:** ✅ **BANCO SUPABASE v6.0 APLICADO E VALIDADO EM PRODUÇÃO (`Success. No rows returned`)**  
> **Data:** 2026-11-21  
> **Emissor:** `mnvapp` — Meu Negócio VagouApp (`https://github.com/nexuscrwd/vagouapp.git`)  
> **Destinatários Obrigatórios:**  
> 1. **`admvapp`** — Admin VagouApp (`https://github.com/nexuscrwd/admin.vagouapp.git` • `adm.vagouapp.com`)  
> 2. **`pvapp`** — Portal VagouApp (`https://github.com/nexuscrwd/Portal-VagouApp.git` • `portal.vagouapp.com`)  
> **Instância Supabase Compartilhada:** `https://xemenxdhuoekytyhmgyt.supabase.co`

---

## 🎯 1. Objetivo deste Documento

O banco de dados compartilhado da Tríade VagouApp passou pelo **Reset Cirúrgico e Reconstrução Definitiva v6.0** (`bol-205` + hotfix `bol-206`). Este arquivo contém:
1. O resumo completo de todas as mudanças arquiteturais, de segurança, mídia binária, Web Push, Realtime e banco de dados.
2. O **checklist obrigatório e cirúrgico** do que o **`admvapp`** e o **`pvapp`** devem adaptar imediatamente no código.
3. Os **contratos de variáveis de ambiente e endpoints backend (`server.ts`)**.
4. O **código SQL v6.0 COMPLETO E EXATO** aplicado em produção (ao final deste arquivo) para leitura integral pelos agentes de cada repositório.

> ⚠️ **REGRA DE OURO A PARTIR DE HOJE:**  
> O reset destrutivo encerrou a fase de rascunho. A partir da **v6.0**, toda evolução futura no banco da Tríade será **exclusivamente incremental e aditiva** (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`), preservando 100% dos dados em produção.

---

## 🚀 2. O Que Mudou na Arquitetura v6.0 (Resumo Executivo)

### 2.1. Schema Normalizado em 23 Tabelas (ZERO Tabelas Espelho)
Todas as tabelas duplicadas/legadas foram **eliminadas permanentemente**:

| Tabela Eliminada (❌ NÃO EXISTE MAIS) | Tabela Oficial v6.0 (✅ USAR EXCLUSIVAMENTE) | Observação Técnica |
| :--- | :--- | :--- |
| `salon_services` | **`public.services`** | Catálogo único de serviços por salão. |
| `client_family_members` | **`public.dependents`** | Trigger `trg_sync_dependents_count` atualiza `clients.dependents_count` automaticamente. |
| `platform_admins` | **`public.system_admins`** | Autenticado via Supabase Auth JWT + `verify_admin_login` (`pgcrypto` bcrypt). |
| `salon_users` | **`public.salon_members`** + **`public.profiles`** | Vínculo RBAC multi-tenant (`owner`, `manager`, `professional`, `receptionist`) ligado a `auth.users`. |
| `salon_media_items` | **`public.media_assets`** | Catálogo binário no Storage; usar coluna **`public_url`** (não `url`). |

> ✅ **Compatibilidade garantida com o `pvapp`:** `public.service_offers` e a RPC geoespacial `public.get_offers_in_radius(p_lat, p_lng, p_radius_km, p_category)` foram **100% preservadas e otimizadas**.

---

### 2.2. Política Estrita de Mídia Binária (ZERO Base64 no Banco)
- **Bloqueio rígido no PostgreSQL:** Todas as colunas de mídia (`avatar_url`, `logo_url`, `cover_url`, `cover_image_url`, `favicon_url`, `facade_photo_url`, `interior_photo_url`, `image_url`, `video_url`, `public_url`, `app_logo_light_url`, `app_logo_dark_url`, `app_icon_url`) possuem `CHECK (public.is_valid_media_url(...))` que **rejeita qualquer string iniciada com `data:`** (Base64).
- **4 Buckets Oficiais no Supabase Storage (públicos para leitura, protegidos para escrita):**
  1. `avatars` (até 5 MB — WebP/JPEG/PNG/GIF)
  2. `branding` (até 10 MB — WebP/JPEG/PNG/SVG)
  3. `services` (até 15 MB — WebP/JPEG/PNG/MP4/WebM)
  4. `salon-media` (até 50 MB — WebP/JPEG/PNG/MP4/WebM)
- **Regra Crítica do Supabase (`storage.protect_delete()` — Hotfix `bol-206`):**
  - O Supabase **bloqueia `DELETE FROM storage.objects` direto via SQL** (`ERROR 42501`).
  - Por isso, ao excluir ou substituir um registro em `public.media_assets`, o trigger `trg_cleanup_storage_orphans` **enfileira o arquivo em `public.storage_cleanup_queue` com `status = 'pending'`**.
  - A remoção física do arquivo no bucket deve ser executada **exclusivamente pelo backend (`server.ts`) via Supabase Storage API oficial** (`supabaseAdmin.storage.from(bucket).remove([path])`), atualizando o registro na fila para `status = 'deleted'`.

---

### 2.3. Autenticação Supabase Auth JWT + RLS Estrito por Tenant
- **ZERO `service_role` no frontend:** É **terminantemente proibido** expor `VITE_SUPABASE_SERVICE_ROLE_KEY` ou instanciar client administrativo no navegador.
- **RLS ativo nas 23 tabelas** utilizando helpers `SECURITY DEFINER` sem recursão:
  - `public.is_super_admin()`
  - `public.is_salon_member(p_salon_id UUID)`
  - `public.is_salon_owner(p_salon_id UUID)`
  - `public.current_client_id()`
- **Papéis no JWT (`auth.users.raw_app_meta_data->>'role'`):** `'super_admin' | 'salon_owner' | 'salon_staff' | 'client'`.
- **Extensões no schema `extensions` (`bol-206`):** `pgcrypto`, `uuid-ossp` e `pg_trgm` vivem no schema `extensions`. Qualquer RPC `SECURITY DEFINER` que use `crypt()` ou `gen_salt()` deve incluir `extensions` no `SET search_path`.

---

### 2.4. Automações Nativas por Triggers PostgreSQL
1. **Auditoria & Origem (`created_via`):** Rastreia automaticamente origem (`mnvapp`, `pvapp`, `admvapp`).
2. **Propagação Automática de Identidade por CPF (`trg_propagate_cpf_identity`):** Quando nome, e-mail, telefone, endereço, coordenadas ou `avatar_url` são atualizados para um CPF, o Postgres sincroniza automaticamente entre `profiles`, `clients`, `professionals`, `salons` e `system_admins`.
3. **Anti-Colisão Geotemporal Inter-Salões (`trg_prevent_inter_salon_collision` + `check_client_inter_salon_collision`):** Impede que o mesmo cliente agende horários impossíveis de deslocamento entre salões diferentes (usando cálculo Haversine + buffer de trânsito).
4. **CRM & Fluxo de Caixa Automático (`trg_sync_appointment_crm_cashflow`):** Atualiza métricas do cliente em `salon_clients` (`total_appointments`, `total_spent`, `last_visit_at`) e cria automaticamente a entrada de receita em `financial_transactions` quando o agendamento é concluído (`completed`).
5. **Fila Transacional de Notificações Web Push (`trg_enqueue_appointment_push`):** Ao criar, confirmar, cancelar ou atualizar status de deslocamento RTLS de um agendamento, insere automaticamente o evento na tabela `public.notification_outbox`.
6. **Fila de Expurgo de Storage (`trg_cleanup_storage_orphans`):** Enfileira arquivos órfãos em `public.storage_cleanup_queue` (`status = 'pending'`).

---

### 2.5. Web Push Nativo (VAPID) + Supabase Realtime Unificado
- **Web Push Nativo:** Service Worker (`public/sw.js` com listeners `push` e `notificationclick`) + tabela `public.push_subscriptions` + fila `public.notification_outbox` + envio server-side via biblioteca `web-push` (`import * as webpush from 'web-push'`).
- **Supabase Realtime (`supabase_realtime` + `REPLICA IDENTITY FULL`):** Publicação ativa nas 14 tabelas operacionais e visuais:
  `salons`, `salon_ui_settings`, `services`, `service_offers`, `professionals`, `appointments`, `clients`, `dependents`, `media_assets`, `financial_transactions`, `salon_utilities_records`, `notification_outbox`, `admin_preferences`, `salon_clients`.

---

### 2.6. Seed Mínimo Pós-Reset & Bootstrap Travado do 1º Super Admin
O banco nasce **100% limpo** (zero salões fake, zero clientes fictícios, zero admins hardcoded), contendo apenas:
1. As **3 perguntas de segurança oficiais** em `public.security_questions` (`sq_1`, `sq_2`, `sq_3`).
2. O registro neutro `'global'` em `public.admin_preferences`.
3. A RPC auto-travante **`public.bootstrap_initial_super_admin(...)`**: funciona **uma única vez** enquanto `system_admins` estiver vazia. Após o 1º Super Admin ser criado, ela se bloqueia permanentemente.

---

## 🛠️ 3. O Que o `admvapp` (`adm.vagouapp.com`) DEVE Fazer Agora

### Checklist Obrigatório para o Agente do `admvapp`:

1. **Eliminar 100% de Base64 nos 5 pontos auditados:**
   - Remover `FileReader.readAsDataURL` e `canvas.toDataURL` para persistência no banco.
   - Migrar para upload binário (`canvas.toBlob` ➔ `File` WebP/PNG ➔ `FormData` em `POST /api/media/upload` ou `supabase.storage.from(bucket).upload(...)` + registro em `public.media_assets`):
     - `src/components/AdminPreferencesPanel.tsx` ➔ bucket `branding` (`app_logo_light_url`, `app_logo_dark_url`, `app_icon_url`).
     - `src/components/AdminUserGeneralDataModal.tsx` ➔ bucket `avatars` (`avatar_url`).
     - `src/components/TriadeEstablishmentMasterForm.tsx` ➔ buckets `branding` e `salon-media` (`logo_url`, `cover_url`, `facade_photo_url`, `interior_photo_url`).
     - `src/context/ThemeContext.tsx` ➔ aceitar exclusivamente URLs HTTP(S) do Storage (rejeitar `data:`).
     - `src/services/supabaseApi.ts` ➔ adicionar validação `isSafeMediaUrl()` bloqueando strings `^data:` antes de enviar ao Supabase.

2. **Remover Todas as Referências a Tabelas Espelho Eliminadas:**
   - Substituir `salon_services` ➔ **`services`**
   - Substituir `client_family_members` ➔ **`dependents`**
   - Substituir `platform_admins` ➔ **`system_admins`**
   - Substituir `salon_media_items` ➔ **`media_assets`** (usar `public_url`)
   - Substituir `salon_users` ➔ **`salon_members`** (com join em `profiles` quando precisar de nome/e-mail/CPF)

3. **Blindar Segurança & Remover `service_role` do Frontend:**
   - Excluir qualquer referência a `VITE_SUPABASE_SERVICE_ROLE_KEY` no código client-side e no `vite.config.ts`.
   - Mover operações administrativas privilegiadas para rotas protegidas no backend `server.ts` usando `process.env.SUPABASE_SERVICE_ROLE_KEY`.

4. **Implementar Tela/Rota de Primeiro Acesso (Bootstrap Super Admin) & Login JWT:**
   - Implementar `POST /api/admin/bootstrap` no `server.ts` (cria conta em `auth.users` com `app_metadata: { role: 'super_admin' }` e chama `public.bootstrap_initial_super_admin(...)`).
   - Autenticar administradores via Supabase Auth JWT (`signInWithPassword`) + verificação em `system_admins` / `verify_admin_login`.
   - Exibir o fluxo de "Configuração Inicial do 1º Super Admin" apenas quando `system_admins` tiver 0 registros.

5. **Implementar Rotas Backend de Mídia Binária, Limpeza Storage API e Web Push:**
   - Adicionar no `server.ts` (usando `import * as webpush from 'web-push'` para compatibilidade ESM Node 22):
     - `POST /api/media/upload` (recebe multipart `multer`, otimiza com `sharp`, grava no bucket correto e insere em `public.media_assets`).
     - `DELETE /api/media/:id` (remove via `supabaseAdmin.storage.from(bucket).remove([path])` + apaga em `media_assets`).
     - `POST /api/storage/cleanup` (drena registros `status = 'pending'` de `public.storage_cleanup_queue` usando a **Supabase Storage API oficial**, nunca SQL direto).
     - `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/dispatch`.
   - Configurar `vite.config.ts` com `server: { hmr: false }` para evitar colisão de porta WebSocket (`24678`).

6. **Ativar Realtime Unificado (`realtimeHub.ts`) e Service Worker (`public/sw.js`):**
   - Inscrever-se em `salons`, `system_admins`, `admin_preferences`, `billing_invoices`, `appointments`, `media_assets` e `notification_outbox` para refletir mudanças de `mnvapp` e `pvapp` em tempo real sem F5.

---

## 🌍 4. O Que o `pvapp` (`portal.vagouapp.com`) DEVE Fazer Agora

### Checklist Obrigatório para o Agente do `pvapp`:

1. **Alinhar Queries às 23 Tabelas Oficiais (Sem Fallbacks Legados):**
   - **Radar & Vagas Relâmpago:** Manter uso de `public.service_offers` e da RPC `public.get_offers_in_radius(p_lat, p_lng, p_radius_km, p_category)` — assinatura preservada.
   - **Serviços dos Salões:** Ler exclusivamente de **`public.services`** (remover qualquer fallback para `salon_services`).
   - **Galeria / Stories / Mídia dos Salões:** Ler exclusivamente de **`public.media_assets`** usando **`public_url`** (remover qualquer leitura de `salon_media_items`).
   - **Conta Família / Dependentes:** Ler e gravar exclusivamente em **`public.dependents`** (remover qualquer referência a `client_family_members`).

2. **Eliminar Base64 no Perfil do Cliente:**
   - Remover `FileReader.readAsDataURL` e `canvas.toDataURL` ao enviar foto de perfil do cliente/dependente.
   - Enviar arquivo binário (WebP/PNG/JPEG) para o bucket **`avatars`** (`POST /api/media/upload` ou Storage API) e salvar apenas a URL HTTPS resultante em `clients.avatar_url` / `profiles.avatar_url` / `dependents.avatar_url`.
   - Nunca tentar gravar strings iniciadas com `data:` (o Postgres recusará com erro de constraint `CHECK`).

3. **Tratar Anti-Colisão Geotemporal no Agendamento:**
   - Consultar disponibilidade via RPC **`public.get_busy_slots(p_salon_id, p_date_str, p_professional_id)`** (não expõe dados pessoais de outros clientes).
   - Ao inserir em `public.appointments`, capturar erros `P0001` disparados pelo trigger `trg_prevent_inter_salon_collision` e exibir mensagem amigável informando que o cliente já tem outro agendamento em conflito de horário/deslocamento.
   - Preencher `created_via = 'pvapp'` nos inserts originados pelo Portal.

4. **Integrar Web Push Nativo (VAPID) + Service Worker (`public/sw.js`):**
   - Usar a **mesma `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`** da Tríade.
   - Registrar a assinatura do consumidor em `public.push_subscriptions` (`POST /api/push/subscribe`) com `role = 'client'` e `client_id` para receber notificações automáticas de confirmação, cancelamento, lembretes e vagas relâmpago disparadas por `notification_outbox`.

5. **Integrar Realtime Unificado & Segurança JWT:**
   - Remover qualquer uso de `VITE_SUPABASE_SERVICE_ROLE_KEY` no frontend.
   - Assinar Realtime nas tabelas `service_offers`, `salons`, `salon_ui_settings`, `services`, `appointments` (do próprio cliente) e `media_assets` para refletir vagas relâmpago e atualizações de vitrine instantaneamente.
   - Garantir `server: { hmr: false }` no `vite.config.ts`.

---

## 🔐 5. Variáveis de Ambiente Padronizadas da Tríade (`.env`)

Todos os projetos da Tríade devem configurar estas variáveis (nunca expor chaves privadas no prefixo `VITE_`):

```env
# Supabase (Frontend Público)
VITE_SUPABASE_URL="https://xemenxdhuoekytyhmgyt.supabase.co"
VITE_SUPABASE_ANON_KEY="SEU_JWT_ANON_KEY"

# Supabase (Backend / server.ts EXCLUSIVAMENTE — NUNCA usar prefixo VITE_)
SUPABASE_SERVICE_ROLE_KEY="SEU_JWT_SERVICE_ROLE_KEY"

# Web Push Nativo VAPID (Mesmo par criptográfico na Tríade inteira)
VAPID_PUBLIC_KEY="CHAVE_PUBLICA_VAPID_87_CHARS"
VAPID_PRIVATE_KEY="CHAVE_PRIVADA_VAPID_43_CHARS"
VAPID_SUBJECT="mailto:app@vagouapp.com"

# Bootstrap do 1º Super Admin (usado 1 única vez pelo admvapp / mnvapp)
INITIAL_SUPER_ADMIN_EMAIL="app@vagouapp.com"
INITIAL_SUPER_ADMIN_NAME="Nexus VagouApp"
INITIAL_SUPER_ADMIN_USERNAME="vapp@"
INITIAL_SUPER_ADMIN_PASSWORD="SENHA_FORTE_DO_COFRE"

# Google Maps & IA
VITE_GOOGLE_MAPS_API_KEY="SUA_CHAVE_GOOGLE_MAPS"
GEMINI_API_KEY="SUA_CHAVE_GEMINI"
```

---

## 📜 6. ANEXO INTEGRAL — CÓDIGO SQL v6.0 APLICADO EM PRODUÇÃO

> **Atenção Agentes (`admvapp` e `pvapp`):**  
> O SQL abaixo **JÁ FOI EXECUTADO COM SUCESSO** na instância Supabase de produção.  
> **NÃO** peçam ao usuário para rodar este reset novamente! Usem-no exclusivamente como **mapa completo e definitivo da verdade** para adaptar tipos TypeScript, queries, políticas RLS, triggers, RPCs, Storage e Realtime.

```sql
-- =====================================================================================================
-- 🏛️ VAGOUAPP v6.0 — RESET TOTAL & RECONSTRUÇÃO CIRÚRGICA DO BANCO SUPABASE
-- Origem: Tríade VagouApp (admvapp + mnvapp + suporte nativo pvapp)
-- Data: 2026-11-21
-- =====================================================================================================
-- ⚠️ AVISO CRÍTICO:
-- Este script APAGA toda a estrutura legada do schema `public` (tabelas, views, triggers, funções)
-- e recria o banco 100% normalizado do zero:
--   1. ZERO tabelas espelho (eliminadas: salon_services, client_family_members, platform_admins)
--   2. ZERO Base64/texto em imagens (Supabase Storage binário + tabela media_assets + CHECK !~* '^data:')
--   3. Web Push nativo (push_subscriptions + notification_outbox alimentado por Triggers)
--   4. Supabase Auth JWT nativo + RLS restrito por tenant (salon_id / auth.uid() / super_admin)
--   5. Triggers: Auditoria/Origem, CRM/Caixa, Anti-Colisão Geotemporal, Propagação por CPF, Limpeza Storage
--   6. Supabase Realtime unificado (REPLICA IDENTITY FULL) em todas as tabelas operacionais e visuais
--   7. Seed mínimo pós-reset: apenas as 3 perguntas de segurança + RPC travada de 1º Super Admin
-- =====================================================================================================

BEGIN;

-- =====================================================================================================
-- 1. RESET CIRÚRGICO DO SCHEMA PUBLIC (Limpeza de Storage feita via Storage API oficial)
-- =====================================================================================================
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- =====================================================================================================
-- 1.1. EXTENSÕES NECESSÁRIAS (no schema extensions para não sofrerem CASCADE)
-- =====================================================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- Nota Supabase: exclusão direta em storage.objects é bloqueada pela função nativa storage.protect_delete().
-- O expurgo de arquivos antigos nos buckets deve ser feito via Supabase Storage API (/api/storage/cleanup).

-- =====================================================================================================
-- 2. FUNÇÕES UTILITÁRIAS & HELPERS DE SEGURANÇA JWT (SEM RECURSÃO RLS)
-- =====================================================================================================
CREATE OR REPLACE FUNCTION public.normalize_digits(p_val TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p_val, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.is_valid_media_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_url IS NULL
      OR btrim(p_url) = ''
      OR (
        p_url !~* '^data:'
        AND p_url !~* '^javascript:'
        AND p_url !~* '^vbscript:'
        AND (p_url ~* '^https?://' OR p_url ~ '^/')
      );
$$;

-- =====================================================================================================
-- 3. TABELAS SOBERANAS v6.0 (ZERO ESPELHOS • ZERO BASE64)
-- =====================================================================================================

-- 3.1. IDENTIDADE GLOBAL (vinculada 1:1 a auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Usuário',
  username TEXT,
  cpf TEXT,
  cpf_digits TEXT GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')) STORED,
  phone TEXT,
  avatar_url TEXT CHECK (public.is_valid_media_url(avatar_url)),
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('super_admin', 'salon_owner', 'salon_staff', 'client')),
  address TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'São Paulo',
  state TEXT DEFAULT 'SP',
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  formatted_address TEXT,
  google_place_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp' CHECK (created_via IN ('admvapp', 'mnvapp', 'pvapp', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_profiles_email_lower ON public.profiles (lower(btrim(email)));
CREATE UNIQUE INDEX uq_profiles_cpf_digits ON public.profiles (cpf_digits) WHERE cpf_digits IS NOT NULL AND length(cpf_digits) = 11;
CREATE UNIQUE INDEX uq_profiles_username_lower ON public.profiles (lower(btrim(username))) WHERE username IS NOT NULL AND btrim(username) <> '';

-- 3.2. SUPER ADMINISTRADORES CORPORATIVOS (admvapp)
CREATE TABLE public.system_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  cpf TEXT,
  cpf_digits TEXT GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')) STORED,
  phone_whatsapp TEXT,
  avatar_url TEXT CHECK (public.is_valid_media_url(avatar_url)),
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'support')),
  access_level INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_via TEXT NOT NULL DEFAULT 'admvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_system_admins_email_lower ON public.system_admins (lower(btrim(email)));
CREATE UNIQUE INDEX uq_system_admins_username_lower ON public.system_admins (lower(btrim(username)));

-- 3.3. TRILHA DE AUDITORIA ADMINISTRATIVA
CREATE TABLE public.admin_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.system_admins(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_access_logs_created ON public.admin_access_logs (created_at DESC);

-- 3.4. PREFERÊNCIAS GLOBAIS DO ADMIN (admvapp)
CREATE TABLE public.admin_preferences (
  id TEXT PRIMARY KEY DEFAULT 'global',
  logo_dark_url TEXT CHECK (public.is_valid_media_url(logo_dark_url)),
  logo_light_url TEXT CHECK (public.is_valid_media_url(logo_light_url)),
  mobile_app_icon_url TEXT CHECK (public.is_valid_media_url(mobile_app_icon_url)),
  favicon_url TEXT CHECK (public.is_valid_media_url(favicon_url)),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5. PERGUNTAS DE SEGURANÇA & RESPOSTAS
CREATE TABLE public.security_questions (
  code TEXT PRIMARY KEY,
  question_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6. ESTABELECIMENTOS / SALÕES (TENANTS)
CREATE TABLE public.salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_cpf TEXT,
  owner_cpf_digits TEXT GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(owner_cpf, ''), '\D', '', 'g'), '')) STORED,
  slug TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT,
  category TEXT NOT NULL DEFAULT 'Barbearia & Beleza',
  description TEXT,
  slogan TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  -- Endereço e Geolocalização
  address TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'São Paulo',
  state TEXT DEFAULT 'SP',
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  formatted_address TEXT,
  google_place_id TEXT,
  -- Imagens Binárias via Storage (Zero Base64)
  logo_url TEXT CHECK (public.is_valid_media_url(logo_url)),
  logo_light_url TEXT CHECK (public.is_valid_media_url(logo_light_url)),
  logo_dark_url TEXT CHECK (public.is_valid_media_url(logo_dark_url)),
  cover_url TEXT CHECK (public.is_valid_media_url(cover_url)),
  favicon_url TEXT CHECK (public.is_valid_media_url(favicon_url)),
  facade_photo_url TEXT CHECK (public.is_valid_media_url(facade_photo_url)),
  interior_photo_url TEXT CHECK (public.is_valid_media_url(interior_photo_url)),
  -- Atendimento & Domicílio
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  amenities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  home_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  home_delivery_area TEXT,
  home_delivery_travel_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Financeiro Corporativo & PIX
  pix_key TEXT,
  pix_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  billing_plan TEXT NOT NULL DEFAULT 'per_booking' CHECK (billing_plan IN ('per_booking', 'monthly_subscription', 'enterprise', 'trial')),
  fee_per_booking NUMERIC(10, 2) NOT NULL DEFAULT 2.50,
  monthly_subscription_fee NUMERIC(10, 2) NOT NULL DEFAULT 89.90,
  billing_due_day INTEGER NOT NULL DEFAULT 10 CHECK (billing_due_day BETWEEN 1 AND 28),
  -- Governança
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp' CHECK (created_via IN ('admvapp', 'mnvapp', 'pvapp', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_salons_slug_lower ON public.salons (lower(btrim(slug)));
CREATE INDEX idx_salons_owner_id ON public.salons (owner_id);
CREATE INDEX idx_salons_owner_cpf_digits ON public.salons (owner_cpf_digits) WHERE owner_cpf_digits IS NOT NULL;
CREATE INDEX idx_salons_geo ON public.salons (latitude, longitude) WHERE is_active = TRUE;

-- 3.7. IDENTIDADE VISUAL TIPADA DA VITRINE (1:1 com salons — substitui JSONB genérico)
CREATE TABLE public.salon_ui_settings (
  salon_id UUID PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  default_theme TEXT NOT NULL DEFAULT 'light' CHECK (default_theme IN ('light', 'dark')),
  theme_preset_id TEXT NOT NULL DEFAULT 'neutral-light',
  primary_color TEXT NOT NULL DEFAULT '#334155',
  secondary_color TEXT NOT NULL DEFAULT '#1E293B',
  brand_font TEXT NOT NULL DEFAULT 'Poppins',
  pwa_name TEXT,
  show_slogan BOOLEAN NOT NULL DEFAULT TRUE,
  show_hero_slides BOOLEAN NOT NULL DEFAULT TRUE,
  welcome_style TEXT NOT NULL DEFAULT 'modern',
  logo_text_fallback TEXT,
  logo_text_color TEXT,
  -- Barra de Navegação Inferior
  nav_style TEXT NOT NULL DEFAULT 'solid',
  nav_shape TEXT NOT NULL DEFAULT 'square',
  nav_border BOOLEAN NOT NULL DEFAULT TRUE,
  nav_icon_border BOOLEAN NOT NULL DEFAULT FALSE,
  nav_bg_style TEXT NOT NULL DEFAULT 'solid',
  nav_bg_color TEXT NOT NULL DEFAULT '#F1F5F9',
  nav_btn_bg_color TEXT,
  nav_btn_active_bg_color TEXT DEFAULT '#FFFFFF',
  nav_active_color TEXT DEFAULT '#0F172A',
  nav_text_color TEXT DEFAULT '#475569',
  nav_btn_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  nav_btn_blur BOOLEAN NOT NULL DEFAULT FALSE,
  nav_btn_font TEXT,
  -- Cabeçalhos de Seção
  section_header_bg_color TEXT NOT NULL DEFAULT '#FFFFFF',
  section_header_text_color TEXT NOT NULL DEFAULT '#1E293B',
  section_header_icon_color TEXT NOT NULL DEFAULT '#475569',
  section_header_bg_style TEXT NOT NULL DEFAULT 'solid',
  section_header_border BOOLEAN NOT NULL DEFAULT TRUE,
  section_header_btn_bg_color TEXT,
  section_header_btn_active_bg_color TEXT,
  section_header_btn_border BOOLEAN NOT NULL DEFAULT TRUE,
  section_header_btn_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  section_header_btn_blur BOOLEAN NOT NULL DEFAULT FALSE,
  section_header_btn_font TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8. VÍNCULO MULTI-TENANT RBAC (salon_id <-> auth.users)
CREATE TABLE public.salon_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'professional' CHECK (role IN ('owner', 'manager', 'professional', 'receptionist')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, user_id)
);

CREATE INDEX idx_salon_members_user_id ON public.salon_members (user_id) WHERE is_active = TRUE;

-- 3.9. PROFISSIONAIS DA EQUIPE
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Profissional',
  access_level TEXT NOT NULL DEFAULT 'professional' CHECK (access_level IN ('admin', 'manager', 'professional', 'receptionist')),
  cpf TEXT,
  cpf_digits TEXT GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')) STORED,
  email TEXT,
  phone TEXT,
  avatar_url TEXT CHECK (public.is_valid_media_url(avatar_url)),
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  product_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  specialties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  address TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professionals_salon_id ON public.professionals (salon_id);
CREATE INDEX idx_professionals_cpf_digits ON public.professionals (cpf_digits) WHERE cpf_digits IS NOT NULL;
CREATE INDEX idx_professionals_email_lower ON public.professionals (lower(btrim(email))) WHERE email IS NOT NULL;

-- 3.10. CATÁLOGO ÚNICO DE SERVIÇOS (ZERO tabela espelho salon_services)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  cover_image_url TEXT CHECK (public.is_valid_media_url(cover_image_url)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_via TEXT NOT NULL DEFAULT 'mnvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_salon_active ON public.services (salon_id, is_active, sort_order);

-- 3.11. VAGAS RELÂMPAGO & RADAR (Suporte nativo ao Portal pvapp)
CREATE TABLE public.service_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cabelo',
  original_price NUMERIC(10, 2),
  offer_price NUMERIC(10, 2) NOT NULL CHECK (offer_price >= 0),
  slot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  slot_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  media_level SMALLINT NOT NULL DEFAULT 2 CHECK (media_level IN (1, 2, 3)),
  cover_image_url TEXT CHECK (public.is_valid_media_url(cover_image_url)),
  video_url TEXT CHECK (public.is_valid_media_url(video_url)),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'booked', 'expired', 'cancelled')),
  created_via TEXT NOT NULL DEFAULT 'mnvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_offers_active_geo ON public.service_offers (status, expires_at, latitude, longitude);

-- 3.12. CLIENTES CONSUMIDORES (Base Única)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  cpf_digits TEXT GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')) STORED,
  birth_date DATE,
  avatar_url TEXT CHECK (public.is_valid_media_url(avatar_url)),
  address TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'São Paulo',
  state TEXT DEFAULT 'SP',
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  formatted_address TEXT,
  google_place_id TEXT,
  security_question_code TEXT REFERENCES public.security_questions(code) ON DELETE SET NULL,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  dependents_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp' CHECK (created_via IN ('admvapp', 'mnvapp', 'pvapp', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_clients_email_lower ON public.clients (lower(btrim(email))) WHERE email IS NOT NULL AND btrim(email) <> '';
CREATE UNIQUE INDEX uq_clients_cpf_digits ON public.clients (cpf_digits) WHERE cpf_digits IS NOT NULL AND length(cpf_digits) = 11;

-- 3.13. RESPOSTAS DE SEGURANÇA DO USUÁRIO
CREATE TABLE public.user_security_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL REFERENCES public.security_questions(code) ON DELETE RESTRICT,
  answer_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, question_code)
);

-- 3.14. CARTEIRA CRM POR SALÃO
CREATE TABLE public.salon_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, client_id)
);

CREATE INDEX idx_salon_clients_salon_id ON public.salon_clients (salon_id, last_visit_at DESC);

-- 3.15. CONTA FAMÍLIA / DEPENDENTES (ZERO tabela espelho client_family_members)
CREATE TABLE public.dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'other' CHECK (relationship IN ('son', 'daughter', 'child', 'spouse', 'parent', 'sibling', 'other')),
  birth_date DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT CHECK (public.is_valid_media_url(avatar_url)),
  autonomy_level TEXT NOT NULL DEFAULT 'parent_controlled',
  notes TEXT,
  is_unlinked BOOLEAN NOT NULL DEFAULT FALSE,
  created_via TEXT NOT NULL DEFAULT 'mnvapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dependents_parent ON public.dependents (parent_client_id) WHERE is_unlinked = FALSE;

-- 3.16. AGENDAMENTOS + TELEMETRIA RTLS + PERMUTA EM CASCATA
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_code TEXT NOT NULL UNIQUE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dependent_id UUID REFERENCES public.dependents(id) ON DELETE SET NULL,
  dependent_name TEXT,
  is_dependent BOOLEAN NOT NULL DEFAULT FALSE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  professional_name TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  -- Data e Horário normalizados para ordenação e anti-colisão
  date_str DATE NOT NULL,
  start_time TEXT NOT NULL CHECK (start_time ~ '^\d{2}:\d{2}$'),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status TEXT NOT NULL DEFAULT 'CONFIRMADO' CHECK (
    status IN ('PENDENTE', 'AGENDADO', 'CONFIRMADO', 'EM ANDAMENTO', 'ALTERADO', 'CONCLUÍDO', 'CANCELADO', 'BLOQUEADO')
  ),
  -- Pagamento & Caixa
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT CHECK (payment_method IN ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'vagou_app')),
  paid_at TIMESTAMPTZ,
  commission_rate NUMERIC(5, 2),
  commission_amount NUMERIC(10, 2),
  platform_fee NUMERIC(10, 2),
  -- Pausa / Bloqueio & Permuta
  is_blocked_slot BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason TEXT,
  swap_state JSONB,
  cancellation_reason TEXT,
  -- RTLS / Deslocamento Ao Vivo
  service_location_type TEXT NOT NULL DEFAULT 'in_salon' CHECK (service_location_type IN ('in_salon', 'home_delivery')),
  transport_mode TEXT CHECK (transport_mode IN ('walking', 'bicycling', 'motorcycle', 'car', 'driving', 'transit', 'rideshare')),
  tracking_status TEXT NOT NULL DEFAULT 'idle' CHECK (
    tracking_status IN ('idle', 'alerted', 'hurry_confirmed', 'on_way_no_map', 'live_sharing', 'arriving_5min', 'arrived', 'rescheduled', 'cancelled')
  ),
  client_lat DOUBLE PRECISION,
  client_lng DOUBLE PRECISION,
  distance_km NUMERIC(8, 2),
  eta_minutes INTEGER,
  route_polyline TEXT,
  current_street_name TEXT,
  active_adversity JSONB,
  last_location_update TIMESTAMPTZ,
  created_via TEXT NOT NULL DEFAULT 'mnvapp' CHECK (created_via IN ('admvapp', 'mnvapp', 'pvapp', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_salon_date ON public.appointments (salon_id, date_str ASC, start_time ASC);
CREATE INDEX idx_appointments_client_date ON public.appointments (client_id, date_str ASC, start_time ASC);
CREATE INDEX idx_appointments_user_date ON public.appointments (client_user_id, date_str ASC, start_time ASC);

-- 3.17. FLUXO DE CAIXA DO ESTABELECIMENTO
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id UUID UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'Serviço',
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_transactions_salon_date ON public.financial_transactions (salon_id, occurred_at DESC);

-- 3.18. FATURAS CORPORATIVAS VAGOUAPP (admvapp)
CREATE TABLE public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL CHECK (reference_month ~ '^\d{4}-\d{2}$'),
  billing_plan TEXT NOT NULL,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMPTZ,
  pix_copy_paste TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, reference_month)
);

-- 3.19. UTILIDADES OPERACIONAIS (Água, Energia, Equipamentos, Insumos, DRE)
CREATE TABLE public.salon_utilities_records (
  salon_id UUID PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  energy_meters JSONB NOT NULL DEFAULT '[]'::jsonb,
  energy_readings JSONB NOT NULL DEFAULT '[]'::jsonb,
  water_meters JSONB NOT NULL DEFAULT '[]'::jsonb,
  water_readings JSONB NOT NULL DEFAULT '[]'::jsonb,
  appliances JSONB NOT NULL DEFAULT '[]'::jsonb,
  dre_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  supply_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.20. REGISTRO SOBERANO DE MÍDIA BINÁRIA (Substitui salon_media_items / salon_media_slots / Base64)
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL CHECK (bucket_id IN ('avatars', 'branding', 'services', 'salon-media')),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL CHECK (public.is_valid_media_url(public_url) AND public_url !~* '^data:'),
  owner_type TEXT NOT NULL CHECK (
    owner_type IN (
      'profile_avatar',
      'client_avatar',
      'professional_avatar',
      'dependent_avatar',
      'salon_logo_light',
      'salon_logo_dark',
      'salon_icon',
      'salon_cover',
      'salon_facade',
      'salon_interior',
      'salon_gallery',
      'service_photo',
      'service_video',
      'offer_media',
      'admin_preference'
    )
  ),
  owner_id UUID NOT NULL,
  salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
  title TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket_id, storage_path)
);

CREATE INDEX idx_media_assets_owner ON public.media_assets (owner_type, owner_id, sort_order);
CREATE INDEX idx_media_assets_salon ON public.media_assets (salon_id, owner_type);

-- 3.21. FILA DE EXPURGO DE ÓRFÃOS DO STORAGE (Auditoria + Limpeza Garantida)
CREATE TABLE public.storage_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'asset_deleted',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deleted', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 3.22. ASSINATURAS WEB PUSH NATIVO (VAPID)
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
  app_origin TEXT NOT NULL DEFAULT 'mnvapp' CHECK (app_origin IN ('admvapp', 'mnvapp', 'pvapp')),
  role TEXT NOT NULL DEFAULT 'client',
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions (user_id) WHERE is_active = TRUE;
CREATE INDEX idx_push_subscriptions_salon ON public.push_subscriptions (salon_id) WHERE is_active = TRUE;

-- 3.23. FILA TRANSACIONAL DE NOTIFICAÇÕES PUSH (Outbox disparado por Triggers)
CREATE TABLE public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
  target_role TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_outbox_pending ON public.notification_outbox (status, created_at ASC) WHERE status = 'pending';

-- =====================================================================================================
-- 4. FUNÇÕES RLS SECURITY DEFINER (BASEADAS EM SUPABASE AUTH JWT)
-- =====================================================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', FALSE)
      OR EXISTS (
        SELECT 1
        FROM public.system_admins sa
        WHERE sa.user_id = auth.uid()
          AND sa.is_active = TRUE
      );
$$;

CREATE OR REPLACE FUNCTION public.is_salon_member(p_salon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.salons s
        WHERE s.id = p_salon_id
          AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.salon_members sm
        WHERE sm.salon_id = p_salon_id
          AND sm.user_id = auth.uid()
          AND sm.is_active = TRUE
      );
$$;

CREATE OR REPLACE FUNCTION public.is_salon_manager(p_salon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.salons s
        WHERE s.id = p_salon_id
          AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.salon_members sm
        WHERE sm.salon_id = p_salon_id
          AND sm.user_id = auth.uid()
          AND sm.is_active = TRUE
          AND sm.role IN ('owner', 'manager')
      );
$$;

-- =====================================================================================================
-- 5. TRIGGERS NATIVOS DO NÚCLEO VAGOU v6.0
-- =====================================================================================================

-- 5.1. Trigger genérico de updated_at
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'system_admins', 'admin_preferences', 'salons', 'salon_ui_settings',
    'salon_members', 'professionals', 'services', 'service_offers', 'clients',
    'user_security_answers', 'salon_clients', 'dependents', 'appointments',
    'financial_transactions', 'billing_invoices', 'salon_utilities_records',
    'media_assets', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- 5.2. Provisionamento Automático de Perfil & Cliente ao criar usuário no Supabase Auth
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_origin TEXT;
  v_phone TEXT;
  v_cpf TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1)
  );
  v_role := COALESCE(
    NULLIF(btrim(NEW.raw_app_meta_data ->> 'role'), ''),
    'client'
  );
  IF v_role NOT IN ('super_admin', 'salon_owner', 'salon_staff', 'client') THEN
    v_role := 'client';
  END IF;
  v_origin := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'created_via'), ''), 'mnvapp');
  IF v_origin NOT IN ('admvapp', 'mnvapp', 'pvapp', 'system') THEN
    v_origin := 'mnvapp';
  END IF;
  v_phone := NULLIF(btrim(NEW.raw_user_meta_data ->> 'phone'), '');
  v_cpf := NULLIF(btrim(NEW.raw_user_meta_data ->> 'cpf'), '');

  INSERT INTO public.profiles (id, email, full_name, cpf, phone, role, created_via)
  VALUES (NEW.id, lower(btrim(NEW.email)), v_name, v_cpf, v_phone, v_role, v_origin)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    updated_at = NOW();

  -- Cria ou vincula registro de cliente consumidor automaticamente (exceto se já existir pelo e-mail/CPF)
  INSERT INTO public.clients (user_id, full_name, email, phone, cpf, created_via)
  VALUES (NEW.id, v_name, lower(btrim(NEW.email)), v_phone, v_cpf, v_origin)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();

-- 5.3. Auto-criação de salon_ui_settings e salon_members (owner) ao criar salão
CREATE OR REPLACE FUNCTION public.fn_after_salon_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.salon_ui_settings (salon_id, pwa_name, logo_text_fallback)
  VALUES (NEW.id, NEW.trade_name, NEW.trade_name)
  ON CONFLICT (salon_id) DO NOTHING;

  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.salon_members (salon_id, user_id, role, created_via)
    VALUES (NEW.id, NEW.owner_id, 'owner', NEW.created_via)
    ON CONFLICT (salon_id, user_id) DO UPDATE SET role = 'owner', is_active = TRUE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_salon_insert
  AFTER INSERT ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.fn_after_salon_insert();

-- 5.4. Propagação Automática de Perfil, Endereço, Coordenadas e Avatar por CPF (Zero loops via pg_trigger_depth)
CREATE OR REPLACE FUNCTION public.fn_propagate_cpf_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'salons' THEN
    v_cpf := NEW.owner_cpf_digits;
  ELSE
    v_cpf := NEW.cpf_digits;
  END IF;

  IF v_cpf IS NULL OR length(v_cpf) <> 11 THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME <> 'profiles' THEN
    UPDATE public.profiles
    SET
      address = COALESCE(NEW.address, address),
      street_number = COALESCE(NEW.street_number, street_number),
      complement = COALESCE(NEW.complement, complement),
      neighborhood = COALESCE(NEW.neighborhood, neighborhood),
      city = COALESCE(NEW.city, city),
      state = COALESCE(NEW.state, state),
      cep = COALESCE(NEW.cep, cep),
      latitude = COALESCE(NEW.latitude, latitude),
      longitude = COALESCE(NEW.longitude, longitude),
      avatar_url = CASE
        WHEN TG_TABLE_NAME IN ('clients', 'professionals') AND NEW.avatar_url IS NOT NULL THEN NEW.avatar_url
        ELSE avatar_url
      END,
      updated_at = NOW()
    WHERE cpf_digits = v_cpf;
  END IF;

  IF TG_TABLE_NAME <> 'clients' THEN
    UPDATE public.clients
    SET
      address = COALESCE(NEW.address, address),
      street_number = COALESCE(NEW.street_number, street_number),
      complement = COALESCE(NEW.complement, complement),
      neighborhood = COALESCE(NEW.neighborhood, neighborhood),
      city = COALESCE(NEW.city, city),
      state = COALESCE(NEW.state, state),
      cep = COALESCE(NEW.cep, cep),
      latitude = COALESCE(NEW.latitude, latitude),
      longitude = COALESCE(NEW.longitude, longitude),
      avatar_url = CASE
        WHEN TG_TABLE_NAME IN ('profiles', 'professionals') AND NEW.avatar_url IS NOT NULL THEN NEW.avatar_url
        ELSE avatar_url
      END,
      updated_at = NOW()
    WHERE cpf_digits = v_cpf;
  END IF;

  IF TG_TABLE_NAME <> 'professionals' THEN
    UPDATE public.professionals
    SET
      address = COALESCE(NEW.address, address),
      street_number = COALESCE(NEW.street_number, street_number),
      complement = COALESCE(NEW.complement, complement),
      neighborhood = COALESCE(NEW.neighborhood, neighborhood),
      city = COALESCE(NEW.city, city),
      state = COALESCE(NEW.state, state),
      cep = COALESCE(NEW.cep, cep),
      latitude = COALESCE(NEW.latitude, latitude),
      longitude = COALESCE(NEW.longitude, longitude),
      avatar_url = CASE
        WHEN TG_TABLE_NAME IN ('profiles', 'clients') AND NEW.avatar_url IS NOT NULL THEN NEW.avatar_url
        ELSE avatar_url
      END,
      updated_at = NOW()
    WHERE cpf_digits = v_cpf;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_cpf_profiles
  AFTER INSERT OR UPDATE OF address, street_number, complement, neighborhood, city, state, cep, latitude, longitude, avatar_url
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_cpf_identity();

CREATE TRIGGER trg_propagate_cpf_clients
  AFTER INSERT OR UPDATE OF address, street_number, complement, neighborhood, city, state, cep, latitude, longitude, avatar_url
  ON public.clients FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_cpf_identity();

CREATE TRIGGER trg_propagate_cpf_professionals
  AFTER INSERT OR UPDATE OF address, street_number, complement, neighborhood, city, state, cep, latitude, longitude, avatar_url
  ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_cpf_identity();

-- 5.5. Contador Automático de Dependentes em clients
CREATE OR REPLACE FUNCTION public.fn_sync_dependents_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  v_parent_id := COALESCE(NEW.parent_client_id, OLD.parent_client_id);
  IF v_parent_id IS NOT NULL THEN
    UPDATE public.clients
    SET dependents_count = (
      SELECT count(*)::INTEGER
      FROM public.dependents d
      WHERE d.parent_client_id = v_parent_id
        AND d.is_unlinked = FALSE
    )
    WHERE id = v_parent_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_dependents_counter
  AFTER INSERT OR UPDATE OR DELETE ON public.dependents
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_dependents_counter();

-- 5.6. Proteção Anti-Colisão Geotemporal entre Salões
CREATE OR REPLACE FUNCTION public.calculate_inter_salon_travel_minutes(
  p_lat1 DOUBLE PRECISION,
  p_lng1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION,
  p_lng2 DOUBLE PRECISION
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_km DOUBLE PRECISION;
BEGIN
  IF p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN
    RETURN 15;
  END IF;
  v_km := 6371.0 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2) - radians(p_lng1)) +
      sin(radians(p_lat1)) * sin(radians(p_lat2))
    ))
  );
  RETURN GREATEST(10, LEAST(90, ceil((v_km * 1.35) / 28.0 * 60.0)::INTEGER + 5));
END;
$$;

CREATE OR REPLACE FUNCTION public.check_client_inter_salon_collision(
  p_client_id UUID,
  p_salon_id UUID,
  p_date_str DATE,
  p_start_time TEXT,
  p_duration_minutes INTEGER DEFAULT 30,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  has_collision BOOLEAN,
  conflict_appointment_id UUID,
  conflict_salon_name TEXT,
  conflict_start_time TEXT,
  required_buffer_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_start INTEGER;
  v_new_end INTEGER;
  v_target_lat DOUBLE PRECISION;
  v_target_lng DOUBLE PRECISION;
  v_rec RECORD;
  v_ex_start INTEGER;
  v_ex_end INTEGER;
  v_buffer INTEGER;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  v_new_start := split_part(p_start_time, ':', 1)::INTEGER * 60 + split_part(p_start_time, ':', 2)::INTEGER;
  v_new_end := v_new_start + COALESCE(p_duration_minutes, 30);

  SELECT s.latitude, s.longitude INTO v_target_lat, v_target_lng
  FROM public.salons s WHERE s.id = p_salon_id;

  FOR v_rec IN
    SELECT a.id, a.salon_id, a.start_time, a.duration_minutes, s.trade_name, s.latitude, s.longitude
    FROM public.appointments a
    JOIN public.salons s ON s.id = a.salon_id
    WHERE a.client_id = p_client_id
      AND a.date_str = p_date_str
      AND a.is_blocked_slot = FALSE
      AND a.status NOT IN ('CANCELADO', 'CONCLUÍDO')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
  LOOP
    v_ex_start := split_part(v_rec.start_time, ':', 1)::INTEGER * 60 + split_part(v_rec.start_time, ':', 2)::INTEGER;
    v_ex_end := v_ex_start + COALESCE(v_rec.duration_minutes, 30);
    v_buffer := CASE
      WHEN v_rec.salon_id = p_salon_id THEN 0
      ELSE public.calculate_inter_salon_travel_minutes(v_target_lat, v_target_lng, v_rec.latitude, v_rec.longitude)
    END;

    IF v_new_start < (v_ex_end + v_buffer) AND v_ex_start < (v_new_end + v_buffer) THEN
      RETURN QUERY SELECT TRUE, v_rec.id, v_rec.trade_name, v_rec.start_time, v_buffer;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_inter_salon_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col RECORD;
BEGIN
  IF NEW.is_blocked_slot = TRUE OR NEW.status IN ('CANCELADO', 'CONCLUÍDO') OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_col
  FROM public.check_client_inter_salon_collision(
    NEW.client_id,
    NEW.salon_id,
    NEW.date_str,
    NEW.start_time,
    NEW.duration_minutes,
    NEW.id
  )
  LIMIT 1;

  IF v_col.has_collision THEN
    RAISE EXCEPTION 'Conflito de horário detectado com agendamento às % em % (buffer mínimo: % min).',
      v_col.conflict_start_time, v_col.conflict_salon_name, v_col.required_buffer_minutes
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_inter_salon_collision
  BEFORE INSERT OR UPDATE OF date_str, start_time, duration_minutes, status, salon_id, client_id
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_inter_salon_collision();

-- 5.7. Métricas Automáticas de CRM (salon_clients + clients) & Fluxo de Caixa (financial_transactions)
CREATE OR REPLACE FUNCTION public.fn_appointment_crm_and_cashflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC(10, 2);
BEGIN
  IF NEW.is_blocked_slot = TRUE THEN
    RETURN NEW;
  END IF;

  -- Atualiza carteira CRM do cliente no salão e total global
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.salon_clients (salon_id, client_id, total_appointments, total_spent, last_visit_at)
    VALUES (
      NEW.salon_id,
      NEW.client_id,
      1,
      CASE WHEN NEW.is_paid OR NEW.status = 'CONCLUÍDO' THEN COALESCE(NEW.total_price, 0) ELSE 0 END,
      NOW()
    )
    ON CONFLICT (salon_id, client_id) DO UPDATE SET
      total_appointments = (
        SELECT count(*)::INTEGER
        FROM public.appointments a
        WHERE a.salon_id = NEW.salon_id
          AND a.client_id = NEW.client_id
          AND a.is_blocked_slot = FALSE
          AND a.status <> 'CANCELADO'
      ),
      total_spent = (
        SELECT COALESCE(sum(a.total_price), 0)
        FROM public.appointments a
        WHERE a.salon_id = NEW.salon_id
          AND a.client_id = NEW.client_id
          AND a.is_blocked_slot = FALSE
          AND (a.is_paid = TRUE OR a.status = 'CONCLUÍDO')
          AND a.status <> 'CANCELADO'
      ),
      last_visit_at = NOW(),
      updated_at = NOW();

    UPDATE public.clients
    SET total_appointments = (
      SELECT count(*)::INTEGER
      FROM public.appointments a
      WHERE a.client_id = NEW.client_id
        AND a.is_blocked_slot = FALSE
        AND a.status <> 'CANCELADO'
    )
    WHERE id = NEW.client_id;
  END IF;

  -- Gera / sincroniza lançamento automático no fluxo de caixa quando pago ou concluído
  IF (NEW.is_paid = TRUE OR NEW.status = 'CONCLUÍDO') AND NEW.status <> 'CANCELADO' AND COALESCE(NEW.total_price, 0) > 0 THEN
    SELECT fee_per_booking INTO v_fee FROM public.salons WHERE id = NEW.salon_id;

    INSERT INTO public.financial_transactions (
      salon_id, appointment_id, type, category, description, amount, payment_method, status, occurred_at
    )
    VALUES (
      NEW.salon_id,
      NEW.id,
      'income',
      'Atendimento',
      NEW.service_title || ' — ' || NEW.customer_name,
      NEW.total_price,
      COALESCE(NEW.payment_method, 'pix'),
      'completed',
      COALESCE(NEW.paid_at, NOW())
    )
    ON CONFLICT (appointment_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      payment_method = EXCLUDED.payment_method,
      status = 'completed',
      occurred_at = EXCLUDED.occurred_at,
      updated_at = NOW();
  ELSIF NEW.status = 'CANCELADO' THEN
    UPDATE public.financial_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE appointment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointment_crm_and_cashflow
  AFTER INSERT OR UPDATE OF status, is_paid, total_price, payment_method
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_appointment_crm_and_cashflow();

-- 5.8. Enfileiramento Automático de Web Push (notification_outbox)
CREATE OR REPLACE FUNCTION public.fn_enqueue_appointment_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_name TEXT;
BEGIN
  IF NEW.is_blocked_slot = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT trade_name INTO v_salon_name FROM public.salons WHERE id = NEW.salon_id;
  v_salon_name := COALESCE(v_salon_name, 'Estabelecimento');

  IF TG_OP = 'INSERT' THEN
    -- Push para a equipe do estabelecimento
    INSERT INTO public.notification_outbox (
      event_type, target_salon_id, target_role, title, body, url, payload
    )
    VALUES (
      'appointment.created',
      NEW.salon_id,
      'salon_staff',
      'Novo agendamento confirmado',
      NEW.customer_name || ' agendou ' || NEW.service_title || ' em ' || to_char(NEW.date_str, 'DD/MM') || ' às ' || NEW.start_time,
      '/agenda',
      jsonb_build_object('appointment_id', NEW.id, 'protocol_code', NEW.protocol_code, 'salon_id', NEW.salon_id)
    );

    -- Push de confirmação para o cliente
    IF NEW.client_user_id IS NOT NULL THEN
      INSERT INTO public.notification_outbox (
        event_type, target_user_id, target_salon_id, target_role, title, body, url, payload
      )
      VALUES (
        'appointment.confirmed_client',
        NEW.client_user_id,
        NEW.salon_id,
        'client',
        v_salon_name || ' • Horário reservado',
        NEW.service_title || ' em ' || to_char(NEW.date_str, 'DD/MM') || ' às ' || NEW.start_time,
        '/minha-agenda',
        jsonb_build_object('appointment_id', NEW.id, 'protocol_code', NEW.protocol_code)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.client_user_id IS NOT NULL THEN
        INSERT INTO public.notification_outbox (
          event_type, target_user_id, target_salon_id, target_role, title, body, url, payload
        )
        VALUES (
          'appointment.status_changed',
          NEW.client_user_id,
          NEW.salon_id,
          'client',
          v_salon_name || ' • ' || NEW.status,
          NEW.service_title || ' (' || to_char(NEW.date_str, 'DD/MM') || ' às ' || NEW.start_time || ') agora está ' || NEW.status,
          '/minha-agenda',
          jsonb_build_object('appointment_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
        );
      END IF;

      IF NEW.status = 'CANCELADO' THEN
        INSERT INTO public.notification_outbox (
          event_type, target_salon_id, target_role, title, body, url, payload
        )
        VALUES (
          'appointment.cancelled',
          NEW.salon_id,
          'salon_staff',
          'Horário cancelado — vaga liberada',
          NEW.customer_name || ' cancelou ' || NEW.service_title || ' (' || NEW.start_time || ')',
          '/agenda',
          jsonb_build_object('appointment_id', NEW.id, 'reason', NEW.cancellation_reason)
        );
      END IF;
    END IF;

    IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status
       AND NEW.tracking_status IN ('arriving_5min', 'arrived') THEN
      INSERT INTO public.notification_outbox (
        event_type, target_salon_id, target_role, title, body, url, payload
      )
      VALUES (
        'rtls.' || NEW.tracking_status,
        NEW.salon_id,
        'salon_staff',
        CASE WHEN NEW.tracking_status = 'arrived' THEN 'Cliente chegou!' ELSE 'Cliente a 5 minutos' END,
        NEW.customer_name || ' (' || NEW.service_title || ' às ' || NEW.start_time || ')',
        '/agenda',
        jsonb_build_object('appointment_id', NEW.id, 'tracking_status', NEW.tracking_status, 'eta_minutes', NEW.eta_minutes)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enqueue_appointment_push
  AFTER INSERT OR UPDATE OF status, tracking_status
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_enqueue_appointment_push();

-- 5.9. Enfileiramento Automático de Arquivos Órfãos para Expurgo via Supabase Storage API
-- (Supabase bloqueia DELETE direto em storage.objects via storage.protect_delete();
--  a fila storage_cleanup_queue é drenada pelo backend via Storage API oficial)
CREATE OR REPLACE FUNCTION public.fn_cleanup_storage_orphan_on_media_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, storage_path, reason, status)
    VALUES (OLD.bucket_id, OLD.storage_path, 'media_asset_deleted', 'pending');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND (OLD.storage_path IS DISTINCT FROM NEW.storage_path OR OLD.bucket_id IS DISTINCT FROM NEW.bucket_id) THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, storage_path, reason, status)
    VALUES (OLD.bucket_id, OLD.storage_path, 'media_asset_replaced', 'pending');
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_storage_orphans
  AFTER DELETE OR UPDATE OF storage_path, bucket_id
  ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_cleanup_storage_orphan_on_media_delete();

-- =====================================================================================================
-- 6. RPCs OFICIAIS (AGENDA, PORTAL RADAR GIS, BOOTSTRAP & VERIFICAÇÃO ADMIN)
-- =====================================================================================================

-- 6.1. Horários Ocupados (sem expor PII de outros clientes)
CREATE OR REPLACE FUNCTION public.get_busy_slots(
  p_salon_id UUID,
  p_date_str DATE,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  start_time TEXT,
  duration_minutes INTEGER,
  professional_id UUID,
  is_blocked_slot BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.start_time, a.duration_minutes, a.professional_id, a.is_blocked_slot
  FROM public.appointments a
  WHERE a.salon_id = p_salon_id
    AND a.date_str = p_date_str
    AND a.status NOT IN ('CANCELADO')
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
  ORDER BY a.start_time ASC;
$$;

-- 6.2. Radar Geoespacial do Portal (pvapp)
CREATE OR REPLACE FUNCTION public.get_offers_in_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 15.0,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  offer_id UUID,
  salon_id UUID,
  salon_name TEXT,
  salon_slug TEXT,
  salon_logo_url TEXT,
  title TEXT,
  category TEXT,
  offer_price NUMERIC,
  original_price NUMERIC,
  slot_date DATE,
  slot_time TEXT,
  duration_minutes INTEGER,
  cover_image_url TEXT,
  video_url TEXT,
  media_level SMALLINT,
  distance_km DOUBLE PRECISION,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id AS offer_id,
    s.id AS salon_id,
    s.trade_name AS salon_name,
    s.slug AS salon_slug,
    COALESCE(s.logo_url, s.logo_light_url, s.logo_dark_url) AS salon_logo_url,
    o.title,
    o.category,
    o.offer_price,
    o.original_price,
    o.slot_date,
    o.slot_time,
    o.duration_minutes,
    o.cover_image_url,
    o.video_url,
    o.media_level,
    (
      6371.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(COALESCE(o.latitude, s.latitude))) *
          cos(radians(COALESCE(o.longitude, s.longitude)) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(COALESCE(o.latitude, s.latitude)))
        ))
      )
    ) AS distance_km,
    o.expires_at
  FROM public.service_offers o
  JOIN public.salons s ON s.id = o.salon_id
  WHERE o.status = 'active'
    AND o.expires_at > NOW()
    AND s.is_active = TRUE
    AND COALESCE(o.latitude, s.latitude) IS NOT NULL
    AND COALESCE(o.longitude, s.longitude) IS NOT NULL
    AND (p_category IS NULL OR lower(o.category) = lower(p_category))
    AND (
      6371.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(COALESCE(o.latitude, s.latitude))) *
          cos(radians(COALESCE(o.longitude, s.longitude)) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(COALESCE(o.latitude, s.latitude)))
        ))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC, o.expires_at ASC;
$$;

-- 6.3. Bootstrap Seguro e Único do 1º Super Admin (trava automaticamente após o 1º registro)
CREATE OR REPLACE FUNCTION public.bootstrap_initial_super_admin(
  p_email TEXT,
  p_full_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_existing_count INTEGER;
  v_new_id UUID;
  v_resolved_auth_id UUID;
BEGIN
  SELECT count(*)::INTEGER INTO v_existing_count FROM public.system_admins;
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Bootstrap encerrado: já existe um Super Admin registrado.' USING ERRCODE = 'P0001';
  END IF;

  IF p_password IS NULL OR length(btrim(p_password)) < 8 THEN
    RAISE EXCEPTION 'A senha do Super Admin deve ter pelo menos 8 caracteres.' USING ERRCODE = 'P0001';
  END IF;

  v_resolved_auth_id := p_user_id;
  IF v_resolved_auth_id IS NULL THEN
    SELECT id INTO v_resolved_auth_id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  END IF;

  INSERT INTO public.system_admins (
    user_id, full_name, username, email, password_hash, role, access_level, is_active, created_via
  )
  VALUES (
    v_resolved_auth_id,
    btrim(p_full_name),
    lower(btrim(p_username)),
    lower(btrim(p_email)),
    crypt(p_password, gen_salt('bf', 10)),
    'super_admin',
    100,
    TRUE,
    'admvapp'
  )
  RETURNING id INTO v_new_id;

  IF v_resolved_auth_id IS NOT NULL THEN
    UPDATE public.profiles SET role = 'super_admin' WHERE id = v_resolved_auth_id;
  END IF;

  INSERT INTO public.admin_access_logs (admin_id, actor_user_id, action, entity_type, entity_id)
  VALUES (v_new_id, v_resolved_auth_id, 'bootstrap_super_admin', 'system_admins', v_new_id::TEXT);

  RETURN v_new_id;
END;
$$;

-- 6.4. Verificação de Login Administrativo (compatível com admvapp)
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_identifier TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  username TEXT,
  email TEXT,
  role TEXT,
  access_level INTEGER,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean TEXT := lower(btrim(COALESCE(p_identifier, '')));
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.user_id, sa.full_name, sa.username, sa.email, sa.role, sa.access_level, sa.avatar_url
  FROM public.system_admins sa
  WHERE sa.is_active = TRUE
    AND (lower(sa.email) = v_clean OR lower(sa.username) = v_clean)
    AND sa.password_hash = crypt(p_password, sa.password_hash)
  LIMIT 1;
END;
$$;

-- =====================================================================================================
-- 7. ROW LEVEL SECURITY (RLS ESTRITO POR TENANT & JWT)
-- =====================================================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'system_admins', 'admin_access_logs', 'admin_preferences',
    'security_questions', 'user_security_answers', 'salons', 'salon_ui_settings',
    'salon_members', 'professionals', 'services', 'service_offers', 'clients',
    'salon_clients', 'dependents', 'appointments', 'financial_transactions',
    'billing_invoices', 'salon_utilities_records', 'media_assets',
    'storage_cleanup_queue', 'push_subscriptions', 'notification_outbox'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- PROFILES
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- SYSTEM ADMINS & LOGS
CREATE POLICY "system_admins_admin_only" ON public.system_admins
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_logs_admin_only" ON public.admin_access_logs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ADMIN PREFERENCES (leitura pública da marca global, escrita só super_admin)
CREATE POLICY "admin_prefs_public_read" ON public.admin_preferences
  FOR SELECT USING (TRUE);
CREATE POLICY "admin_prefs_admin_write" ON public.admin_preferences
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- SECURITY QUESTIONS & ANSWERS
CREATE POLICY "security_questions_public_read" ON public.security_questions
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "user_security_answers_owner_or_admin" ON public.user_security_answers
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  );

-- SALONS & UI SETTINGS (vitrine ativa legível publicamente; mutações restritas a gestor/admin)
CREATE POLICY "salons_public_read_active" ON public.salons
  FOR SELECT USING (is_active = TRUE OR public.is_salon_member(id));
CREATE POLICY "salons_insert_authenticated" ON public.salons
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR public.is_super_admin()));
CREATE POLICY "salons_update_manager" ON public.salons
  FOR UPDATE USING (public.is_salon_manager(id)) WITH CHECK (public.is_salon_manager(id));
CREATE POLICY "salons_delete_admin" ON public.salons
  FOR DELETE USING (public.is_super_admin());

CREATE POLICY "salon_ui_settings_public_read" ON public.salon_ui_settings
  FOR SELECT USING (TRUE);
CREATE POLICY "salon_ui_settings_manager_write" ON public.salon_ui_settings
  FOR ALL USING (public.is_salon_manager(salon_id)) WITH CHECK (public.is_salon_manager(salon_id));

-- SALON MEMBERS
CREATE POLICY "salon_members_read" ON public.salon_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_salon_member(salon_id));
CREATE POLICY "salon_members_manager_write" ON public.salon_members
  FOR ALL USING (public.is_salon_manager(salon_id)) WITH CHECK (public.is_salon_manager(salon_id));

-- PROFESSIONALS, SERVICES & OFFERS (vitrine pública leitura, gestão por membro/gerente)
CREATE POLICY "professionals_public_read" ON public.professionals
  FOR SELECT USING (is_active = TRUE OR public.is_salon_member(salon_id));
CREATE POLICY "professionals_manager_write" ON public.professionals
  FOR ALL USING (public.is_salon_manager(salon_id)) WITH CHECK (public.is_salon_manager(salon_id));

CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (is_active = TRUE OR public.is_salon_member(salon_id));
CREATE POLICY "services_manager_write" ON public.services
  FOR ALL USING (public.is_salon_manager(salon_id)) WITH CHECK (public.is_salon_manager(salon_id));

CREATE POLICY "service_offers_public_read" ON public.service_offers
  FOR SELECT USING ((status = 'active' AND expires_at > NOW()) OR public.is_salon_member(salon_id));
CREATE POLICY "service_offers_member_write" ON public.service_offers
  FOR ALL USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));

-- CLIENTS, SALON_CLIENTS & DEPENDENTS
CREATE POLICY "clients_self_salon_or_admin" ON public.clients
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.salon_clients sc
      WHERE sc.client_id = clients.id AND public.is_salon_member(sc.salon_id)
    )
  );
CREATE POLICY "clients_self_or_admin_write" ON public.clients
  FOR ALL USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "salon_clients_member_access" ON public.salon_clients
  FOR ALL USING (
    public.is_salon_member(salon_id)
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  )
  WITH CHECK (public.is_salon_member(salon_id));

CREATE POLICY "dependents_owner_or_admin" ON public.dependents
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = parent_client_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = parent_client_id AND c.user_id = auth.uid())
  );

-- APPOINTMENTS
CREATE POLICY "appointments_tenant_or_owner_select" ON public.appointments
  FOR SELECT USING (
    client_user_id = auth.uid()
    OR public.is_salon_member(salon_id)
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
  );
CREATE POLICY "appointments_authenticated_insert" ON public.appointments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (client_user_id = auth.uid() OR public.is_salon_member(salon_id))
  );
CREATE POLICY "appointments_tenant_or_owner_update" ON public.appointments
  FOR UPDATE USING (
    client_user_id = auth.uid() OR public.is_salon_member(salon_id)
  )
  WITH CHECK (
    client_user_id = auth.uid() OR public.is_salon_member(salon_id)
  );
CREATE POLICY "appointments_manager_delete" ON public.appointments
  FOR DELETE USING (public.is_salon_manager(salon_id));

-- FINANCIAL, BILLING & UTILITIES (exclusivo tenant gestor/membro ou admin)
CREATE POLICY "financial_transactions_member" ON public.financial_transactions
  FOR ALL USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));
CREATE POLICY "billing_invoices_manager" ON public.billing_invoices
  FOR SELECT USING (public.is_salon_manager(salon_id));
CREATE POLICY "billing_invoices_admin_write" ON public.billing_invoices
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "salon_utilities_manager" ON public.salon_utilities_records
  FOR ALL USING (public.is_salon_manager(salon_id)) WITH CHECK (public.is_salon_manager(salon_id));

-- MEDIA ASSETS & STORAGE CLEANUP
CREATE POLICY "media_assets_public_read" ON public.media_assets
  FOR SELECT USING (TRUE);
CREATE POLICY "media_assets_authenticated_write" ON public.media_assets
  FOR ALL USING (
    public.is_super_admin()
    OR uploaded_by = auth.uid()
    OR (salon_id IS NOT NULL AND public.is_salon_member(salon_id))
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR uploaded_by = auth.uid()
      OR (salon_id IS NOT NULL AND public.is_salon_member(salon_id))
      OR owner_id = auth.uid()
    )
  );
CREATE POLICY "storage_cleanup_admin_only" ON public.storage_cleanup_queue
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- PUSH SUBSCRIPTIONS & OUTBOX
CREATE POLICY "push_subscriptions_owner" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "notification_outbox_recipient_read" ON public.notification_outbox
  FOR SELECT USING (
    target_user_id = auth.uid()
    OR (target_salon_id IS NOT NULL AND public.is_salon_member(target_salon_id))
    OR public.is_super_admin()
  );

-- =====================================================================================================
-- 8. BUCKETS BINÁRIOS DO SUPABASE STORAGE (ZERO BASE64)
-- =====================================================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']),
  ('branding', 'branding', TRUE, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml']),
  ('services', 'services', TRUE, 15728640, ARRAY['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm']),
  ('salon-media', 'salon-media', TRUE, 52428800, ARRAY['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "v6_storage_public_read" ON storage.objects;
CREATE POLICY "v6_storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id IN ('avatars', 'branding', 'services', 'salon-media'));

DROP POLICY IF EXISTS "v6_storage_auth_insert" ON storage.objects;
CREATE POLICY "v6_storage_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('avatars', 'branding', 'services', 'salon-media')
    AND auth.role() IN ('authenticated', 'service_role')
  );

DROP POLICY IF EXISTS "v6_storage_auth_update" ON storage.objects;
CREATE POLICY "v6_storage_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('avatars', 'branding', 'services', 'salon-media')
    AND (owner = auth.uid() OR public.is_super_admin())
  );

DROP POLICY IF EXISTS "v6_storage_auth_delete" ON storage.objects;
CREATE POLICY "v6_storage_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('avatars', 'branding', 'services', 'salon-media')
    AND (owner = auth.uid() OR public.is_super_admin())
  );

-- =====================================================================================================
-- 9. PUBLICAÇÃO SUPABASE REALTIME UNIFICADA (REPLICA IDENTITY FULL)
-- =====================================================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'salons', 'salon_ui_settings', 'salon_members', 'professionals',
    'services', 'service_offers', 'clients', 'salon_clients', 'dependents',
    'appointments', 'financial_transactions', 'billing_invoices',
    'salon_utilities_records', 'media_assets', 'notification_outbox',
    'admin_preferences', 'system_admins'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- =====================================================================================================
-- 10. SEED MÍNIMO PÓS-RESET (SOMENTE 3 PERGUNTAS DE SEGURANÇA + PREFERÊNCIA GLOBAL VAZIA)
-- =====================================================================================================
INSERT INTO public.security_questions (code, question_text, sort_order)
VALUES
  ('sq_1', 'Qual é o nome do seu primeiro animal de estimação?', 1),
  ('sq_2', 'Em qual cidade seus pais se conheceram?', 2),
  ('sq_3', 'Qual era o nome da sua primeira escola?', 3)
ON CONFLICT (code) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.admin_preferences (id, preferences)
VALUES ('global', '{"dark": {}, "light": {}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================================================
-- 🔐 ATIVAÇÃO DO 1º SUPER ADMIN (EXECUTAR APÓS O RESET OU VIA PAINEL DE PRIMEIRO ACESSO)
-- Exemplo (substitua pelos dados reais no SQL Editor ou use a rota /api/admin/bootstrap):
--   SELECT public.bootstrap_initial_super_admin(
--     'seu-email@dominio.com',
--     'Seu Nome Completo',
--     'superadmin',
--     'SuaSenhaForteAqui!'
--   );
-- =====================================================================================================

COMMIT;
```

---

> ✅ **Fim do Documento Mestre da Tríade v6.0** — Qualquer alteração futura no banco deve ser feita exclusivamente via migração incremental aditiva acompanhada de novo Comunicado Técnico Inter-Projetos.
