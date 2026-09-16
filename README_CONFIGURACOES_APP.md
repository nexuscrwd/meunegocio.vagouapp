# 📱 VAGOU - Documentação Completa da Aplicação & Configurações de Sistema

> **Projeto:** VAGOU (Plataforma de Agendamento Imediato & Ociosidade para Beleza e Estética)  
> **Versão:** v1.2.0 (PWA Mobile First + Painel do Estabelecimento)  
> **Data:** Agosto de 2026  

---

## 📑 Índice
1. [Visão Geral e Proposta de Valor](#1-visão-geral-e-proposta-de-valor)
2. [Arquitetura e Tecnologias](#2-arquitetura-e-tecnologias)
3. [Módulo do Cliente (App Mobile / PWA)](#3-módulo-do-cliente-app-mobile--pwa)
4. [Módulo do Estabelecimento (Vagou Parceiro)](#4-módulo-do-estabelecimento-vagou-parceiro)
5. [Sistema de Notificações PWA & Lembretes](#5-sistema-de-notificações-pwa--lembretes)
6. [Estrutura de Dados e Tipos TypeScript](#6-estrutura-de-dados-e-tipos-typescript)
7. [Mapa de Telas e Componentes](#7-mapa-de-telas-e-componentes)
8. [Configurações de Build, PWA & Deploy](#8-configurações-de-build-pwa--deploy)

---

## 1. Visão Geral e Proposta de Valor

O **VAGOU** é uma solução completa em dois lados (*Two-Sided Platform*) focada em combater o principal problema financeiro de salões de beleza, barbearias e clínicas de estética: a **ociosidade de cadeiras e horários vagos**.

* **Para o Cliente:** Encontra vagas imediatas ("para hoje" ou "amanhã") por proximidade no mapa, com preços promocionais relâmpago, confirmação em 1 toque e lembretes push no celular 30 minutos antes.
* **Para o Estabelecimento / Profissional:** Publica horários vagos em menos de 10 segundos, gerencia a agenda do dia em formato lista, controla pausas/intervalos de almoço e visualiza a ociosidade recuperada em tempo real.

---

## 2. Arquitetura e Tecnologias

* **Frontend:** React 18 + TypeScript + Vite.
* **Estilização & Design System:** Tailwind CSS (Mobile First, paleta Esmeralda/Slate com alto contraste e design profissional).
* **Ícones:** Lucide React.
* **PWA & Mobile Capabilities:** Service Worker, Web App Manifest, Notification API (notificações push locais) e suporte a instalação nativa com Prompt e Standalone detection.
* **Persistência de Dados:** Sincronização em tempo real em memória com persistência local via `localStorage` (favoritos, configurações e reservas).
* **Backend Ready:** Servidor Node.js Express com suporte a endpoints de integração.

---

## 3. Módulo do Cliente (App Mobile / PWA)

### 3.1. Tela Inicial & Radar de Vagas (`HomeScreen`, `RadarStoryBar`, `RadarOfferCard`, `RadarStoryModal`)
* **Radar ao Vivo & Stories 9:16:** Barra superior interativa no formato stories com anel gradiente animado e abertura em tela cheia com barra de progresso sequencial e botão de reserva rápida em 1 toque.
* **3 Níveis de Mídia Adaptativa:**
  - **Nível 3 (Vídeo Vertical):** Reprodução automática em loop com controle de áudio (*Mute/Unmute*) e playback.
  - **Nível 2 (Carrossel de Fotos):** Navegação entre múltiplas fotos com indicadores circulares.
  - **Nível 1 (Fallback Animado):** Ilustrações dinâmicas vetorizadas por categoria (`cabelo`, `barba`, `unhas`, `beleza`) com partículas e gradiente de marca exclusivo para salões sem fotos cadastradas.
* **Contador de Urgência em Tempo Real (`CountdownTimer`):** Barra de progresso visual com contagem regressiva de expiração da vaga e alerta de *Vaga Relâmpago*.
* **Prova Social & Retenção:** Indicador de *"X pessoas vendo agora"* e badge de histórico *"Você já frequentou"*.
* **Filtros e Ordenação Inteligente:** Filtro por categorias e ordenação por Urgência (tempo restante), Proximidade (distância) e Menor Preço.
* **Header:** Indicador de Radar Ativo, busca em tempo real e atalho direto para o modo Salão Parceiro.

### 3.2. Mapa Vetorial Interativo (`MapScreen`)
* Mapa vetorial estilizado e leve.
* Pinos com identificação visual dos preços e especialidades.
* Card flutuante (*bottom sheet*) com detalhes do salão selecionado no pino e CTA para ver oferta.

### 3.3. Lista de Ofertas com Filtros & Skeleton Loader (`OfferListScreen` & `SkeletonLoader`)
* Filtros rápidos por: **Distância**, **Preço** e **Avaliação**.
* Transição com animação de Skeleton Screen para sensação de carregamento instantâneo.

### 3.4. Detalhes da Vaga & Reserva (`OfferDetailScreen`)
* Foto em alta resolução com botões de voltar, favoritar e compartilhar via Web Share API.
* Seção **Horário da Reserva**: Dia, Horário e Duração.
* Selo de Proteção e Política Clara de Cancelamento.
* Botão de Ação: **"RESERVAR AGORA"**.

### 3.5. Confirmação & Protocolo (`ConfirmationScreen`)
* Cartão de confirmação com animação de sucesso.
* Código do Protocolo gerado automaticamente (ex: `#VGA-48921`).
* Resumo do endereço, horário e instruções de chegada.
* Disparo automático do lembrete de 30 minutos via Notification API.

### 3.6. Minha Agenda & Cancelamento (`AgendaScreen` & `CancelModal`)
* Abas entre agendamentos **"Em Andamento"** e histórico **"Concluídos"**.
* Ação de **Cancelar Vaga** com modal de confirmação transparente.

### 3.7. Perfil do Usuário & Favoritos (`ProfileScreen`)
* Gerenciador de Notificações PWA (botão de permissão e teste).
* Lista completa de **Meus Favoritos** salvos.
* Banner de instalação do aplicativo no celular.
* Acesso direto ao modo Parceiro / Estabelecimento.

---

## 4. Módulo do Estabelecimento (Vagou Parceiro)

### 4.1. Agenda do Dia & Calendário Dinâmico (`PartnerAgendaScreen`)
* **Abertura Inteligente:** Sempre abre no dia atual por padrão.
* **Navegador de Meses & Anos:** Setas `<` e `>` para navegar entre os meses e botão **"Ir para Hoje"**.
* **Carrossel Horizontal de Dias:** Faixa de dias do mês com contadores visuais de horários agendados e vagas abertas.
* **Filtro de Equipe:** Visualização de todos os profissionais ou filtro individual por especialista.
* **Lista Cronológica de Horários:**
  - **Confirmado:** Dados do cliente, serviço, botão direto de WhatsApp e ações *Iniciar Atendimento* ou *Não Compareceu (No-Show)*.
  - **Em Atendimento:** Destaque pulsante em verde e botão *Concluir Atendimento*.
  - **Vaga Publicada:** Badge de vaga ativa no radar do app com botão de pausar.
  - **Horário Livre:** Botão com 1 toque para *Publicar no Vagou*.
* **Resumo de Métricas Diárias:** Total de atendimentos, vagas no app e previsão de faturamento do dia.

### 4.2. Grade de Horários, Dias & Intervalos (`PartnerScheduleConfigScreen`)
* **Escopo Flexível:** Aplicação de horários para o **Salão Inteiro (Regra Geral)** ou **Individual por Profissional**.
* **Duração do Atendimento:** Seletor rápido de tempo padrão de slot (30, 45, 50 ou 60 minutos).
* **Controle Dia a Dia:** Liga/desliga de funcionamento para cada dia da semana com horário de abertura e fechamento.
* **Intervalos de Descanso Dinâmicos:** Adição e edição de intervalos de almoço e pausas com horário de início e término.
* **Cadastro de Novos Profissionais:** Modal para inclusão de novos membros na equipe com nome, cargo, telefone e cor temática.

### 4.3. Publicador de Vagas Relâmpago (`PartnerPublishModal`)
* Publicação de vagas ociosas em menos de 10 segundos.
* Seleção de profissional, serviço, categoria, dia (Hoje/Amanhã) e horário.
* Campo de preço com cálculo dinâmico de percentual de desconto (*"-% OFF"*).
* Sincronização imediata: a vaga passa a ser listada na hora para os clientes no app.

### 4.4. Painel do Salão & Métricas (`PartnerProfileScreen`)
* Dashboard de **Ociosidade Recuperada no Mês** (R$ recuperados e taxa de ocupação).
* Gerenciamento de equipe e links públicos de divulgação.
* Botão para alternar de volta ao Modo Cliente.

---

## 5. Sistema de Notificações PWA & Lembretes

Localizado em `/src/utils/notifications.ts`:
* **`requestNotificationPermission()`**: Solicita autorização nativa do navegador/dispositivo.
* **`sendLocalNotification(title, options)`**: Dispara notificações locais imediatas com ícone e badge personalizados.
* **`scheduleAppointmentReminder(service, salon, time)`**: Agenda automaticamente alerta com o lembrete de comparecimento 30 minutos antes do início do serviço.

---

## 6. Estrutura de Dados e Tipos TypeScript

Localizado em `/src/types.ts`:
* `AppMode`: `'client' | 'partner'`
* `ScreenId`: `'home' | 'mapa' | 'lista-ofertas' | 'detalhe-oferta' | 'confirmacao' | 'agenda' | 'perfil'`
* `PartnerScreenId`: `'partner-agenda' | 'partner-publish' | 'partner-schedule-config' | 'partner-profile'`
* `DayScheduleConfig`: Representa a escala de funcionamento diária e seus intervalos (`TimeBreak[]`).
* `PartnerProfessional`: Representa o membro da equipe, sua especialidade, cor e agenda.
* `PartnerAppointmentItem`: Representa o agendamento no painel com status (*CONFIRMADO, EM_ATENDIMENTO, CONCLUIDO, CANCELADO, NO_SHOW, VAGA_PUBLICADA, HORARIO_LIVRE*).
* `ServiceOffer`: Oferta pública consumida pelos clientes no aplicativo.

---

## 7. Mapa de Telas e Componentes

```
src/
├── App.tsx                           # Controlador mestre de estado, modo e navegação
├── data.ts                           # Mock inicial e modelos de dados
├── types.ts                          # Tipos TypeScript centralizados
├── index.css                         # Diretivas Tailwind e estilização base
├── main.tsx                          # Entry point React
│
├── components/
│   ├── HomeScreen.tsx                # Tela inicial do cliente
│   ├── MapScreen.tsx                 # Mapa de salões e vagas próximas
│   ├── OfferListScreen.tsx           # Listagem com filtros de busca
│   ├── OfferDetailScreen.tsx         # Detalhes da vaga e checkout
│   ├── ConfirmationScreen.tsx        # Confirmação com protocolo e lembrete
│   ├── AgendaScreen.tsx              # Agenda do cliente
│   ├── ProfileScreen.tsx             # Perfil do cliente e favoritos
│   ├── BottomNav.tsx                 # Barra inferior do cliente
│   ├── CancelModal.tsx               # Modal de cancelamento de agendamento
│   ├── SkeletonLoader.tsx            # Telas esqueleto para carregamento fluido
│   ├── InstallModal.tsx              # Modal universal de instalação PWA
│   ├── InstallBanner.tsx             # Banner de instalação rápida
│   │
│   ├── PartnerAgendaScreen.tsx       # Calendário e lista de atendimentos do salão
│   ├── PartnerScheduleConfigScreen.tsx # Cadastro de horários, dias e intervalos
│   ├── PartnerPublishModal.tsx       # Modal de publicação de vaga relâmpago
│   ├── PartnerProfileScreen.tsx      # Dashboard financeiro e equipe
│   └── PartnerBottomNav.tsx          # Barra inferior do estabelecimento
│
└── utils/
    └── notifications.ts              # Utilitários de notificações PWA
```

---

## 8. Configurações de Build, PWA & Deploy

* **Porta de Execução:** 3000 (bind `0.0.0.0`)
* **Comando de Desenvolvimento:** `npm run dev` (`tsx server.ts`)
* **Comando de Compilação:** `npm run build` (`vite build && esbuild server.ts ...`)
* **Manifest Web App:** Configurado no `index.html` com suporte a `standalone`, cores de tema `#059669` (Emerald 600) e ícones responsivos.

---
*Documentação gerada e salva com sucesso no repositório do projeto.*
