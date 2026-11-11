# 🗺️ Arquitetura e Visão Técnica — Vagou (`mnvapp`)

O **Vagou (`mnvapp` — `meunegocio.vagouapp.com` & Vitrines White-Label `*.vagouapp.com`)** é o aplicativo oficial dos estabelecimentos e vitrines exclusivas de agendamento da **Tríade VagouApp**, integrado em tempo real ao banco de dados soberano no **Supabase (PostgreSQL v5.0)**.

---

## 🏛️ A Tríade VagouApp (Governança e Escopo dos Projetos)

O ecossistema é composto por **três aplicações independentes e integradas ao mesmo banco Supabase**:

1. **`pvapp` (`portal.vagouapp.com`):** Marketplace e Portal do Consumidor final (Radar geoespacial de vagas relâmpago, descoberta por proximidade e reservas rápidas).  
   - Repositório: [`https://github.com/nexuscrwd/Portal-VagouApp.git`](https://github.com/nexuscrwd/Portal-VagouApp.git)
2. **`mnvapp` / `vapp` (`meunegocio.vagouapp.com` / `*.vagouapp.com`):** **Este projeto** — App Operacional do Parceiro (Agenda diária, Pausa de Horários, Caixa, Equipe, Serviços, Utilidades/DRE e Publicação de Vagas Relâmpago) + Vitrine Pública White-Label do Salão (`Início`, `Serviços`, `Agenda`, `Espaço`, Permuta A➔B➔C, Conta Família e Navegação GPS/RTLS ao vivo).  
   - Repositório: [`https://github.com/nexuscrwd/vagouapp.git`](https://github.com/nexuscrwd/vagouapp.git)
3. **`admvapp` (`adm.vagouapp.com` / `admin.vagouapp.com`):** Painel de Admin Master Corporativo (Governança executiva, moderação de salões, auditoria de agendamentos, gestão de usuários/equipe e faturamento corporativo no Supabase).  
   - Repositório: [`https://github.com/nexuscrwd/admin.vagouapp.git`](https://github.com/nexuscrwd/admin.vagouapp.git)

---

## 🏗️ 1. Visão Geral da Pilha Tecnológica

| Camada | Tecnologia | Descrição |
|---|---|---|
| **Frontend UI** | React 19 + TypeScript | Interface declarativa, mobile-first, 100% livre de mocks e protegida por Portão Obrigatório de Autenticação (`requireAuth`). |
| **Estilização** | Tailwind CSS v4 + `ThemeContext` | Tema default **Verde Pastel Clarinho** (`#F0FDF4` fundo, `#D1FAE5` barra/cabeçalho, `#ECFDF5` subcabeçalhos, `#065F46` texto escuro, `#10B981` destaque) + modo Dark Slate e White-Label dinâmico por salão. |
| **Ícones** | `lucide-react` (100% estrito) | Biblioteca exclusiva de ícones vetoriais (proibidos SVGs manuais inline). |
| **Animações** | Motion (`motion/react`) | Transições suaves entre abas isoladas (`AnimatePresence mode="wait"`). |
| **Backend & Automação** | Express (`server.ts`) + TSX | Cascata de rotas viárias de 5 camadas, geocodificação reversa e orquestração segura **Hermes Agent** (`n8n`, `Evolution API`, `WAHA`). |
| **Persistência / Cloud** | Supabase PostgreSQL (SQL v5.0) | 23 tabelas unificadas (`App ⇄ Admin ⇄ Portal`), triggers bidirecionais, motor anti-colisão geotemporal, RLS estruturado, Storage e Realtime. |

---

## 🔐 2. Portão de Acesso & Perfis Operacionais

- **Zero Mocks & Login Obrigatório (`bol-157`):** O acesso ao aplicativo exige obrigatoriamente autenticação prévia (**Login** ou **Cadastre-se** via `TriadeUserAuthCard` / `TriadeUserRegisterForm`), com recuperação de senha assistida por **Perguntas de Segurança** (`security_questions` / `user_security_answers`).
- **Visão Cliente (Vitrine White-Label — `SalonProfileView.tsx`):**
  - 4 seções isoladas com títulos idênticos aos botões do `BottomNav`: **`Início`**, **`Serviços`**, **`Agenda`** e **`Espaço`** (ou **`Atendimento`** para Home Care).
  - Agendamentos ordenados cronologicamente do mais próximo para o mais distante (`date_str ASC, start_time ASC`), Conta Família (`dependents ⇄ client_family_members`), Permuta em Cascata (`A ➔ B ➔ C`) e Cockpit GPS/RTLS Turn-by-Turn.
- **Visão Profissional / Gestor do Salão (`ProfessionalDashboardView.tsx` & `PartnerAgendaView.tsx`):**
  - Agenda operacional diária, pausa de horários (`is_blocked_slot`), baixa financeira com distinção automática **`Pago`** (`is_paid = true`) vs **`À pagar`** (`is_paid = false`), DRE/Utilidades (`salon_utilities_records`) e Hub **Personalizar Salão** (`salons` + `salon_ui_settings`).

---

## 🧭 3. Engenharia GIS, RTLS & Mapas

1. **Separação Estrita de Mapas:**
   - **Seção `Espaço` (`SalonLocationViewMap.tsx`):** Mapa limpo focado exclusivamente no pino do estabelecimento, sem cálculo de rotas ou telemetria de deslocamento.
   - **Rastreamento de Agendamento (`InteractiveGoogleRouteMap.tsx` / `LiveAppointmentTrackerModal.tsx`):** Navegação vertical **Course-Up ("Frente p/ Cima")**, Map-Matching ortogonal sem tremor, zoom inteiro (`zoom: 17`, `zoomSnap: 1`) sem costuras de tiles e cascata viária de 5 camadas (`Google Routes API v2` ➔ `FOSSGIS OSRM` ➔ `Global OSRM` ➔ `Valhalla OSM` ➔ corredor arterial).
2. **Motor Geotemporal Anti-Colisão (`check_client_inter_salon_collision`):**
   - Impede no frontend e via trigger PostgreSQL (`trg_prevent_inter_salon_collision`) que o mesmo cliente agende horários simultâneos ou sem tempo hábil de deslocamento urbano entre dois estabelecimentos distintos.

---

## 💰 4. Modelo de Monetização Unificado (`mnvapp` ⇄ `admvapp`)

- **Taxa Padrão Corporativa por Agendamento:** **`R$ 2,50`** por atendimento concluído (`billing_fee_value` ⇄ `fee_per_booking`, sincronizados automaticamente por trigger no Supabase).
- **Assinatura Mensal Opcional:** **`R$ 89,90/mês`** (`monthly_subscription_fee`, vencimento padrão dia `10` em `billing_due_day`), 100% customizável individualmente por estabelecimento no Painel Admin Master (`admvapp`).

---

## 📂 5. Estrutura de Diretórios

```
/
├── AGENTS.md                        # Protocolo mestre de engenharia e regras visuais
├── HERMES.md                        # Governança de automações backend (n8n, Evolution API, WAHA)
├── ARCHITECTURE.md                  # Arquitetura técnica atualizada (v5.0)
├── ECOSYSTEM_CONTRACT.md            # Contrato de dados e sincronia entre mnvapp, admvapp e pvapp
├── MASTER_APPROVALS_AND_GUIDELINES.md # Diretrizes consolidadas e especificações aprovadas
├── KNOWLEDGE_BASE.md                # Soluções validadas de UI, GIS/RTLS e deploy
├── DEV_MANUAL.md                    # Manual técnico para desenvolvedores
├── USER_MANUAL.md                   # Guia objetivo de uso para clientes e parceiros
├── CHANGELOG.md                     # Rastreabilidade cronológica (bol-001..bol-159)
├── server.ts                        # Servidor Express (Rotas GIS 5 camadas + Webhooks Hermes)
├── supabase/
│   ├── schema.sql                   # Schema soberano unificado v5.0 (100% idempotente, zero DROP)
│   └── migrations/
│       └── 20261111_master_convergence_v5_0.sql # Migração mestre convergente App + Admin + Portal
└── src/
    ├── App.tsx                      # Portão de autenticação, roteamento white-label e modos
    ├── index.css                    # Tokens globais Tailwind v4 e paleta default verde clarinho
    ├── context/ThemeContext.tsx     # Motor de temas (Light Mint default, Dark Slate e White-Label)
    ├── lib/supabase.ts              # Cliente oficial Supabase tipado
    ├── types/database.types.ts      # Tipagem TypeScript espelhada do banco v5.0
    ├── components/                  # Vitrines, modais de reserva, Auth, Mapas GIS e Painel Pro
    ├── services/                    # Integrações de agendamento, sincronia de salão e webhooks
    └── utils/                       # Cálculos geodésicos, colisão inter-salões e estilos de seção
```
