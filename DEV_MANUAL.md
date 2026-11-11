# 🛠️ Manual de Engenharia & Design UI/UX — Vagou (`mnvapp`)

> **Versão:** 5.0.0  
> **Público-Alvo:** Engenheiros Frontend/Full-Stack e Designers UI/UX da Tríade VagouApp  
> **Objetivo:** Documentar os tokens visuais vigentes, regras inegociáveis de contraste, hierarquia de camadas (`z-index`), taxonomia de componentes e contratos de banco do **Meu Negócio & Vitrine White-Label (`mnvapp`)**.

---

## 🎨 1. Design System & Paleta Oficial (`bol-158`)

O aplicativo opera com suporte dinâmico via `ThemeContext` (**Light Mint Default**, **Dark Slate** e **White-Label Customizado por Salão**):

| Elemento | Token Default (Modo Claro Verde Pastel) | Modo Escuro (Dark Slate) | Regra de Contraste |
| :--- | :--- | :--- | :--- |
| **Fundo Geral (`canvas`)** | `#F0FDF4` (moldura externa `#DCFCE7`) | `slate-950` (`#020617`) | Texto principal `#1E293B` (claro) / `#F8FAFC` (escuro). |
| **Cabeçalho & `BottomNav`** | `#D1FAE5` com borda `#A7F3D0` (`solid`) | `#151A1E` com borda `slate-800` | Ícones e textos inativos em `#065F46` (claro) / `slate-300` (escuro). |
| **Subcabeçalhos (`SectionHeader`)** | `#ECFDF5` com texto `#065F46` e ícone `#059669` | `slate-900` com texto `white` | Alinhado logo abaixo do cabeçalho sem vão visual. |
| **Botão Ativo de Fundo Branco** | Fundo `#FFFFFF` no `BottomNav` | Fundo `#FFFFFF` (quando aplicável) | Ícone, texto e indicador superior assumem **obrigatoriamente a cor do tema** (`#059669` / `#10B981` ou cor do salão). |
| **Verde Destaque / CTA Sólido** | `#10B981` / `#20C933` (`emerald-500/600`) | `#10B981` / `#20C933` | **REGRA INEGOCIÁVEL:** Fundo verde sólido exige **100% texto e ícone branco puro (`text-white`)**. Proibido texto escuro sobre verde sólido. |
| **Geometria & Bordas** | Raio global `4px` (`rounded-[4px]`) | Raio global `4px` | **Proibido "Box dentro de Box"** (nunca aninhar `border rounded` dentro de `border rounded`). |

---

## 📐 2. Hierarquia de Camadas (`z-index`)

```
z-50: Cabeçalho Principal MobileHeader (menu suspenso do usuário nunca é coberto) e Modais Críticos
  └── z-40: Barras superiores fixas secundárias
        └── z-30: Barra de navegação inferior fixa (BottomNav)
              └── z-20: Modais operacionais (SalonBookingModal, LiveAppointmentTrackerModal) e rodapés sticky (sticky bottom-0 z-20)
                    └── z-10: Controles interativos internos de cards e subcabeçalhos de seção
                          └── z-0: Conteúdo rolante das abas isoladas
```

---

## 🧩 3. Arquitetura de Componentes Principais

### 3.1. Portão Obrigatório de Autenticação (`src/App.tsx` + `PartnerAuthView.tsx`)
- Nenhum visitante acessa o aplicativo sem sessão válida (`hasActiveAppSession()`).
- Zero dados fictícios (`sanitizeMockStorageData()` remove resíduos legados de mock no `localStorage`).
- Cadastro unificado (`TriadeUserRegisterForm.tsx`) com validação de CPF, WhatsApp, endereço ViaCEP/GIS e **Pergunta de Segurança** (`security_questions`).

### 3.2. Vitrine White-Label do Salão (`SalonProfileView.tsx` + `BottomNav.tsx`)
- 4 seções 100% isoladas (`AnimatePresence mode="wait"`), onde cada seção exibe exatamente o mesmo título do seu respectivo botão no `BottomNav`:
  1. **`Início`** (`home`): Destaques, comodidades, mídias e atalho rápido de agendamento.
  2. **`Serviços`** (`servicos`): Catálogo plano categorizado com preços, durações e mídia.
  3. **`Agenda`** (`vagas`): Calendário inteligente, vagas disponíveis e agendamentos ordenados do mais próximo para o mais distante (`date_str ASC, start_time ASC`).
  4. **`Espaço`** (`espaco` — ou **`Atendimento`** em Home Care): Equipe em layout plano, fotos do ambiente e mapa estático do pino (`SalonLocationViewMap.tsx`, sem traçado de rotas).

### 3.3. Agendamento, Permuta & Navegação GPS/RTLS (`SalonBookingModal.tsx` & `InteractiveGoogleRouteMap.tsx`)
- **Fluxo de Reserva:** Seleção de serviço, titular ou dependente (Conta Família), profissional, horário validado contra colisão inter-salões (`check_client_inter_salon_collision`) e origem de deslocamento (`Local Atual`, `De Casa`, `Outro Local`) com spinner limpo sem texto.
- **Cockpit GPS Ao Vivo:** Navegação vertical **Course-Up ("Frente p/ Cima")**, Map-Matching ortogonal sobre a via, velocímetro `km/h`, ETA regressivo `HH:MM` e alerta automático de chegada (`<= 150m`) via backend (`server.ts` ➔ Hermes Agent).

### 3.4. Painel Operacional do Parceiro (`ProfessionalDashboardView.tsx`)
- Gestão da agenda do dia, bloqueio/pausa de horários (`is_blocked_slot`), baixa de caixa (`Pago` vs `À pagar`), DRE/medidores (`salon_utilities_records`) e customização visual em tempo real (`salons` + `salon_ui_settings`).
