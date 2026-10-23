# Fluxo Inteligente de Agendamento Preditivo (Deslocamento + 15m), Conta Família Inline & Pré-Salvamento (Sincronizado BOL-020)

Reestruturação completa da jornada de agendamento para eliminar cliques redundantes ao selecionar um serviço, validar disponibilidade real no banco de dados somada ao tempo de deslocamento + 15 minutos de preparo do cliente, classificar e bloquear períodos cronologicamente (`Manhã`, `Tarde`, `Noite`, `Todos`), incluir seleção/cadastro rápido de dependentes sem sair da tela e oferecer um Modal Independente de Resumo com suporte a Pré-Salvamento (`vagou_booking_draft_v1`) e persistência preditiva para o Radar "Estou a Caminho" (`BOL-020`).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Plano revisado incorporando integralmente os 4 alinhamentos técnicos da Tríade (`admvapp ⇄ mnvapp` / Boletim `BOL-020`). Clique em **Proceed** para iniciar a codificação.

- **Alinhamento 1 — Persistência Preditiva em `public.appointments` (`BOL-020`):** Ao confirmar o agendamento, os metadados calculados na barra de deslocamento (`distance_km`, `eta_minutes`, `prep_buffer_minutes = 15`, `transport_mode` e `selected_route_summary`) serão salvos diretamente em `public.appointments`, deixando a rota base pronta para o motor de rastreamento "Estou a Caminho" (10s).
- **Alinhamento 2 — Conta Família Inline Sincronizada (`dependents` ⇄ `client_family_members`):** O cadastro e seleção de dependentes no modal rápido sincroniza com as tabelas oficiais e grava `is_dependent = true`, `dependent_id` e `dependent_name` no agendamento confirmado.
- **Alinhamento 3 — Pré-Salvamento Duplo Não-Bloqueante (`vagou_booking_draft_v1`):** O rascunho de Pré-Agendamento é persistido na chave `vagou_booking_draft_v1` do `localStorage`, alimentando simultaneamente o **Banner Flutuante de Retomada em 1 Toque** e o **Card na Minha Agenda** com selo `"Pré-Agendamento (Não garante vaga)"`, gravando em `public.appointments` apenas na confirmação definitiva.
- **Alinhamento 4 — Design System & Anti-Slop (100% `lucide-react` & Contraste Branco no Verde):** Zero emojis no código; uso exclusivo de ícones `lucide-react` (`User`, `Users`, `Scissors`, `Car`, `Calendar`, `Clock`, `MapPin`, `CheckCircle2`, `PauseCircle`), texto e ícones 100% brancos (`text-white`) sobre qualquer superfície verde sólida (`bg-emerald-500` / `bg-[#20C933]`), geometria `rounded-[4px]`, rodapé fixo (`sticky bottom-0 z-20`) e zero Box-in-Box.

---

## 1. Overview & Core Concept

- **What It Does:** Transforma o agendamento do estabelecimento em um motor preditivo e sem fricção:
  1. **Zero Redundância:** Clicou no serviço na vitrine ➔ Abre o modal *Para Você ou Dependente* ➔ Cai direto no Calendário de Datas (Etapa 2), com botão compacto `+ Mais Serviços`.
  2. **Modal Rápido "Para Você ou Dependente" (Inline `admvapp`):** Permite escolher um dependente já cadastrado no banco ou cadastrar um ou mais novos dependentes ali mesmo (Nome Completo, Grau de Parentesco, Data de Nascimento, Observações) sem sair do fluxo de agendamento.
  3. **Trava Anti-Viagem no Tempo + Cálculo de Deslocamento (`ETA + 15 min`):** Consulta primeiro os horários livres no banco de dados e, para agendamentos no dia de **Hoje**, bloqueia horas passadas e qualquer horário anterior a `Hora Atual + Tempo de Deslocamento + 15 min de preparo`.
  4. **Ordem e Bloqueio Inteligente de Turnos:** As abas seguem a ordem **`Manhã` ➔ `Tarde` ➔ `Noite` ➔ `Todos`**, agrupando os cards por período. Se já estivermos à tarde, a aba `Manhã` fica indisponibilizada; se estivermos à noite, `Manhã` e `Tarde` ficam indisponibilizadas.
  5. **Cabeçalho Resumido em Tempo Real:** Exibe no topo o rastro exato do que já foi escolhido com ícones `lucide-react`: `[Scissors] Serviço • [User] Beneficiário • [Calendar] Data (DD/MM) • [Clock] Horário (HH:mm)`.
  6. **Modal Independente de Resumo & Pré-Salvamento:** Ao escolher o horário, abre um modal dedicado para **Confirmar**, **Revisar**, **Cancelar** ou **Pré-Salvar (Pausar)**.
- **Target Audience / Persona:** Clientes agendando serviços para si ou familiares e gestores validando a precisão logística da agenda.
- **Key Value:** Impede agendamentos impossíveis de cumprir por falta de tempo de deslocamento, alimenta o radar "Estou a Caminho" (`BOL-020`) e reduz o abandono no meio do fluxo.

---

## 2. User Experience & Visual Design

- **Key User Flows:**
  1. **Seleção na Vitrine ➔ Modal "Para Quem é o Agendamento?":**
     - Ao clicar em qualquer card de serviço na aba *Serviços*, abre imediatamente um modal enxuto com duas opções claras com ícones `lucide-react`: **[ User: Para Você ]** ou **[ Users: Para Dependente ]**.
     - Escolhendo **Para Dependente**, o mesmo modal expande a lista de dependentes do cliente sincronizada do banco (`dependents` / `client_family_members`). Inclui sempre o botão **"+ Cadastrar Dependente"**, que abre os campos oficiais (`admvapp`) dentro do próprio modal, salva no banco e já seleciona o dependente (`dependent_id` e `dependent_name`) para prosseguir.
     - Confirmado o beneficiário, o fluxo aterrissa direto na **Etapa 2 (Selecione a Data)**.
  2. **Cabeçalho Dinâmico de Seleção (Breadcrumb Ao Vivo):**
     - No cabeçalho do agendamento, uma faixa limpa exibe em linha única os itens já definidos usando ícones `lucide-react`:
       `[Scissors] Tratamento (R$ 50) • [User] Noemi • [Calendar] 22/10 • [Clock] 13:30` (com botão rápido `+ Serviço` caso deseje incluir outro procedimento).
  3. **Etapa de Horários com Comparador de Endereço + Turnos Inteligentes:**
     - **Barra Comparadora Compacta no Topo de Horários:** Permite informar um endereço ou CEP de origem para teste em tempo real (via ViaCEP / Nominatim + cálculo Haversine urbano) ou usar a localização atual. Mostra a equação ao vivo:
       `[Car] Deslocamento: 45 min + 15 min preparo = +1h00 ➔ Liberado a partir das 13:00`.
     - **Abas de Período (`Manhã` | `Tarde` | `Noite` | `Todos`):**
       - Se o horário mínimo calculado para Hoje for `13:00`, a aba **Manhã** aparece desabilitada (`Indisponível`) e a aba **Tarde** já vem selecionada por padrão.
       - Na aba **Todos**, os horários aparecem classificados e agrupados sob os cabeçalhos **Manhã**, **Tarde** e **Noite**, mantendo bloqueados os horários ocupados no banco ou insuficientes para o deslocamento (`Hora Atual + ETA + 15 min`).
  4. **Modal Independente de Resumo + Pré-Salvamento (`vagou_booking_draft_v1`):**
     - Ao tocar no horário desejado e avançar, abre um **Modal Independente** sobreposto com todos os dados consolidados, resumo do tempo de deslocamento calculado, WhatsApp de contato e 4 ações no rodapé fixo (`sticky bottom-0 z-20`):
       - **Confirmar Agendamento** (grava definitivamente em `public.appointments` incluindo `distance_km`, `eta_minutes`, `prep_buffer_minutes = 15`, `transport_mode`, `selected_route_summary`, `is_dependent`, `dependent_id`, `dependent_name`).
       - **Pausar / Pré-Salvar** (salva em `vagou_booking_draft_v1` com aviso claro de que *não reserva a vaga até confirmar*, exibindo barra flutuante de retomada e card na Minha Agenda).
       - **Revisar** (fecha o modal de resumo e permite ajustar data, horário ou serviço).
       - **Cancelar** (descarta a seleção e limpa rascunho ativo).

- **Visual Identity & Theme:**
  - *Aesthetic Direction:* Mobile-First Flat & Clean (geometria de `4px`, zero "caixa dentro de caixa", síntese textual máxima e 100% ícones `lucide-react`).
  - *Color Palette & Mood:* Superfícies `slate-950` / `slate-900` no modo escuro e `white` / `slate-50` no modo claro; botões ativos com `bg-emerald-500` / `bg-[#20C933]` e **texto/ícones 100% brancos (`text-white`)**.
  - *Typography & Hierarchy:* Títulos em `Poppins` (`font-bold` / `font-black`), numerais tabulares (`tabular-nums`) para horários, preços e contadores de deslocamento.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Equação de Bloqueio de Horários (`Banco de Dados + Hora Atual + Deslocamento + 15 min`):**
  - *Chosen Approach:* Antes de renderizar a grade do dia, o sistema consulta os agendamentos ocupados no banco de dados (`public.appointments` + RPC `get_busy_slots`) e calcula o corte mínimo (`cutoffMinutes = nowMinutes + etaMinutes + 15`). Qualquer slot cujo horário seja menor que `cutoffMinutes` fica bloqueado.
  - *Why:* Garante que o cliente nunca agende um horário em que seja fisicamente impossível chegar a tempo e já abastece os metadados do radar `BOL-020`.
- **Decision 2 — Cadastro de Dependente 100% Inline no Fluxo:**
  - *Chosen Approach:* O formulário de dependentes utiliza a mesma estrutura sincronizada com o `admvapp` (`public.dependents` ⇄ `public.client_family_members`), embutido dentro do modal "Para Você ou Dependente?".
  - *Why:* Evita que o cliente perca o serviço selecionado tendo que sair da tela para cadastrar um familiar.
- **Decision 3 — Pré-Salvamento Local (`vagou_booking_draft_v1`) com Duplo Ponto de Retomada:**
  - *Chosen Approach:* Persiste o estado completo da escolha em `vagou_booking_draft_v1`, exibindo tanto o banner flutuante na vitrine quanto o card com badge `Pré-Agendamento (Não garante vaga)` na Minha Agenda, sem bloquear o horário no banco até a confirmação.
  - *Why:* Permite pausar o agendamento com transparência total e retomar em 1 toque.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        VITRINE DE SERVIÇOS (Aba Serviços)                    │
│              Toque no Card do Serviço ➔ Dispara Seleção Direta               │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            MODAL RÁPIDO: "PARA VOCÊ OU DEPENDENTE?" (Pré-Data)               │
│  ┌─────────────────────────┐          ┌───────────────────────────────────┐  │
│  │  [ User: Para Você ]    │          │     [ Users: Para Dependente ]    │  │
│  └───────────┬─────────────┘          └─────────────────┬─────────────────┘  │
│              │                                          ▼                    │
│              │                        ┌───────────────────────────────────┐  │
│              │                        │ Lista do Banco + Botão "+ Novo"   │  │
│              │                        │ Form Inline (Padrão admvapp)      │  │
│              │                        └─────────────────┬─────────────────┘  │
└──────────────┼──────────────────────────────────────────┼────────────────────┘
               └───────────────────────┬──────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│       CABEÇALHO DE TRILHA AO VIVO (Serviço • Beneficiário • DD/MM • HH:mm)   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ETAPA 2: CALENDÁRIO DE DATAS (Datas passadas bloqueadas + Botão +Serviço)   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3: HORÁRIOS + COMPARADOR DE ENDEREÇO EM TEMPO REAL                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [MapPin] Simulador Endereço/CEP: [ Digite endereço... ] ➔ 45m+15m = 1h │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Abas: [ Manhã (Bloq se Tarde) ] ➔ [ Tarde ] ➔ [ Noite ] ➔ [ Todos ]    │  │
│  │ Cards agrupados por período • Verifica vagas no Banco + Corte ETA+15m  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│          MODAL INDEPENDENTE DE RESUMO, CONFIRMAÇÃO & PRÉ-SALVAMENTO          │
│  [ Confirmar (BOL-020) ]  [ Pré-Salvar Rascunho ]  [ Revisar ]  [ Cancelar ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State:**
  - **Cálculo de Tempo e Distância (`ETA + 15 min`):** Geocodificação em tempo real via Nominatim / ViaCEP + fórmula de Haversine somada aos `15 minutos` fixos de preparação (`prep_buffer_minutes = 15`), gerando `distance_km`, `eta_minutes`, `transport_mode` e `selected_route_summary`.
  - **Sincronização de Vagas Ocupadas:** Consulta em tempo real na tabela `public.appointments` (filtrando `salon_id` e `appointment_date` com status ativo) combinada ao RPC `get_busy_slots`.
  - **Persistência de Dependente:** Gravação de `is_dependent = true`, `dependent_id` e `dependent_name` no payload de `public.appointments`.
  - **Estado de Pré-Agendamento (`vagou_booking_draft_v1`):** Objeto persistido no `localStorage` alimentando o Banner Flutuante de retomada rápida na vitrine e o card identificado na Minha Agenda (`UserAppointmentsView` / `ProfileDrawer`).
