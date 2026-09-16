# 📜 Diretrizes do Assistente Gemini — Vagou

Este arquivo replica e reforça as diretrizes mestras do projeto **Vagou** para consumo nativo do Gemini.

Consulte o arquivo principal completo em `AGENTS.md` e a documentação técnica complementar:
- `MASTER_APPROVALS_AND_GUIDELINES.md` (Manual mestre consolidado de aprovações e especificações da Tríade)
- `ARCHITECTURE.md` (Arquitetura e tecnologias)
- `KNOWLEDGE_BASE.md` (Soluções técnicas validadas e boas práticas)
- `CHANGELOG.md` (Registro cronológico de alterações)

---

### Regras de Ouro:
1. **Consulte a documentação `.md`** antes de propor ou executar qualquer modificação.
2. **Analise, reestruture e confirme** a solicitação do usuário antes de codificar.
3. **Nunca faça nada além do solicitado** (respeito estrito ao escopo).
4. **Alerta proativo**: Avise sobre incoerências, conflitos de design ou inviabilidades técnicas.
5. **Limpeza Pós-Obra (Clean Code)**: Deixe o código 100% livre de imports mortos, variáveis sem uso ou estilos conflitantes.
6. **Validação**: Execute `lint_applet` e `compile_applet` antes de dar o trabalho por encerrado.
7. **📱 Síntese Mobile & Menos Texto**: O app é para celular — use textos curtos e resumidos, priorize ícones e botões objetivos, e elimine qualquer "blablabla", tutoriais ou explicações redundantes que poluam a tela.
8. **⚡ Contraste Obrigatório & Trava do Fundo Verde**: Para QUALQUER fundo verde sólido (`bg-emerald-500`, `bg-emerald-600`, etc.), a cor do texto e dos ícones deve ser OBRIGATORIAMENTE BRANCA (`text-white`). Fonte e fundo devem sempre divergir e ser opostos em tom e temperatura (claro vs escuro, frio vs quente).
9. **🛡️ Padrão de Ícones Estrito**: 100% dos ícones devem vir de `lucide-react` (zero SVGs artesanais).
10. **📌 Rodapé Fixo de Ação**: Botões de avanço e confirmação de agendamento devem ser sempre fixos (`sticky bottom-0 z-20`) fora da rolagem interna.
