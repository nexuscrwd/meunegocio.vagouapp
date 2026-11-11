# 🏛️ ECOSYSTEM_CONTRACT.md — Contrato Soberano da Tríade VagouApp (v5.0)

> **FONTE ÚNICA DA VERDADE (`mnvapp` ⇄ `admvapp` ⇄ `pvapp`)**  
> Este documento rege o contrato arquitetural, visual e relacional entre as **três aplicações React + TypeScript + Tailwind CSS v4** que compartilham o mesmo banco de dados **Supabase (PostgreSQL v5.0)**.

---

## 🔗 1. Repositórios Oficiais da Tríade no GitHub

1. **Admin VagouApp (`admvapp`):** [`https://github.com/nexuscrwd/admin.vagouapp.git`](https://github.com/nexuscrwd/admin.vagouapp.git) — Backoffice Executivo & Governança Corporativa (`adm.vagouapp.com`)
2. **Meu Negócio VagouApp (`mnvapp` / `vapp`):** [`https://github.com/nexuscrwd/vagouapp.git`](https://github.com/nexuscrwd/vagouapp.git) — App Operacional dos Estabelecimentos & Vitrines White-Label (`meunegocio.vagouapp.com` / `*.vagouapp.com`)
3. **Portal VagouApp (`pvapp`):** [`https://github.com/nexuscrwd/Portal-VagouApp.git`](https://github.com/nexuscrwd/Portal-VagouApp.git) — Marketplace do Consumidor & Radar Geoespacial (`portal.vagouapp.com`)

---

## 🗺️ 2. Diagrama de Convergência em Tempo Real (Supabase v5.0)

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
│                      BANCO COMPARTILHADO SUPABASE POSTGRESQL (SQL v5.0)                       │
│  • 23 Tabelas Unificadas (Zero DROP CASCADE • Zero Mocks • Realtime Habilitado)               │
│  • Triggers Bidirecionais: services ⇄ salon_services | dependents ⇄ client_family_members     │
│  • Sincronismo Financeiro: billing_fee_value ⇄ fee_per_booking (Padrão R$ 2,50 / R$ 89,90)    │
│  • Motor Anti-Colisão Geotemporal: check_client_inter_salon_collision + Trigger P0001         │
│  • RPCs Corporativas & GIS: verify_admin_login | register_triade_user | get_offers_in_radius  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 3. Contrato de Identidade Visual & Tokens Default (`bol-158`)

Quando um estabelecimento é criado sem customização própria (ou utiliza o tema padrão do ecossistema), **ambos `mnvapp` e `admvapp`** devem respeitar os mesmos valores default na tabela `salons` e `salon_ui_settings`:

| Propriedade / Coluna | Valor Default Oficial | Regra de Contraste |
| :--- | :--- | :--- |
| `default_theme` | `'light'` | Paleta clara verde-menta suave como padrão inicial. |
| **Fundo Geral da Tela (`canvas`)** | `#F0FDF4` (moldura `#DCFCE7`) | Tipografia principal escura (`#1E293B` / `#065F46`). |
| `nav_bg_color` / `nav_bg_style` | `'#D1FAE5'` / `'solid'` | Botões inativos em `#065F46`; botão ativo branco assume a cor do tema (`#059669` / `#10B981`). |
| `section_header_bg_color` | `'#ECFDF5'` (`'solid'`) | Texto `#065F46` e ícone `#059669` com borda `#A7F3D0`. |
| `primary_color` / `nav_active_color` | `'#10B981'` | **REGRA INEGOCIÁVEL:** Qualquer botão/badge com fundo verde sólido (`#10B981`, `#20C933`, `bg-emerald-500/600`) exige obrigatoriamente texto e ícone **`#FFFFFF` (`text-white`)**. |
| **Raio de Borda Global** | `4px` (`rounded-[4px]`) | Proibido aninhar caixas com bordas dentro de caixas com bordas (*Zero Box-in-Box*). |

---

## 🗄️ 4. Contrato das 23 Tabelas Unificadas (SQL v5.0)

Arquivo mestre de referência: `supabase/migrations/20261111_master_convergence_v5_0.sql` (espelhado em `supabase/schema.sql`).

### 4.1. Núcleo de Identidade, Segurança e Governança
1. `profiles`: Perfil global vinculado a `auth.users` com endereço e geolocalização sincronizados por CPF.
2. `system_admins`: Administradores corporativos do `admvapp` autenticados via `verify_admin_login` (`pgcrypto` bcrypt).
3. `admin_access_logs`: Trilha imutável de auditoria administrativa do `admvapp`.
4. `security_questions`: Catálogo oficial das 3 perguntas de segurança para recuperação de acesso (único seed permitido em produção).
5. `user_security_answers`: Respostas normalizadas vinculadas a `clients`.

### 4.2. Estabelecimentos, White-Label & Equipe
6. `salons`: Cadastro mestre do parceiro, geolocalização, branding white-label e plano financeiro (`billing_plan`, `fee_per_booking` ⇄ `billing_fee_value = 2.50`, `monthly_subscription_fee = 89.90`, `billing_due_day = 10`).
7. `salon_ui_settings`: Preferências visuais granulares da vitrine (`BottomNav`, `SectionHeader`, tipografia e tema).
8. `salon_members`: Vínculo multi-tenant `salon_id ⇄ user_id`.
9. `salon_users`: Credenciais operacionais de gerentes e recepcionistas do salão.
10. `professionals`: Profissionais da equipe, comissões, especialidades e escalas individuais (`schedule_config`).

### 4.3. Catálogo Bidirecional & Radar
11. `services` ⇄ 12. `salon_services`: Espelhadas em tempo real por triggers bidirecionais (`trg_sync_services_to_salon_services` e `trg_sync_salon_services_to_services`), garantindo que edições no `mnvapp` ou no `admvapp` reflitam instantaneamente em ambos.
13. `service_offers`: Vagas relâmpago publicadas no Radar com expiração (`expires_at`) e mídia em 3 níveis.

### 4.4. Clientes, Carteira & Conta Família Bidirecional
14. `clients`: Base global de consumidores (CPF, WhatsApp, coordenadas de partida e perguntas de segurança).
15. `salon_clients`: Carteira CRM de clientes por estabelecimento (`total_appointments`, `total_spent`, `last_visit_at`).
16. `dependents` ⇄ 17. `client_family_members`: Espelhadas automaticamente por triggers (`trg_sync_dependents_to_family_members` e `trg_sync_family_members_to_dependents`) com atualização automática de `clients.dependents_count`.

### 4.5. Agendamentos, Mídia, Utilidades e Financeiro
18. `appointments`: Agendamentos reais ordenados por `date_str ASC, start_time ASC`, com baixa financeira (`is_paid` ⇄ `payment_status`), pausa de agenda (`is_blocked_slot`), permuta em cascata (`swap_state`), telemetria RTLS (`tracking_status`, `client_lat/lng`, `eta_minutes`, `route_polyline`) e proteção anti-colisão geotemporal.
19. `salon_media_items` & 20. `salon_media_slots`: Galeria institucional e os 5 slots oficiais de mídia do Radar.
21. `salon_utilities_records`: Gestão de medidores de água/energia, estoque (`supply_items` ⇄ `inventory_items`) e DRE (`dre_records` ⇄ `financial_dre`).
22. `billing_invoices`: Faturas mensais corporativas VagouApp por salão.
23. `financial_transactions`: Fluxo de caixa detalhado do estabelecimento (receitas e despesas).

---

## 🔄 5. Protocolo Obrigatório de Sincronização (7º Mandamento)

Qualquer alteração de schema, coluna, RPC, status ou token default realizada em um repositório exige:
1. Atualização de `supabase/migrations/` com script **100% idempotente** (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, **proibido `DROP TABLE CASCADE`**).
2. Registro rastreável no `CHANGELOG.md`.
3. Emissão imediata do **`# 🏛️ COMUNICADO TÉCNICO INTER-PROJETOS`** para os outros dois repositórios da Tríade.
