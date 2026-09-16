# 📋 MANUAL MESTRE DE APROVAÇÕES, DIRETRIZES & ESPECIFICAÇÕES — PROJETO VAGOU

> **OBJETIVO DESTE DOCUMENTO:**  
> Este documento consolida **100% das decisões de engenharia, arquitetura, design system, regras de negócio e aprovações tomadas ao longo do projeto Vagou**.  
> Ele foi elaborado para servir como **Guia Mestre de Instrução (Prompt / Contexto)** para ser colado diretamente no AI Studio em outro projeto gêmeo, clone ou ambiente de backup, garantindo que o novo agente reproduza o sistema com a mesma fidelidade, sem ambiguidades e sem retrabalho.

---

## 🏛️ 1. O Conceito Fundamental e a Tríade do Ecossistema Vagou

O **Vagou** não é apenas um catálogo de salões: ele é um **ecossistema mobile-first em tempo real para liquidação de horários ociosos e vagas imediatas** em salões de beleza, barbearias, clínicas de estética e bem-estar.

O ecossistema é dividido estritamente em **3 frentes operacionais (A Tríade Vagou)**:

### Frente 1: 📱 Portal do Usuário (`portal.vagouapp.com`)
- **Público:** Clientes finais buscando atendimento imediato ou no mesmo dia por proximidade física (GPS).
- **Mecânica Principal:**
  - **Radar de Vagas Imediatas:** Feed com stories/vídeos curtos verticais (5 segundos) e carrossel de fotos reais dos salões.
  - **Ordenação Geoespacial (GIS):** Raio de distância calculado por fórmula de Haversine e PostGIS (`lat`/`lng`), mostrando distâncias em metros (`500m`) e quilômetros (`1.2 km`).
  - **Filtros e Busca por Voz:** Pesquisa com auto-complete e reconhecimento de voz (Web Speech API pt-BR).
  - **Reserva em 2 Toques:** Agendamento rápido com emissão de protocolo único (`#VGA-xxxxx`), QR Code de atendimento e rota no mapa.
  - **Navegação Inferior Consolidada (`BottomNav`):** Barra com 4 acessos principais (`Radar`, `Buscar`, `Relâmpago` e `Mapa`). A **Agenda do Usuário** foi centralizada no menu de perfil do cliente (`ProfileDrawer` / "Minha Agenda"), eliminando redundâncias na barra principal.
  - **Autenticação com Fricção Intencional:**
    - **Caminho Principal:** *"Continuar com Google"* (1 toque, sem atrito).
    - **Caminho com Fricção:** *"Criar conta com E-mail"* (E-mail + Confirmação de e-mail + Código numérico de 6 dígitos). Isso filtra bots, curiosos e cadastros falsos.
    - **Pós-Login de Segurança:** Captura e confirmação do número de WhatsApp e permissão de Notificações Push nativas para envio de lembretes e prevenção de "no-show" (não comparecimento).

### Frente 2: 💈 Meu Negócio / Portal do Parceiro (`meunegocio.vagouapp.com`)
- **Público:** Donos de salões, barbearias, clínicas e seus profissionais cadastrados.
- **Mecânica Principal:**
  - **Estrutura Cadastral em 3 Níveis:**
    - **Nível 1 (Obrigatório Imediato):** Nome Fantasia, WhatsApp Comercial, Endereço completo e E-mail. Libera o salão para operar e publicar.
    - **Nível 2 (Obrigatório com Prazo de Envio):** Razão Social, CNPJ ou CPF do titular e Responsável Legal. O app emite lembretes amigáveis até o vencimento sem travar o onboarding inicial.
    - **Nível 3 (Opcional & Theming White-Label):** Telefone fixo, Logotipo da empresa, Banner panorâmico de capa, Cores da marca (Primária e Secundária) e Domínio Próprio configurável via CNAME (ex: `agendamento.seusalao.com.br`).
  - **Biblioteca de Mídias (A Regra de Ouro dos 5 Slots):**
    - Cada estabelecimento dispõe de **exatamente 5 slots de mídia** para o Radar do Vagou.
    - Ao subir uma 6ª mídia, o sistema exige a substituição de um dos 5 slots antigos, mantendo a performance da CDN, a velocidade no mobile e o feed sempre fresco.
  - **Publicação Relâmpago em 2 Toques:** Transforma cancelamentos de última hora em receita instantânea no Radar.
  - **Gestão de Horários & Escalas:** Configuração de dias de funcionamento, pausas para almoço e atribuição de profissionais.
  - **Micro-App Exclusivo ("Ver Cliente"):** Permite ao dono do salão pré-visualizar a experiência exata do seu cliente tanto na versão oficial do repositório (`SalonProfileView`) com as 4 abas integradas, quanto na versão temática white-label com capa panorâmica (`SalonExclusiveClientView`).

### Frente 3: 💻 Admin-VagouApp (`admin.vagouapp.com`)
- **Público:** Diretoria executiva e equipe operacional do VagouApp.
- **Mecânica Principal:**
  - **Tabela Executiva de Parceiros:** Visão consolidada de todos os salões credenciados, CNPJ/CPF, responsáveis, status cadastral (Níveis 1, 2 e 3) e selos de conformidade.
  - **Métricas Globais em Tempo Real:** GMV transacionado, total de vagas ativas no Radar e agendamentos confirmados no mês.
  - **Motor de Faturamento por Agendamento:** Cálculo automático de comissões por vaga realizada (fixo padrão de **R$ 2,50 por agendamento concluído** ou taxa percentual acordada).
  - **Simulador de Salão ("Visão do Parceiro"):** Permite ao suporte do Vagou simular e inspecionar a interface de qualquer salão cadastrado com um clique.

---

## 🛑 2. O Protocolo dos 6 Mandamentos de Engenharia da IA

Em qualquer modificação, a IA **DEVE** seguir rigorosamente estes passos:

1. **Leitura Prévia Obrigatória:** Sempre ler a documentação interna (`ARCHITECTURE.md`, `KNOWLEDGE_BASE.md`, `ECOSYSTEM_CONTRACT.md` e `CHANGELOG.md`) antes de codificar.
2. **Análise de Viabilidade & Teto Absoluto de Escopo:** Jamais implementar telas, servidores, abas ou dependências que não foram estritamente solicitadas pelo usuário. Não "playground-ificar" o app.
3. **Previsão de Impacto e Configurações Prévias:** Mapear arquivos impactados, variáveis de ambiente e checar se há pacotes novos antes de importar.
4. **Validação e Teste Duplo de Contraprova:**
   - Rodar `lint_applet` (`tsc --noEmit`) para tipagem TypeScript estrita com zero erros.
   - Rodar `compile_applet` (`npm run build`) para garantir que o bundle de produção passe limpo.
5. **🧹 Protocolo de Limpeza Pós-Obra (Clean Code & Zero Poluição):**
   - ❌ Nenhum import não utilizado (ícones do Lucide, tipos, bibliotecas).
   - ❌ Nenhuma variável ou estado zumbi esquecido no código.
   - ❌ Nenhuma classe Tailwind redundante ou conflitante.
   - ❌ Nenhum `console.log` de depuração esquecido.
   - ❌ Nenhum bloco de código morto comentado.
6. **Rastreabilidade no `CHANGELOG.md`:** Toda alteração relevante deve ser registrada com data, tipo, motivo e lista de arquivos afetados.

---

## 🎨 3. Padrões de Design System, Identidade Visual & Diretrizes Anti-Slop

### A. Paleta de Cores Oficial (Manual de Marca Vagou)
- **Verde Vagou Principal:** `#20C933` (RGB: `32, 201, 51` | Destaque máximo, botões de ação e sucesso).
- **Verde Escuro Institucional:** `#087A2A` (RGB: `8, 122, 42` | Gradientes e relevos de marca).
- **Verde Claro Disponibilidade:** `#DFF7E3` (RGB: `223, 247, 227` | Tags suaves e fundos de badges).
- **Grafite Vagou (Dark Slate):** `#151A1E` e `bg-slate-950` (Fundo global escuro).
- **Cards & Superfícies:** `bg-slate-900/90` com bordas em `border-slate-800`.
- **Slogan Oficial:** *"Vagou achou."* (com ponto final).
- **Tipografia:** Família `Poppins` (Bold 700, Medium 500, Regular 400).
- **Ícones Oficiais:** 100% dos ícones **DEVEM** ser importados exclusivamente da biblioteca `lucide-react`. É terminantemente proibido criar ícones SVG inline artesanais.

### B. Regra de Contraste e Teoria dos Opostos (Inegociável)
1. **FUNDO VERDE EXIGE TEXTO BRANCO:**
   - Todo e qualquer botão ou badge com fundo verde (`bg-emerald-500`, `bg-[#20C933]`, `bg-emerald-600`) **DEVE OBRIGATORIAMENTE conter texto e ícones brancos (`text-white`)**.
   - ❌ É terminantemente proibido texto preto ou escuro sobre fundo verde (`text-slate-950` em botão verde).
2. **Temperatura Cromática (Frio vs. Quente):**
   - **Sobre fundos quentes** (`bg-amber-100`, `bg-rose-100`, etc.): Fontes e ícones devem ser estritamente escuros e frios (`text-slate-900`, `text-slate-950`).
   - **Sobre fundos escuros e frios** (`bg-slate-950`, `bg-slate-900`): Destaques e alertas de urgência adotam cores quentes (`text-amber-400`, `text-rose-400`).

### C. Regras de Ouro de Execução Visual (Anti-Slop):
- **Arredondamento Unificado de 4px:** Todos os contêineres, caixas, cards, botões, modais e inputs devem usar estritamente o raio de curvatura de **4px** (`rounded: 4px` / `--radius-*: 4px`).
- **Proibição de "Box dentro de Box" (Anti-Nesting):** NUNCA colocar um elemento com `border` dentro de outro elemento que já possui `border`. A equipe e os serviços devem ser apresentados em lista ou grade plana e arejada, usando espaçamento negativo (`gap-4`, `gap-6`) ao invés de caixinhas cinzas enclausuradas.
- **Rótulos em Linha Única:** Textos em botões, badges, chips e abas nunca devem quebrar linha (`whitespace-nowrap`).
- **Sem Gradientes Clichês:** Banidos gradientes roxo-azulados, textos com gradiente ilegível ou sombras neon exageradas.
- **Rodapé Fixo de Ação (`sticky bottom-0 z-20`):** Em fluxos de seleção e confirmação (como o agendamento), botões de avanço e finalização devem permanecer sempre visíveis e ancorados no rodapé da seção, desacoplados da área de rolagem interna das listas/tabelas.

### D. Hierarquia de Camadas e `z-index` (Solução Consolidada)
- `z-40`: Cabeçalho superior unificado fixo (`sticky top-0`) com logo, busca e barra de categorias com fundo `bg-slate-950/95` e `backdrop-blur-md`.
- `z-30`: Barra de navegação inferior (`BottomNav`, `PartnerBottomNav`) fixa no rodapé (`fixed bottom-0`).
- `z-20`: Modais em tela cheia (`SalonBookingModal`, `RadarStoryModal`, `UserAuthModal`) e rodapés fixos de ação.
- `z-10`: Controles interativos internos (botão de áudio, setas do carrossel de fotos).
- `z-0`: Cards do feed (`RadarOfferCard`) que deslizam com perfeição **por trás** do cabeçalho de busca e categorias.

---

## 🧭 4. O Micro-App do Estabelecimento (`SalonProfileView.tsx`)

O `SalonProfileView.tsx` é a peça central da experiência do salão dentro do app, composto por mais de **1.500 linhas de código** estruturadas em padrão de micro-app nativo:

### A. Estrutura de Enquadramento 100% de Tela
- Contêiner pai com `w-full h-full flex flex-col overflow-hidden` (elimina barras de rolagem duplas no celular).
- Cabeçalho institucional do salão no topo com foto do logo, nome fantasia, endereço, comodidades (Wi-Fi, Café, Ar-condicionado, Estacionamento) e alternador de favoritos.

### B. As 4 Abas Integradas com Isolamento Absoluto (Zero Vazamento):
1. **Início (`home`):** Apresentação do estabelecimento, histórias/vídeos verticais dos trabalhos, comodidades do espaço e botão de ação primária *"HORÁRIOS HOJE"*.
2. **Serviços (`servicos`):** Catálogo de procedimentos segmentado em categorias (Cabelo, Barba, Estética, Combos), com paginação e suporte a swap/seleção direta para agendamento.
3. **Vagas / Agenda (`vagas`):** Calendário mensal inline inteligente que identifica domingos e dias de fechamento, calcula horários disponíveis em tempo real e exibe vagas imediatas.
4. **Espaço / Equipe (`espaco`):** Apresentação plana dos profissionais (foto quadrada 4px, nome e especialidade sem caixas redundantes) e galeria de fotos do ambiente físico.

### C. Fluxo de Agendamento em 4 Etapas (`SalonBookingModal.tsx`)
- **Etapa 1:** Seleção do serviço desejado com preço e duração.
- **Etapa 2:** Seleção da data no calendário mensal.
- **Etapa 3:** Escolha do profissional preferido e seleção do horário vago na grade enxuta.
- **Etapa 4:** Resumo, dados do cliente e confirmação imediata.
- **Botão Fixo Persistente:** O botão de avanço/confirmação fica permanentemente visível no rodapé do modal (`sticky bottom-0 z-20`), permitindo ao usuário rolar listas longas sem perder o botão de toque.

---

## 🗺️ 5. Geolocalização, GIS e Mídia em 3 Níveis

### A. Geolocalização & Ordenação por Distância
- Módulo `src/utils/geolocation.ts` com cálculo trigonométrico Haversine.
- Suporte à ordenação dinâmica por menor distância entre o GPS do aparelho e as coordenadas cadastradas do salão.
- Mapa interativo (`MapScreen.tsx`) com pins customizados que diferenciam salões com vagas abertas no momento.

### B. Mídia Dinâmica em 3 Níveis no Radar:
1. **Nível 1 (Fallback Animado):** Utilizado quando o estabelecimento ainda não fez upload de fotos reais. Renderiza um cartão estilizado com gradientes suaves, badges da marca e tipografia (`MediaFallbackCard.tsx`).
2. **Nível 2 (Carrossel de Fotos):** Galeria horizontal com fotos do corte/serviço, contador de fotos e gestos de swipe.
3. **Nível 3 (Vídeo Vertical / Story):** Vídeo em loop de 5 segundos com som ativável, experiência imersiva inspirada em reels/stories de redes sociais (`RadarStoryModal.tsx`).

---

## 🗄️ 6. Banco de Dados Relacional & Schema SQL (Supabase / PostgreSQL)

O arquivo `supabase/schema.sql` define a base de dados compartilhada com **extensão PostGIS** para o radar de proximidade:

1. **`salons`:** Cadastros com campos para os 3 Níveis (Razão Social, CNPJ/CPF, WhatsApp, endereço, coordenadas `lat`/`lng`), taxa de comissão e campos de theming (cores e URLs de logo/banner).
2. **`salon_media_slots`:** Tabela que restringe estritamente a 5 slots ativos de mídia por salão (`slot_index` de 1 a 5, tipo `video` ou `image`).
3. **`professionals`:** Lista de barbeiros/cabeleireiros/esteticistas associados, especialidades e jornada de trabalho configurável.
4. **`services`:** Procedimentos oferecidos com preço base, preço promocional no Radar e tempo de execução.
5. **`service_offers`:** Vagas imediatas publicadas no Radar com georreferenciamento e contagem regressiva de expiração.
6. **`clients`:** Usuários finais com provedor de autenticação (`google` ou `email`), status de validação de WhatsApp e tokens de Notificações Push.
7. **`appointments`:** Agendamentos efetuados com protocolo único `#VGA-xxxxx`, data, horário, status e QR Code.
8. **`billing_records`:** Registro contábil de comissões geradas para o VagouApp (R$ 2,50 por agendamento).
9. **Função PostGIS `find_nearby_offers_km`:** Consulta geoespacial ultra-rápida filtrando estabelecimentos por raio em quilômetros.

---

## 🌐 7. Deploy de Produção & Cloudflare Workers

O projeto possui configuração validada para deploy de ativos estáticos rápidos no **Cloudflare Workers (SPA)**:

### `wrangler.toml` Aprovado:
```toml
name = "vagouv1"
compatibility_date = "2024-09-23"

# Cloudflare Workers com Static Assets (SPA)
[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

### Regras Críticas:
- **Zero `_redirects`:** Nunca criar arquivos de redirecionamento manual; a instrução `not_found_handling = "single-page-application"` resolve todas as rotas diretamente no Cloudflare.
- **Sem arquivos de lock rígidos no repositório:** `bun.lock` e `package-lock.json` são ignorados no Git para garantir build relâmpago de 5 segundos via `bun install` dinâmico no CI/CD.

---

## 🚀 8. Como Usar Este Documento Para Replicar em Outro Projeto no AI Studio

Quando você iniciar o novo projeto ou ambiente de backup no AI Studio, envie o seguinte comando inicial:

```text
Olá! Estou construindo o aplicativo Vagou (ou uma cópia/backup dele).
Adote estritamente como fonte primária da verdade e protocolo inegociável as especificações contidas no manual mestre abaixo:

[COLAR O CONTEÚDO DESTE ARQUIVO MASTER_APPROVALS_AND_GUIDELINES.md AQUI]

Por favor, confirme que você leu e compreendeu a Tríade do ecossistema, os 6 Mandamentos, a paleta de cores, a regra de contraste obrigatório (fundo verde = texto branco), a regra dos 5 slots de mídia, o uso exclusivo de ícones lucide-react e o padrão estrutural do SalonProfileView.
```
