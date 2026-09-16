# 💈 GUIA DE EXTRAÇÃO & CÓDIGO FONTE COMPLETO: APP DO ESTABELECIMENTO (VAGOU)

Este documento contém o guia definitivo, mapeamento de arquivos e o código de montagem standalone para rodar o **App do Estabelecimento (`SalonProfileView.tsx`)** de forma 100% independente do portal, exatamente como ele está, sem nenhuma alteração.

---

## 📦 1. Mapeamento de Arquivos do Estabelecimento no Repositório

Para rodar o aplicativo do salão em um novo projeto do AI Studio, estes são os arquivos exatos que compõem o sistema (já existentes no seu projeto atual):

| Arquivo Original | Linhas | Função no App do Salão |
| :--- | :---: | :--- |
| `src/components/SalonProfileView.tsx` | **1.553 linhas** | **O Micro-App Central:** Cabeçalho institucional, Landing Page com Scroll Snap, Hero Slide Fullscreen, Catálogo de Serviços (Mosaico 2x2 com Swap/Swipe), Calendário Inline, Apresentação da Equipe (4px), Estrutura e Embed do Google Maps. |
| `src/components/SalonBookingModal.tsx` | **931 linhas** | **Motor de Agendamento em 4 Etapas:** Seleção de Serviços com cálculo acumulado, Calendário Mensal, Carrossel de Profissionais, Grade de Horários e Confirmação com Voucher e Protocolo `#VGA-xxxxx` com rodapé fixo. |
| `src/components/BottomNav.tsx` | ~160 linhas | **Barra Inferior Exclusiva do Estabelecimento:** As 4 abas nativas (`Início`, `Serviços`, `Agendar`, `Espaço`). |
| `src/utils/bookingSlots.ts` | ~35 linhas | Algoritmo determinístico de horários livres e ocupados por data e profissional. |
| `src/utils/haptics.ts` | ~44 linhas | Vibração tátil nativa (`hapticLight`, `hapticMedium`, `hapticSuccess`) para mobile. |
| `src/utils/dateFormatter.ts` | ~30 linhas | Utilitário de formatação de datas curtas `DD/MM às HH:MM`. |
| `src/utils/salonLogos.ts` | ~80 linhas | Gerador de logotipos transparentes SVG/PNG. |
| `src/context/ThemeContext.tsx` | ~40 linhas | Alternador dinâmico de Dark Theme (`slate-950`) e Light Theme (`slate-50`). |
| `src/types.ts` | — | Tipagens do sistema (`ServiceOffer`, `CatalogServiceItem`, etc.). |

---

## 🚀 2. Como Baixar Todo o Código Fonte Original Direto do AI Studio

No canto superior direito da tela do AI Studio:
1. Clique no menu de **Configurações / Três Pontinhos**.
2. Selecione **"Export to ZIP"** (ou "Export to GitHub").
3. O download conterá todos os arquivos intactos, com todas as **1.553 linhas** de `SalonProfileView.tsx` e **931 linhas** de `SalonBookingModal.tsx` sem nenhum corte!

---

## 🖥️ 3. O `App.tsx` Standalone (Ponto de Entrada para o Novo Projeto)

No seu novo projeto no AI Studio, o `App.tsx` deve ser configurado para abrir diretamente o aplicativo do estabelecimento, sem o feed do portal e sem telas intermediárias:

```tsx
// src/App.tsx (Versão Standalone para o Novo Projeto AI Studio)
import React, { useState } from 'react';
import { SalonProfileView } from './components/SalonProfileView';
import { BottomNav, SalonNavContext } from './components/BottomNav';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ServiceOffer } from './types';

// Mock de dados oficial do estabelecimento para operação imediata
const INITIAL_SALON_OFFERS: ServiceOffer[] = [
  {
    id: 'off-1',
    salonName: 'Barbearia Rota 99',
    professionalName: 'Carlos Silva',
    professionalAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    serviceTitle: 'Corte Degradê & Barboterapia',
    serviceCategory: 'cabelo',
    price: 45.0,
    originalPrice: 65.0,
    rating: 4.9,
    ratingCount: 142,
    distance: '350 m',
    distanceMeters: 350,
    neighborhood: 'Vila Madalena, São Paulo',
    timeSlot: 'Hoje • 15:30',
    dayLabel: 'Hoje',
    duration: '45 min',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    lat: -23.5505,
    lng: -46.6883,
    mediaLevel: 2,
    expiresInMinutes: 38,
    expiresTimestamp: Date.now() + 38 * 60 * 1000,
    activeViewers: 12,
    isFlashDeal: true,
    brandGradient: 'from-emerald-950 via-slate-900 to-zinc-950',
    description: 'Corte navalhado com alinhamento perfeito, lavagem com massagem capilar e hidratação com toalha quente na barba.',
  }
];

function StandaloneSalonContent() {
  const { isDark } = useTheme();
  const [salonNavContext, setSalonNavContext] = useState<SalonNavContext | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className={`w-full h-dvh flex flex-col overflow-hidden font-['Poppins'] ${
      isDark ? 'bg-[#151A1E] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Contêiner Principal da Página do Estabelecimento */}
      <main className="flex-1 w-full min-h-0 overflow-hidden relative">
        <SalonProfileView
          salonName="Barbearia Rota 99"
          offers={INITIAL_SALON_OFFERS}
          onBack={() => {
            // Em modo standalone, o botão voltar pode resetar para a aba início
            salonNavContext?.onSelectTab('home');
          }}
          onDirectBook={(offer) => {
            console.log('Agendamento realizado:', offer);
          }}
          isFavorite={isFavorite}
          onToggleFavorite={() => setIsFavorite(!isFavorite)}
          userName="Anderson"
          userAvatarUrl="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
          onRegisterBottomNav={(ctx) => setSalonNavContext(ctx)}
        />
      </main>

      {/* Barra de Navegação Inferior Nativa do Estabelecimento (4 Abas: Início, Serviços, Agendar, Espaço) */}
      <BottomNav
        currentScreen="home"
        onSelectScreen={() => {}}
        salonContext={salonNavContext}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <StandaloneSalonContent />
    </ThemeProvider>
  );
}
```

---

## 🎨 4. O `index.html` e `src/index.css`

### `index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Barbearia Rota 99 — Vagou</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  </head>
  <body class="bg-[#151A1E] text-slate-100 antialiased select-none">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/index.css`:
```css
@import "tailwindcss";

@theme {
  --radius: 4px;
  --radius-xs: 4px;
  --radius-sm: 4px;
  --radius-md: 4px;
  --radius-lg: 4px;
  --radius-xl: 4px;
  --radius-2xl: 4px;
}
```

---

## 💬 5. O Prompt Pronto para Colar no Novo Projeto do AI Studio

Quando você abrir o novo projeto no AI Studio, basta enviar a seguinte mensagem inicial:

```text
Olá! Estou construindo o aplicativo standalone oficial do estabelecimento (Barbearia / Salão) do ecossistema Vagou.
Este app é uma Landing Page mobile-first com 4 seções integradas via Scroll Snap magnético e abas de navegação inferior:
1. Início (Slide Hero Publicitário com CTAs contextuais)
2. Serviços (Catálogo de Procedimentos 2x2 com efeito Swap e fotos em alta definição)
3. Agendar (Ferramenta completa de Agendamento em 4 Etapas com calendário mensal e tabela de horários)
4. Espaço (Equipe com fotos quadradas de 4px, Estrutura e Embed Interativo do Google Maps)

DIRETRIZES INEGOCIÁVEIS:
- Todas as bordas e contêineres usam raio estrito de 4px (rounded: 4px).
- FUNDO VERDE EXIGE TEXTO/ÍCONE BRANCO (#20C933 com text-white).
- Zero "Box dentro de Box": apresentação plana (flat grid) sem aninhar caixas cinzas.
- Ícones importados exclusivamente de 'lucide-react'.
- O botão de confirmação do agendamento deve ser sticky bottom-0 z-20.

Estou colando os componentes oficiais do repositório original (SalonProfileView.tsx, SalonBookingModal.tsx e utilitários) para que funcione exatamente igual, sem alterar nada!
```
