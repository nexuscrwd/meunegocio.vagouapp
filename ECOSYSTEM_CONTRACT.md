# 🏛️ ECOSYSTEM_CONTRACT.md — Contrato Soberano da Tríade VagouApp (v6.0)

> **FONTE ÚNICA DA VERDADE (`mnvapp` ⇄ `admvapp` ⇄ `pvapp`)**  
> Este documento rege o contrato arquitetural, visual, de mídia binária, Push/Realtime e relacional entre as **três aplicações React + TypeScript + Tailwind CSS v4** que compartilham o banco **Supabase Clean Rebuild v6.0**.

---

## 🔗 1. Repositórios Oficiais da Tríade no GitHub

1. **Admin VagouApp (`admvapp`):** [`https://github.com/nexuscrwd/admin.vagouapp.git`](https://github.com/nexuscrwd/admin.vagouapp.git) — Backoffice Executivo & Governança Corporativa (`adm.vagouapp.com`)
2. **Meu Negócio VagouApp (`mnvapp` / `vapp`):** [`https://github.com/nexuscrwd/vagouapp.git`](https://github.com/nexuscrwd/vagouapp.git) — App Operacional dos Estabelecimentos & Vitrines White-Label (`meunegocio.vagouapp.com` / `*.vagouapp.com`)
3. **Portal VagouApp (`pvapp`):** [`https://github.com/nexuscrwd/Portal-VagouApp.git`](https://github.com/nexuscrwd/Portal-VagouApp.git) — Marketplace do Consumidor & Radar Geoespacial (`portal.vagouapp.com`)

---

## 🗺️ 2. Arquitetura Unificada v6.0 (Zero Base64 • Zero Tabelas Espelho • Web Push Nativo)

```
┌───────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────────┐
│   PORTAL VAGOU (pvapp)    │   │  MEU NEGÓCIO & VITRINE (mnv)  │   │   ADMIN MASTER (admvapp)  │
│  React 19 + Tailwind v4   │   │    React 19 + Tailwind v4     │   │  React 19 + Tailwind v4   │
│  Radar GIS & Descoberta   │   │  Salão, Agenda, Caixa & RTLS  │   │  Governança, Taxas & Logs │
└─────────────┬─────────────┘   └───────────────┬───────────────┘   └─────────────┬─────────────┘
              │                                 │                                 │
              └─────────────────────────────────┼─────────────────────────────────┘
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                     BANCO COMPARTILHADO SUPABASE POSTGRESQL (SQL v6.0)                        │
│  • 23 Tabelas Normalizadas (ZERO salon_services, client_family_members, platform_admins)      │
│  • Storage Binário + public.media_assets + CHECK anti-Base64 (^data: bloqueado no Postgres)   │
│  • Auth JWT Nativo (app_metadata.role) + RLS Estrito por Tenant (zero service_role no client) │
│  • Triggers Nativos: Auditoria, CRM/Caixa, Anti-Colisão Geotemporal, CPF Sync, Orphan Cleanup │
│  • Web Push Nativo (VAPID + Service Worker) + Fila Transacional notification_outbox           │
│  • Supabase Realtime Unificado (REPLICA IDENTITY FULL em todas as tabelas operacionais)       │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖼️ 3. Política Estrita de Mídia Binária (Zero Base64)

1. **Bloqueio no Banco:** Todas as colunas de mídia possuem `CHECK (public.is_valid_media_url(...))` rejeitando strings que iniciam com `data:`.
2. **4 Buckets Oficiais no Supabase Storage:**
   - `avatars` — fotos de perfil de clientes, profissionais e administradores.
   - `branding` — logotipos (claro/escuro), favicons PWA e banners.
   - `services` — fotos, slides e vídeos de serviços e ofertas relâmpago.
   - `salon-media` — fachada, interior e galeria institucional.
3. **Catálogo Relacional (`public.media_assets`):** Todo upload binário (via `POST /api/media/upload` ou Storage direto) registra metadados (`bucket`, `storage_path`, `public_url`, `mime_type`, `size_bytes`, `owner_type`, `owner_id`, `salon_id`).
4. **Limpeza Automática de Órfãos:** Excluir ou substituir um registro em `media_assets` dispara `trg_cleanup_storage_orphans`, enfileirando o arquivo em `storage_cleanup_queue` para remoção no Storage.

---

## 🗄️ 4. Contrato das 23 Tabelas Normalizadas (SQL v6.0)

Arquivo mestre: `supabase/migrations/20261121_vagou_v6_0_clean_reset.sql` (espelhado em `supabase/schema.sql`).

### 4.1. Núcleo de Identidade, Segurança e Governança
1. `profiles` — Perfil global vinculado a `auth.users` com propagação automática por CPF (`trg_propagate_cpf_identity`).
2. `system_admins` — Administradores do `admvapp` autenticados via Supabase Auth JWT + `verify_admin_login` (`pgcrypto` bcrypt) e provisionamento inicial auto-travante (`bootstrap_initial_super_admin`).
3. `admin_preferences` — Preferências globais visuais e institucionais do painel Admin (`id = 'global'`).
4. `admin_access_logs` — Trilha imutável de auditoria administrativa.
5. `security_questions` — 3 perguntas oficiais de segurança (`sq_1`, `sq_2`, `sq_3`).
6. `user_security_answers` — Respostas normalizadas vinculadas a `clients`.

### 4.2. Estabelecimentos, White-Label & Equipe
7. `salons` — Cadastro mestre do parceiro, geolocalização, branding URL-only e cobrança (`fee_per_booking`, `monthly_subscription_fee`, `billing_due_day`).
8. `salon_ui_settings` — Preferências visuais granulares da vitrine (`BottomNav`, `SectionHeader`, tema e tipografia).
9. `salon_members` — Vínculo multi-tenant `salon_id ⇄ user_id` (`owner`, `manager`, `professional`, `receptionist`).
10. `professionals` — Profissionais da equipe, comissões, especialidades e escalas (`schedule_config`).

### 4.3. Catálogo, Radar & Mídia Binária
11. `services` — Catálogo único de serviços do salão (elimina `salon_services`).
12. `service_offers` — Vagas relâmpago publicadas no Radar (`pvapp`) com RPC `get_offers_in_radius`.
13. `media_assets` — Catálogo relacional de ativos binários no Supabase Storage (substitui `salon_media_items`).
14. `storage_cleanup_queue` — Fila automática de remoção de objetos órfãos no Storage.

### 4.4. Clientes, Carteira CRM & Conta Família
15. `clients` — Base global de consumidores (CPF, WhatsApp, coordenadas de partida e perguntas de segurança).
16. `salon_clients` — Carteira CRM por salão (`total_appointments`, `total_spent`, `last_visit_at`) mantida por trigger.
17. `dependents` — Dependentes da Conta Família (elimina `client_family_members`), com `trg_sync_dependents_count`.

### 4.5. Agendamentos, Push, Utilidades & Financeiro
18. `appointments` — Agendamentos com anti-colisão geotemporal (`trg_prevent_inter_salon_collision`), baixa financeira automática, permutas e telemetria RTLS.
19. `push_subscriptions` — Assinaturas Web Push VAPID (`endpoint`, `p256dh`, `auth`) por usuário/cliente/salão.
20. `notification_outbox` — Fila transacional de notificações Push populada por triggers SQL (`trg_enqueue_appointment_push`).
21. `salon_utilities_records` — Energia, água, equipamentos, DRE e estoque/insumos por salão.
22. `billing_invoices` — Faturas mensais corporativas VagouApp por salão.
23. `financial_transactions` — Fluxo de caixa (receitas geradas automaticamente na conclusão do agendamento + despesas).

---

## 🔄 5. Protocolo Obrigatório de Sincronização (7º Mandamento)

Qualquer evolução após a v6.0 exige:
1. Migração incremental idempotente em `supabase/migrations/`.
2. Registro rastreável no `CHANGELOG.md`.
3. Emissão obrigatória do **`# 🏛️ COMUNICADO TÉCNICO INTER-PROJETOS`** para os outros dois repositórios da Tríade (ver `ADMVAPP_V6_SYNC_BLUEPRINT.md`).
