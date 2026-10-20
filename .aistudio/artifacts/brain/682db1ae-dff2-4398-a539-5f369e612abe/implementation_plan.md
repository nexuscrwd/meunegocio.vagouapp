# Plano de Implementação: Acesso Soberano do Proprietário (`useOwnerAccess`), Persistência Total no Supabase e Paridade de Formulários (`mnvapp` ↔ `admvapp`)

## 1. Visão Geral & Objetivos
Este plano resolve definitivamente o reconhecimento de titularidade do proprietário no subdomínio do salão (`*.vagouapp.com`), adiciona o atalho visual discreto no cabeçalho da vitrine (`SalonProfileView`), elimina todas as lacunas de persistência onde dados ficavam restritos ao `localStorage` e eleva os formulários locais de gestão do `mnvapp` à paridade total com o `admvapp` (`nexuscrwd/admin.vagouapp`).

---

## 2. Arquitetura & Entregas Planejadas

### Etapa 1: Hook `useOwnerAccess` & Badge Discreto de Proprietário no Cabeçalho (`SalonProfileView`)
- **Criação de `src/hooks/useOwnerAccess.ts`:**
  - Consolida a leitura da identidade autenticada a partir de `supabase.auth.getSession()` e do estado SSO cross-subdomain gravado no `localStorage` (`vagou_user_email`, `vagou_auth_user_id`, `vagou_user_cpf`, `vagou_client_session`), reagindo em tempo real aos eventos `vagou:auth-updated`, `storage` e `onAuthStateChange`.
  - Verifica a titularidade do usuário logado contra o registro do salão no Supabase (`public.salons` e `public.clients`) validando:
    1. Correspondência de **E-mail**: `userEmail` igual a `salons.email`, `salons.branding.ownerEmail` ou `salons.branding.legalManagerEmail`.
    2. Correspondência de **CPF (`owner_cpf`)**: `userCpf` (ou `clients.cpf` buscado pelo e-mail/ID do usuário logado) igual a `salons.owner_cpf` (normalizando os 11 dígitos numéricos).
    3. Correspondência de **ID (`owner_id`)**: `userId` igual a `salons.owner_id`.
    4. Vínculo na tabela `public.salon_members` com `role IN ('owner', 'admin', 'manager')`.
  - Retorna `{ isOwner, isManagerOrPro, ownerCheckLoading, matchedBy, refreshOwnerAccess }`.
- **Badge Discreto no Cabeçalho de `SalonProfileView.tsx`:**
  - Posicionado no cabeçalho superior fixo (`z-40`), ao lado dos controles de perfil/status.
  - Exibido **exclusivamente** quando `isOwner === true`.
  - Segue estritamente a regra de contraste do Vagou: quando ativo no modo Gerenciar ou em destaque verde (`bg-[#20C933]` / `bg-emerald-600`), utiliza obrigatoriamente texto e ícone brancos (`text-white`), com design compacto mobile (`Gestão` / `Gerenciar` com ícone `ShieldCheck` ou `SlidersHorizontal` de `lucide-react`), permitindo alternar em 1 toque entre a **Vitrine do Cliente** e o **Menu de Gerenciamento (`activeTab = 'manage'`)**.

### Etapa 2: Correção Integral da Persistência dos Formulários no Supabase (`src/lib/supabase.ts`)
- **1. Dados do Estabelecimento (`updateSalonSettingsInDb` & `syncSalonDataToSupabase`):**
  - Persistir todas as colunas estruturadas em `public.salons`: `cep`, `street_number`, `complement`, `neighborhood`, `city`, `state`, `address`, `email`, `phone_whatsapp`, `phone_landline`, `category`, `owner_cpf`, `document_number`, `legal_name`, `pix_key`, `pix_keys` e `operating_hours`.
  - Espelhar os metadados canônicos dentro do objeto JSONB `branding` (`category`, `email`, `phoneLandline`, `ownerCpf`, `cep`, `numero`, `complemento`, `openingHours`, `holidays`, `cancellationPolicy`, `spacePhotos`) para compatibilidade imediata com `admvapp` e `pvapp`.
  - Quando o proprietário atualizar seu `ownerCpf`, sincronizar também a coluna `cpf` na tabela `public.clients` para o usuário autenticado.
- **2. Equipe & Profissionais (`TeamManager.tsx` + `SalonCustomizationHub.tsx` + `syncAllProfessionalsToDb`):**
  - Conectar `TeamManager` no `SalonCustomizationHub` e no `SalonProfileView` passando o callback real de sincronização com o banco.
  - Gerar UUID v4 válido ao adicionar novos membros da equipe e sincronizar exclusões reais no Supabase (`DELETE` ou `is_active: false` em `public.professionals`).
  - Persistir os dados completos do membro (`name`, `role`, `phone`, `email`, `avatar_url`, `commission_rate`, `specialties`, `is_active`) no Supabase e no JSONB de apoio, hidratando a equipe real ao abrir o salão em qualquer dispositivo.
- **3. Meu Espaço, Horários de Funcionamento, Feriados, Regras e Galeria (`ProfessionalSpaceManager.tsx`):**
  - Conectar `ProfessionalSpaceManager` ao Supabase (`updateSalonSpaceConfigInDb`), gravando a grade de horários por dia da semana na coluna `operating_hours` (JSONB) de `public.salons` e persistindo `holidays`, `cancellationPolicy` e `spacePhotos` dentro de `branding` JSONB (além de atualizar o resumo legível de `openingHours`).
  - Hidratar esses dados a partir do registro do salão carregado do Supabase ao iniciar o app.

### Etapa 3: Paridade Total do `BusinessDataCardView.tsx` com o `admvapp`
- **Validação Matemática Receita Federal (Módulo 11) & Consulta Automática BrasilAPI:**
  - Implementar os validadores algorítmicos `isValidCPF` (11 dígitos + dígitos verificadores) e `isValidCNPJ` (14 dígitos + dígitos verificadores), idênticos ao `TriadeEstablishmentMasterForm.tsx` do `admvapp`.
  - Adicionar busca automática na **BrasilAPI** (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) na aba Fiscal ao preencher os 14 dígitos do CNPJ (ou botão de consulta rápida), preenchendo automaticamente `Razão Social`, `Nome Fantasia` e dados de endereço caso estejam em branco.
- **Novos Campos Homologados do `admvapp` na Aba Comercial:**
  - **Categoria / Ramo de Atuação (`category`):** Seletor rápido com as categorias oficiais da Tríade (`Barbearia`, `Salão de Beleza`, `Clínica de Estética`, `Studio de Unhas / Nail Designer`, `Lash & Sobrancelhas`, `Spa & Massoterapia`, `Multi-Serviços`).
  - **E-mail Comercial / Proprietário (`email`)** e **Telefone Fixo (`phoneLandline`)** com máscara automática.
- **Card "Link Exclusivo & Placa QR Code da Vitrine":**
  - Adicionar na aba Comercial o bloco rápido com a URL oficial da vitrine (`https://{slug}.vagouapp.com`), botão **Copiar Link** com 1 toque e modal de **Impressão da Placa QR Code de Agendamento da Vitrine** (complementando a Placa QR Code PIX já existente na aba PIX).

### Etapa 4: Qualidade, Limpeza Pós-Obra & Governança da Tríade
- Executar `lint_applet` (`tsc --noEmit`) e `compile_applet` (`npm run build`) garantindo zero erros e zero imports/variáveis sem uso.
- Registrar todas as alterações no `CHANGELOG.md` e emitir o **Comunicado Técnico Oficial Inter-Projetos** para `admvapp` e `pvapp`.
