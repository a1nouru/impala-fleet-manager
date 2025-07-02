-- =================================================================
-- 1. Get Revenue Trend
-- =================================================================
CREATE OR REPLACE FUNCTION get_revenue_trend(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    date TEXT,
    revenue NUMERIC,
    expenses NUMERIC,
    net NUMERIC,
    ticket_revenue NUMERIC,
    baggage_revenue NUMERIC,
    cargo_revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(start_date, end_date, '1 day'::INTERVAL)::DATE AS day
    ),
    daily_revenues AS (
        SELECT
            dr.report_date,
            SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue) AS total_revenue,
            SUM(dr.ticket_revenue) AS total_ticket_revenue,
            SUM(dr.baggage_revenue) AS total_baggage_revenue,
            SUM(dr.cargo_revenue) AS total_cargo_revenue
        FROM daily_reports dr
        WHERE dr.report_date BETWEEN start_date AND end_date
        GROUP BY dr.report_date
    ),
    daily_expenses_total AS (
        SELECT
            dr.report_date,
            SUM(de.amount) as total_expenses
        FROM daily_expenses de
        JOIN daily_reports dr ON de.report_id = dr.id
        WHERE dr.report_date BETWEEN start_date AND end_date
        GROUP BY dr.report_date
    )
    SELECT
        to_char(ds.day, 'YYYY-MM-DD') AS date,
        COALESCE(rev.total_revenue, 0) AS revenue,
        COALESCE(exp.total_expenses, 0) AS expenses,
        (COALESCE(rev.total_revenue, 0) - COALESCE(exp.total_expenses, 0)) AS net,
        COALESCE(rev.total_ticket_revenue, 0) AS ticket_revenue,
        COALESCE(rev.total_baggage_revenue, 0) AS baggage_revenue,
        COALESCE(rev.total_cargo_revenue, 0) AS cargo_revenue
    FROM date_series ds
    LEFT JOIN daily_revenues rev ON ds.day = rev.report_date
    LEFT JOIN daily_expenses_total exp ON ds.day = exp.report_date
    ORDER BY ds.day;
END;
$$;

-- =================================================================
-- 2. Get Expense Breakdown
-- =================================================================
CREATE OR REPLACE FUNCTION get_expense_breakdown(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    category TEXT,
    amount NUMERIC,
    percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_expenses_for_period NUMERIC;
BEGIN
    SELECT COALESCE(SUM(de.amount), 0) INTO total_expenses_for_period
    FROM daily_expenses de
    JOIN daily_reports dr ON de.report_id = dr.id
    WHERE dr.report_date BETWEEN start_date AND end_date;

    IF total_expenses_for_period = 0 THEN
        RETURN QUERY SELECT 'No Expenses'::TEXT, 0::NUMERIC, 100::NUMERIC;
    ELSE
        RETURN QUERY
        SELECT
            de.category,
            SUM(de.amount) AS amount,
            ROUND((SUM(de.amount) / total_expenses_for_period) * 100, 2) AS percentage
        FROM daily_expenses de
        JOIN daily_reports dr ON de.report_id = dr.id
        WHERE dr.report_date BETWEEN start_date AND end_date
        GROUP BY de.category
        ORDER BY amount DESC;
    END IF;
END;
$$;


-- =================================================================
-- 3. Get Vehicle Performance
-- =================================================================
CREATE OR REPLACE FUNCTION get_vehicle_performance(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    vehicle_plate TEXT,
    total_revenue NUMERIC,
    total_expenses NUMERIC,
    net_profit NUMERIC,
    operational_days BIGINT,
    avg_daily_revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.plate AS vehicle_plate,
        COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue), 0) AS total_revenue,
        COALESCE(SUM((SELECT SUM(amount) FROM daily_expenses WHERE report_id = dr.id)), 0) AS total_expenses,
        COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue) - SUM((SELECT SUM(amount) FROM daily_expenses WHERE report_id = dr.id)), 0) AS net_profit,
        COUNT(dr.id) FILTER (WHERE dr.status = 'Operational') AS operational_days,
        CASE
            WHEN COUNT(dr.id) FILTER (WHERE dr.status = 'Operational') > 0
            THEN COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue), 0) / COUNT(dr.id) FILTER (WHERE dr.status = 'Operational')
            ELSE 0
        END AS avg_daily_revenue
    FROM vehicles v
    LEFT JOIN daily_reports dr ON v.id = dr.vehicle_id
    WHERE dr.report_date BETWEEN start_date AND end_date
    GROUP BY v.plate
    ORDER BY total_revenue DESC;
END;
$$;


-- =================================================================
-- 4. Get Revenue Composition
-- =================================================================
CREATE OR REPLACE FUNCTION get_revenue_composition(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    date TEXT,
    ticket_revenue NUMERIC,
    baggage_revenue NUMERIC,
    cargo_revenue NUMERIC,
    total_revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(start_date, end_date, '1 day'::INTERVAL)::DATE AS day
    )
    SELECT
        to_char(ds.day, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(dr.ticket_revenue), 0) AS ticket_revenue,
        COALESCE(SUM(dr.baggage_revenue), 0) AS baggage_revenue,
        COALESCE(SUM(dr.cargo_revenue), 0) AS cargo_revenue,
        COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue), 0) AS total_revenue
    FROM date_series ds
    LEFT JOIN daily_reports dr ON ds.day = dr.report_date
    GROUP BY ds.day
    ORDER BY ds.day;
END;
$$;


-- =================================================================
-- 5. Get Monthly Comparison
-- =================================================================
CREATE OR REPLACE FUNCTION get_monthly_comparison(
    target_year INT
)
RETURNS TABLE (
    month TEXT,
    current_year_revenue NUMERIC,
    previous_year_revenue NUMERIC,
    growth_percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_revenue AS (
        SELECT
            to_char(report_date, 'YYYY-MM') AS year_month,
            to_char(report_date, 'Mon') AS month_name,
            EXTRACT(YEAR FROM report_date) AS year,
            EXTRACT(MONTH FROM report_date) AS month_num,
            SUM(ticket_revenue + baggage_revenue + cargo_revenue) AS monthly_rev
        FROM daily_reports
        WHERE EXTRACT(YEAR FROM report_date) IN (target_year, target_year - 1)
        GROUP BY year_month, month_name, year, month_num
    ),
    current_year AS (
        SELECT month_name, month_num, monthly_rev FROM monthly_revenue WHERE year = target_year
    ),
    previous_year AS (
        SELECT month_name, month_num, monthly_rev FROM monthly_revenue WHERE year = target_year - 1
    )
    SELECT
        cy.month_name AS month,
        COALESCE(cy.monthly_rev, 0) AS current_year_revenue,
        COALESCE(py.monthly_rev, 0) AS previous_year_revenue,
        CASE
            WHEN COALESCE(py.monthly_rev, 0) = 0 THEN NULL
            ELSE ROUND(((COALESCE(cy.monthly_rev, 0) - COALESCE(py.monthly_rev, 0)) / COALESCE(py.monthly_rev, 0)) * 100, 2)
        END AS growth_percentage
    FROM current_year cy
    LEFT JOIN previous_year py ON cy.month_num = py.month_num
    ORDER BY cy.month_num;
END;
$$;


-- =================================================================
-- 6. Get KPI Metrics
-- =================================================================
CREATE OR REPLACE FUNCTION get_kpi_metrics(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    total_revenue NUMERIC,
    total_expenses NUMERIC,
    net_profit NUMERIC,
    profit_margin NUMERIC,
    avg_daily_revenue NUMERIC,
    total_operational_days BIGINT,
    best_performing_vehicle TEXT,
    revenue_growth NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    previous_period_revenue NUMERIC;
    period_duration INT;
BEGIN
    period_duration := end_date - start_date + 1;

    -- Calculate revenue for the equivalent previous period
    SELECT COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue), 0)
    INTO previous_period_revenue
    FROM daily_reports dr
    WHERE dr.report_date BETWEEN (start_date - period_duration) AND (start_date - 1);

    RETURN QUERY
    WITH current_period_data AS (
        SELECT
            COALESCE(SUM(dr.ticket_revenue + dr.baggage_revenue + dr.cargo_revenue), 0) AS revenue,
            COALESCE(SUM((SELECT SUM(amount) FROM daily_expenses WHERE report_id = dr.id)), 0) AS expenses,
            COUNT(dr.id) FILTER (WHERE dr.status = 'Operational') AS operational_days,
            (SELECT v.plate FROM vehicles v JOIN daily_reports dr_inner ON v.id = dr_inner.vehicle_id WHERE dr_inner.report_date BETWEEN start_date AND end_date GROUP BY v.plate ORDER BY SUM(dr_inner.ticket_revenue + dr_inner.baggage_revenue + dr_inner.cargo_revenue) DESC LIMIT 1) AS top_vehicle
        FROM daily_reports dr
        WHERE dr.report_date BETWEEN start_date AND end_date
    )
    SELECT
        cpd.revenue AS total_revenue,
        cpd.expenses AS total_expenses,
        cpd.revenue - cpd.expenses AS net_profit,
        CASE WHEN cpd.revenue = 0 THEN 0 ELSE ROUND(((cpd.revenue - cpd.expenses) / cpd.revenue) * 100, 2) END AS profit_margin,
        CASE WHEN cpd.operational_days = 0 THEN 0 ELSE cpd.revenue / cpd.operational_days END AS avg_daily_revenue,
        cpd.operational_days AS total_operational_days,
        cpd.top_vehicle AS best_performing_vehicle,
        CASE WHEN previous_period_revenue = 0 THEN NULL ELSE ROUND(((cpd.revenue - previous_period_revenue) / previous_period_revenue) * 100, 2) END AS revenue_growth
    FROM current_period_data cpd;
END;
$$; 