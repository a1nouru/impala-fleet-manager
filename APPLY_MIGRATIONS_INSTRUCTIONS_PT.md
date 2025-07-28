# Aplicar Migração da Base de Dados ao Supabase

Uma vez que estamos a usar uma instância hospedada do Supabase, precisa aplicar a migração manualmente através do Editor SQL do Painel do Supabase.

## Aplicar a Migração do Campo Explicação

1. Vá para https://supabase.com/dashboard/project/hymravaveedguejtazsc/sql/new
2. Copie e cole este SQL:

```sql
-- Adicionar campo explicação à tabela daily_reports para relatórios sinalizados
-- Este campo armazena explicações quando relatórios têm receita líquida baixa ou despesas elevadas

ALTER TABLE daily_reports ADD COLUMN explanation TEXT;

-- Adicionar comentário para documentar o propósito deste campo
COMMENT ON COLUMN daily_reports.explanation IS 'Explicação obrigatória quando a receita líquida é inferior a 50% da receita total ou despesas excedem 210.000 AOA';

-- Criar índice para performance em consultas de explicação
CREATE INDEX idx_daily_reports_explanation ON daily_reports(explanation) WHERE explanation IS NOT NULL;
```

3. Clique em "Run" para executar

## Verificar Migração

Execute esta consulta para verificar se a migração foi aplicada:

```sql
-- Verificar se a coluna explicação existe
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'daily_reports' AND column_name = 'explanation';
```

## Uma Vez Completo

Após aplicar a migração, a aplicação deve funcionar corretamente:
- ✅ Relatórios diários podem ser criados com as rotas válidas existentes
- ✅ Relatórios sinalizados mostrarão a funcionalidade de explicação
- ✅ Toda a validação e realce funcionará adequadamente

A questão das rotas foi resolvida atualizando o formulário para usar o formato de rota correto que corresponde à restrição da base de dados. 