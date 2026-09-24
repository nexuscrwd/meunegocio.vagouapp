const fs = require('fs');
const path = require('path');

const filesToInclude = [
  'src/components/professional/UtilitiesAndToolsView.tsx',
  'src/components/professional/consumption/concessionariasData.ts',
  'src/components/professional/consumption/consumptionTypes.ts',
  'src/components/professional/consumption/EnergyMeterManager.tsx',
  'src/components/professional/consumption/WaterConsumptionManager.tsx',
  'src/components/professional/consumption/OperationalEquipmentsManager.tsx',
  'src/components/professional/consumption/InfrastructureEquipmentsManager.tsx'
];

let output = `# 🛠️ Especificação Completa e Código da Seção de Utilidades (Vagou Pro)

> Este documento contém a implementação completa, estruturada e unificada da Seção de Utilidades, englobando o Hub de Gestão de Consumo, cálculo de tarifas ANEEL/Saneamento para todos os 26 estados do Brasil + DF, relógios de energia/hidrômetro, equipamentos operacionais e de infraestrutura.

---

## 📋 Sumário
1. [Prompt de Instruções para o AI Studio](#prompt-de-instruções-para-o-ai-studio)
2. [Tipos de Dados](#1-tipos-de-dados)
3. [Banco de Concessionárias e Tarifas](#2-banco-de-concessionárias)
4. [Componente Principal Hub de Utilidades](#3-hub-principal-de-utilidades)
5. [Gerenciador de Energia Elétrica](#4-gerenciador-de-energia-elétrica)
6. [Gerenciador de Água e Saneamento](#5-gerenciador-de-água-e-saneamento)
7. [Gerenciador de Equipamentos Operacionais](#6-gerenciador-de-equipamentos-operacionais)
8. [Gerenciador de Equipamentos de Infraestrutura](#7-gerenciador-de-infraestrutura)

---

## 🤖 Prompt de Instruções para o AI Studio

\`\`\`markdown
Você é um Engenheiro de Software Sênior especializado em React, TypeScript e Tailwind CSS. Sua tarefa é implementar em um novo projeto a **Seção de Utilidades e Gestão de Consumo** do aplicativo Vagou Pro.

A seção deve conter:
1. Um Hub Principal de Utilidades com acesso direto a **Gerenciamento de Consumo**, **Financeiro** e **Insumos**.
2. Um Sub-Hub de Consumo com 4 pilares:
   - **Energia Elétrica**: Com seletor duplo de Estado (UF) e Concessionária ANEEL (cobertura nacional), leitura de relógio atual, cálculo de kWh, TE, TUSD, ICMS, COSIP e previsão de fatura em tempo real para o ciclo de 30 dias.
   - **Água**: Com seletor de Companhia de Saneamento estadual, leitura de hidrômetro em m³, taxa de esgoto e previsão de fatura.
   - **Equipamentos Operacionais**: Gestão de secadores, lavatórios e máquinas de bancada com consumo (kWh/h) e horas de uso diário.
   - **Equipamentos de Infraestrutura**: Gestão de geladeiras, micro-ondas, ar-condicionado e climatização.
3. Design limpo (Dark theme sofisticado com destaques em Emerald e fundo plano sem caixas redundantes), totalmente responsivo para dispositivos móveis, sem poluição visual e utilizando ícones exclusivamente da biblioteca \`lucide-react\`.
\`\`\`

---
`;

for (const filePath of filesToInclude) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).substring(1);
    output += `\n## Arquivo: \`${filePath}\`\n\n\`\`\`${ext === 'tsx' ? 'tsx' : 'ts'}\n${content}\n\`\`\`\n\n---`;
  }
}

fs.writeFileSync('/tmp/secao_utilidades_completa.md', output);
console.log('Markdown gerado com sucesso em /tmp/secao_utilidades_completa.md');
