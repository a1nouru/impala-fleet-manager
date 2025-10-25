# Funcionalidade de Relatórios Sinalizados

## Visão Geral
O Impala Express Fleet Manager agora sinaliza automaticamente relatórios diários que requerem atenção da gestão e obriga os utilizadores a fornecer explicações para essas situações.

## Critérios de Sinalização
Um relatório diário é automaticamente sinalizado se cumprir **qualquer** uma das seguintes condições:

1. **Receita Líquida Baixa**: Receita líquida é inferior a 50% da receita total
2. **Despesas Elevadas**: Despesas totais excedem 210.000,00 AOA

## Indicadores Visuais

### Realce de Linhas da Tabela
- Relatórios sinalizados têm um **fundo vermelho claro** (`bg-red-50`) na tabela financeira
- Isto chama imediatamente a atenção para relatórios problemáticos

### Ícones de Aviso
- **Ícone triangular âmbar** (⚠️) aparece ao lado das matrículas dos veículos para relatórios sinalizados
- **Ícone triangular verde** aparece quando uma explicação foi fornecida
- Ao passar o cursor sobre o ícone mostra:
  - A razão específica pela qual o relatório foi sinalizado
  - A explicação (se fornecida)

### Botões de Ação
- Relatórios sinalizados mostram um **botão de aviso âmbar** adicional na coluna Ações
- A dica do botão indica se uma explicação é necessária ou pode ser visualizada/editada

## Requisitos de Explicação

### Quando Obrigatório
- Explicações são **obrigatórias** para todos os relatórios sinalizados
- Os utilizadores não podem guardar atualizações de relatórios sinalizados sem fornecer uma explicação
- O campo de explicação aparece automaticamente no diálogo de edição para relatórios sinalizados

### Como Adicionar Explicações

#### Método 1: Através do Diálogo de Edição
1. Clique no botão **Editar** (ícone lápis) num relatório sinalizado
2. O campo de explicação aparecerá no fundo do formulário com:
   - Etiqueta de cor âmbar indicando que é obrigatório
   - Descrição do motivo pelo qual o relatório foi sinalizado
   - Área de texto grande para explicação detalhada
3. Preencha a explicação e guarde o relatório

#### Método 2: Diálogo de Explicação Independente
1. Clique no botão **Aviso** (ícone triângulo) na coluna Ações
2. Um diálogo de explicação dedicado abre mostrando:
   - A razão específica da sinalização
   - Explicação atual (se existir)
   - Área de texto para adicionar/editar explicação
3. Guarde a explicação diretamente

### Validação
- O texto da explicação não pode estar vazio para relatórios sinalizados
- A validação ocorre ao guardar atualizações de relatórios
- Mensagens de erro claras orientam os utilizadores a fornecer explicações

## Esquema da Base de Dados
Um novo campo `explanation` foi adicionado à tabela `daily_reports`:

```sql
-- Migração: 20241218000000_add_explanation_to_daily_reports.sql
ALTER TABLE daily_reports ADD COLUMN explanation TEXT;
COMMENT ON COLUMN daily_reports.explanation IS 'Explicação obrigatória quando a receita líquida é inferior a 50% da receita total ou despesas excedem 210.000 AOA';
CREATE INDEX idx_daily_reports_explanation ON daily_reports(explanation) WHERE explanation IS NOT NULL;
```

## Implementação Técnica

### Funções Auxiliares
- `isReportFlagged(report)`: Determina se um relatório cumpre os critérios de sinalização
- `getFlagReason(report)`: Retorna explicação legível do motivo da sinalização do relatório

### Gestão de Estado
- Estado do diálogo de explicação gerido separadamente do diálogo de edição
- Validação automática previne o guardar de relatórios sinalizados sem explicações
- Atualizações da interface em tempo real quando explicações são adicionadas/modificadas

### Características da Experiência do Utilizador
- **Interface limpa e moderna** com padrões de design consistentes
- **Dicas de ferramenta** fornecem contexto sem confundir a interface
- **Codificação por cores**: Âmbar para necessita atenção, Verde para resolvido
- **Avisos não intrusivos** que não interrompem o fluxo normal de trabalho
- **Acessibilidade**: Etiquetas ARIA adequadas e navegação por teclado

## Benefícios Empresariais

1. **Gestão Proactiva**: Identifica automaticamente situações financeiras problemáticas
2. **Responsabilização**: Requer explicações para circunstâncias incomuns
3. **Trilha de Auditoria**: Armazena explicações para referência e análise futuras
4. **Gestão de Risco**: Detecção precoce de questões potenciais
5. **Transparência**: Visibilidade clara dos desafios operacionais

## Exemplos de Uso

### Exemplo 1: Despesas Elevadas
Um veículo reporta 250.000 AOA em despesas (excedendo o limite de 210.000):
- Linha realçada em vermelho claro
- Ícone de aviso aparece com dica: "Despesas excedem 210.000 AOA (250.000 AOA)"
- Gestor clica no botão de explicação e introduz: "Substituição de emergência de pneu devido a danos na estrada na rota Luanda-Huambo"

### Exemplo 2: Receita Líquida Baixa
Um veículo tem 500.000 AOA de receita mas 400.000 AOA de despesas (80% de ratio de despesas, receita líquida apenas 20%):
- Linha realçada em vermelho claro
- Ícone de aviso aparece com dica: "Receita líquida é 20,0% da receita total (inferior a 50%)"
- Gestor explica: "Reparações mecânicas inesperadas reduziram a rentabilidade. Veículo reparado e de volta às operações normais."

## Instruções de Migração

1. **Aplicar Migração da Base de Dados**:
   ```bash
   npx supabase migration up
   ```

2. **Atualizar Produção**: Implementar o código atualizado e executar migrações

3. **Formação**: Briefing da equipa sobre a nova funcionalidade de relatórios sinalizados e requisitos de explicação

## Monitorização

- Relatórios com explicações podem ser acompanhados através do campo `explanation`
- Use consultas para identificar padrões em relatórios sinalizados
- Monitore a qualidade e frequência das explicações para insights operacionais 