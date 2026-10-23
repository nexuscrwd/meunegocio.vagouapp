# Blindagem Integral de Persistência (SQL, Cores, Estilos, Galeria de Serviços, Compartilhamento e Todos os CRUDs no Supabase & PWA)

Este plano revisado incorpora a auditoria do **código SQL do Supabase**, a nova **Galeria Temática para Serviços sem Imagem** e a **limpeza do Compartilhamento (apenas Nome do App e Slogan)**, além de resolver de ponta a ponta a persistência de cores, estilos e todos os CRUDs entre navegadores e PWA.

---

## Decisões Confirmadas & Escopo Revisado

> [!IMPORTANT]
> Diretrizes aprovadas e adições solicitadas nesta revisão:

1. **Auditoria e Atualização do Código SQL (`supabase/schema.sql` + Nova Migration):**
   - O SQL atual não possuía colunas nem tabela específica para as cores/estilos de cabeçalho de seções, barra de navegação inferior (`BottomNav`), botões das barras, CPF do titular, chaves PIX múltiplas, fotos/comodidades do espaço e feriados. Isso fazia o Supabase rejeitar o `UPDATE` completo por *coluna inexistente* (`42703`) e cair em um fallback que descartava as cores.
2. **Galeria Temática Integrada para Serviços sem Imagem:**
   - Criação de um acervo visual curado por categoria (Unhas/Nail Design, Cabelo, Barba, Cílios/Sobrancelhas, Estética, Massagem/Spa e Combos) disponível com 1 toque tanto dentro do modal **Criar/Editar Serviço** quanto na **Biblioteca de Fotos**, além de capa temática elegante quando o serviço não tiver foto própria.
3. **Compartilhamento Limpo (Apenas Nome do App e Slogan):**
   - Remoção de textos longos automáticos e atualização dinâmica das tags `<title>`, `og:title`, `og:description` e `navigator.share` para enviar **exclusivamente o Nome do App e o Slogan do estabelecimento**, além de impedir que o fallback do banco carregue outro salão (como *"Momy nail"*) sobre a sessão do estabelecimento.
4. **Resolução de Conflitos, RLS e Storage:**
   - Prioridade para o banco Supabase com cache local sincronizado, vínculo automático de `owner_id` (sem falso positivo de `"✓ Salvo"`) e upload de imagens no Supabase Storage com fallback comprimido automático.

---

## 1. Diagnóstico Forense do SQL Atual vs. O Que Falta no Banco

### O que encontramos ao auditar `/supabase/schema.sql` e `/supabase/migrations/`:

1. **Por que o SQL atual falha ao salvar Cores, Cabeçalhos e Barra Nav?**
   - Na tabela `public.salons` (`supabase/schema.sql`, linhas 21–79), existem apenas `primary_color`, `secondary_color`, `brand_font`, `slogan` e `branding JSONB`.
   - **Não existem no SQL atual:**
     - Tabela ou colunas dedicadas para **Barra de Títulos das Seções** (`section_header_bg_color`, `section_header_text_color`, `section_header_icon_color`, `section_header_bg_style`, `section_header_border`, `section_header_btn_*`).
     - Colunas para **Barra de Navegação Inferior / Rodapé** (`nav_style`, `nav_shape`, `nav_border`, `nav_bg_style`, `nav_bg_color`, `nav_btn_bg_color`, `nav_btn_active_bg_color`, `nav_active_color`, `nav_text_color`, `nav_btn_shadow`, `nav_btn_blur`, `nav_btn_font`).
     - Colunas para **Cabeçalho e Tema do App** (`default_theme`, `pwa_name`, `show_slogan`, `logo_text_fallback`, `logo_text_color`, `show_hero_slides`, `welcome_style`).
     - Colunas administrativas que a função `updateSalonSettingsInDb` tentava gravar diretamente na linha 2500 (`owner_cpf`, `pix_keys`, `category`, `opening_hours_text`, `space_photos`, `space_description`, `amenities`, `holidays`, `cancellation_policy`, `website_url`, `instagram_url`, `facebook_url`, `maps_url`).
   - **Consequência Real:** Quando o app tentava fazer `UPDATE public.salons SET category = ..., space_photos = ...`, o PostgreSQL retornava erro de coluna inexistente. O código então caía num bloco de fallback (`minimalPayload`) que **não incluía nenhuma cor de cabeçalho de seção nem de barra de navegação** dentro do JSON `branding`!

### Como vamos atualizar o SQL (Dupla Garantia: Relacional + JSONB)

Criaremos a migration oficial `supabase/migrations/20261023_salon_styles_and_crud_full.sql` e atualizaremos `supabase/schema.sql` contendo:

1. **Nova Tabela Dedicada `public.salon_ui_settings` (Estilos de Cabeçalho, Seções, Barra Nav e Tema):**
   - Vinculada por `salon_id UUID UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE`.
   - Armazena de forma estruturada e auditável todas as cores e estilos de **Cabeçalho Principal**, **Barra de Títulos das Seções (`section_header_*`)**, **Barra de Navegação Inferior (`nav_*`)** e **Tema Padrão (`default_theme`)**.
2. **Adição das Colunas Faltantes em `public.salons`:**
   - `default_theme`, `pwa_name`, `show_slogan`, `logo_text_fallback`, `logo_text_color`, `show_hero_slides`, `welcome_style`, `section_header_bg_color`, `section_header_text_color`, `section_header_icon_color`, `section_header_bg_style`, `section_header_border`, `nav_style`, `nav_shape`, `nav_border`, `nav_bg_style`, `nav_bg_color`, `nav_active_color`, `nav_text_color`, `owner_cpf`, `pix_keys`, `category`, `opening_hours_text`, `space_photos`, `space_description`, `amenities`, `holidays`, `cancellation_policy`, `website_url`, `instagram_url`, `facebook_url`, `maps_url`.
3. **Espelhamento Simultâneo em `salons.branding` (JSONB):**
   - O código salvará todas as chaves em `salons.branding`, nas colunas de `public.salons` (com detecção resiliente caso a migration ainda não tenha sido rodada no painel do Supabase) e em `public.salon_ui_settings`. Assim, **as cores funcionam imediatamente** mesmo antes de rodar o SQL manual, e ficam 100% normalizadas no banco assim que o script SQL for aplicado.

---

## 2. Ideia & Solução: Galeria Temática para Serviços Sem Imagem

### O Problema Atual
Em `ProfessionalServicesManager.tsx`, a constante `INITIAL_SAVED_IMAGES` estava vazia (`[]`). Quando o profissional editava ou criava um serviço e não tinha foto própria no celular, a Biblioteca aparecia vazia (*"Nenhuma imagem nesta categoria"*) e a vitrine exibia um bloco cinza sem vida com um ícone genérico.

### Nossa Solução (3 Camadas Visuais Prontas para Uso)

1. **Acervo Curado de Alta Conversão por Categoria (`src/utils/serviceGalleryPresets.ts`):**
   - Biblioteca nativa integrada com fotos profissionais divididas pelas categorias reais do salão:
     - **Unhas & Nail Design:** Alongamento em fibra, esmaltação em gel, manicure clássica, blindagem, spa dos pés.
     - **Cabelo & Escova:** Corte feminino, escova modelada, mechas/iluminado, hidratação profunda, progressiva.
     - **Barbearia & Corte Masculino:** Degradê navalhado, corte social/tesoura, platinado, infantil.
     - **Barba & Rosto:** Barboterapia com toalha quente, alinhamento e pigmentação, limpeza de pele.
     - **Cílios & Sobrancelhas:** Extensão de cílios, lash lifting, design com henna, micropigmentação.
     - **Estética & Bem-Estar:** Massagem relaxante, drenagem linfática, depilação, combos promocionais.
2. **Seletor Rápido "Galeria Sugerida" Dentro do Modal de Criar/Editar Serviço:**
   - Na seção **"6. Mídia do Serviço"** do modal de criação e edição (`ProfessionalServicesManager.tsx`), quando o serviço estiver sem foto, exibiremos imediatamente uma faixa horizontal **"Sugestões da Galeria para [Categoria]"** com miniaturas prontas.
   - Com **1 toque**, o profissional escolhe uma imagem profissional da categoria (ou abre a aba *"Galeria Vagou"* dentro da Biblioteca de Fotos para escolher até 5 fotos para o modo Slide).
3. **Capa Visual Temática Automática no Card (`ServiceCardMedia`):**
   - Caso um serviço ainda não tenha foto definida, em vez do retângulo cinza vazio com ícone de boneco, o card exibirá uma **capa temática elegante correspondente à categoria do serviço** (ou permitirá aplicar a foto sugerida da categoria com 1 clique).

---

## 3. Solução para o Compartilhamento ("Momy nail" e Texto Enorme)

### Causa Identificada
1. **Texto Longo Hardcoded:**
   - Em `SalonProfileView.tsx` (linha 691), a função `handleShare` montava `const shareText = "Confira os serviços e horários disponíveis em ${shareTitle} no Vagou!";` e o `pwaAssets.ts` (linha 58) injetava `"Aplicativo oficial do estabelecimento... Catálogo de serviços, agendamentos e atendimento."`.
2. **Aparição de `"Momy nail"` no Compartilhamento / Preview:**
   - Em `src/lib/supabase.ts` (`ensureSalonRow`, linha 2278), quando o app abria sem `slug` fixado na URL, a cláusula `.order('created_at', { ascending: true }).limit(1)` pegava o salão mais antigo cadastrado na tabela `public.salons` (ex.: `"Momy nail"`) e sobrescrevia o cache! Além disso, as meta tags OpenGraph (`og:title`, `og:description`) do `index.html` não eram atualizadas com o Nome do App e Slogan reais do salão ativo.

### Correção Exata
- **Em `SalonProfileView.tsx` (`handleShare`):**
  - `shareTitle` usará estritamente o **Nome do App / Estabelecimento** (`adminSettings.pwaName || adminSettings.salonName`).
  - `shareText` enviará **apenas o Nome do App e o Slogan** (ex.: se houver slogan: `${shareTitle} — ${adminSettings.slogan}`; se não houver slogan: apenas `${shareTitle}`). Zero frases propagandísticas longas.
- **Em `src/utils/pwaAssets.ts` e `index.html`:**
  - Atualizar dinamicamente `<title>`, `<meta name="description">`, `<meta property="og:title">` e `<meta property="og:description">` para conter **exclusivamente o Nome do App e o Slogan do estabelecimento**, garantindo que a prévia gerada pelo WhatsApp/Instagram mostre apenas Nome + Slogan.
- **Em `src/lib/supabase.ts` (`ensureSalonRow`):**
  - Priorizar sempre o salão vinculado ao usuário autenticado (`owner_id`, `email`, `owner_cpf`) ou às configurações locais salvas pelo gestor antes de qualquer fallback genérico.

---

## 4. Arquitetura Técnica & Mapeamento deTodos os CRUDs

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   PAINÉIS DE GESTÃO & VITRINE DO CLIENTE                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Layout, Cabeçalho│  │ Serviços +       │  │ Agendamento, Perfil,     │  │
│  │ Seções, Rodapé & │  │ Galeria Temática │  │ Dependentes &            │  │
│  │ Compartilhamento │  │ & Equipe         │  │ Upload de Imagens        │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
└───────────┼─────────────────────┼─────────────────────────┼────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            CAMADA UNIFICADA DE PERSISTÊNCIA & AUTO-HEALING                 │
│  1. Serialização 100% de Branding + Colunas SQL + salon_ui_settings        │
│  2. Resolução de UUID do Salão + Auto-Vínculo de owner_id / client_id      │
│  3. Upload Universal (Supabase Storage ➔ Fallback Comprimido Otimizado)    │
│  4. Verificação Real de Gravação (Zero Falso Positivo em bloqueio RLS)     │
└───────────┬───────────────────────────────┬───────────────────┬────────────┘
            │                               │                   │
            ▼                               ▼                   ▼
┌─────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────┐
│    SUPABASE DATABASE    │ │     SUPABASE STORAGE      │ │   CACHE LOCAL    │
│ • public.salons         │ │ • Bucket: avatars / media │ │   SINCRONIZADO   │
│ • public.salon_ui_...   │ │ • URLs públicas leves     │ │ • OG Meta + Share│
│ • public.services       │ └───────────────────────────┘ │ • PWA Manifest   │
│ • public.professionals  │                               └──────────────────┘
│ • public.appointments   │
│ • public.clients        │
│ • public.dependents     │
└─────────────────────────┘
```

### Resumo dos 7 Eixos de Implementação

1. **SQL Completo & Sincronizado (`supabase/schema.sql` + `supabase/migrations/20261023_salon_styles_and_crud_full.sql`):**
   - Criação da tabela `public.salon_ui_settings` e adição de todas as colunas de cores de cabeçalho, barra de títulos das seções, barra de navegação inferior, dados fiscais, espaço e redes sociais em `public.salons`, com RLS habilitado e políticas de leitura/escrita liberadas para sincronização da Tríade.
2. **CRUD de Cores, Estilos & Layout (`src/lib/supabase.ts`, `SalonProfileView.tsx`, `LayoutCardView.tsx`, `VisualIdentityCardView.tsx`):**
   - Função unificada `serializeSalonBranding` e `hydrateSalonAdminSettings` cobrindo 100% das chaves (`sectionHeaderBgColor`, `sectionHeaderTextColor`, `sectionHeaderIconColor`, `sectionHeaderBgStyle`, `sectionHeaderBorder`, `sectionHeaderBtn*`, `navStyle`, `navShape`, `navBorder`, `navBgStyle`, `navBgColor`, `navActiveColor`, `navTextColor`, `navBtn*`, `defaultTheme`, `showSlogan`, `logoTextFallback`, `logoTextColor`, `showHeroSlides`, `welcomeStyle`).
   - Fim do falso positivo quando 0 linhas são afetadas no Supabase e auto-vínculo de `owner_id`.
3. **Galeria Temática para Serviços sem Imagem (`src/utils/serviceGalleryPresets.ts`, `ProfessionalServicesManager.tsx`, `SalonProfileView.tsx`):**
   - Seletor rápido de imagens por categoria diretamente no formulário de criação/edição de serviços (incluindo para *Novo Serviço* já no ato do cadastro) e aba **Galeria Vagou** na biblioteca de mídias.
4. **Compartilhamento Enxuto — Nome do App + Slogan (`SalonProfileView.tsx`, `src/utils/pwaAssets.ts`, `index.html`):**
   - `navigator.share` e meta tags OpenGraph (`og:title`, `og:description`, `<title>`) exibindo apenas o Nome do App e o Slogan do estabelecimento.
5. **CRUD de Profissionais & Escalas (`TeamManager.tsx`, `src/lib/supabase.ts`):**
   - Upload/compressão da foto do profissional, persistência de especialidades e escala de trabalho (`workSchedule` / `schedule_config`) sem perda de estado após recarregar.
6. **CRUD de Dependentes & Perfil (`ProfileDrawer.tsx`, `UserDashboard.tsx`, `SalonBookingModal.tsx`):**
   - Resolução universal do `client_id` para clientes logados via Supabase Auth ou via `public.clients` (`vagou_client_session`), garantindo listagem e criação de dependentes em todos os cenários.
7. **CRUD de Agendamento & Upload de Imagens (`SalonProfileView.tsx`, `src/lib/supabase.ts`):**
   - Correção do `handleConfirmSchedule` (aceitando sessão de cliente sem pedir novo login e resolvendo `targetSalonId` corretamente em vez de `salonInfo.id` indefinido) e helper universal `uploadSalonMediaToStorage` com fallback comprimido automático.
