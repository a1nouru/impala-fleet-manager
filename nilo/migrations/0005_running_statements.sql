-- Statements run continuously: each covers [period_start, period_end), from the end of the
-- company's previous statement (null on the first) up to the moment it was produced.
-- Applied while nilo_statements was empty.
alter table nilo_statements
  drop constraint nilo_statements_company_period_key,
  drop constraint nilo_statements_period_check,
  drop column period,
  add column period_start timestamptz,
  add column period_end timestamptz not null,
  add constraint nilo_statements_range_check check (period_start is null or period_start < period_end),
  -- Two statements can never start at the same point, so no part is billed twice.
  add constraint nilo_statements_one_per_start unique nulls not distinct (company, period_start);

create index nilo_statements_company_end on nilo_statements (company, period_end desc);
