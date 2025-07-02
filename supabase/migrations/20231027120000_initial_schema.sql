-- Table to store daily operational and financial reports for each vehicle.
CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Operational', 'Non-Operational')),
    non_operational_reason TEXT,
    ticket_revenue NUMERIC(10, 2) DEFAULT 0.00, -- Revenue from passengers
    baggage_revenue NUMERIC(10, 2) DEFAULT 0.00, -- Revenue from luggage
    cargo_revenue NUMERIC(10, 2) DEFAULT 0.00,   -- Revenue from packages/cargo
    created_by TEXT, -- Stores user identifier (e.g., user email or ID)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure a reason is provided if the vehicle is not operational.
    CONSTRAINT check_non_operational_reason CHECK (
        (status = 'Non-Operational' AND non_operational_reason IS NOT NULL) OR
        (status = 'Operational')
    ),
    -- Each vehicle can only have one report per day.
    UNIQUE(vehicle_id, report_date)
);

-- Table to store individual expenses associated with a daily report.
CREATE TABLE daily_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'Fuel', 'Tire Repair', 'Driver Payment'
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table to log bank deposits.
CREATE TABLE bank_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL CHECK (bank_name IN ('Caixa Angola', 'BAI')),
    deposit_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    deposit_slip_url TEXT, -- URL to the stored image of the deposit slip
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table to link bank deposits to one or more daily reports.
-- This creates a many-to-many relationship.
CREATE TABLE deposit_reports (
    deposit_id UUID NOT NULL REFERENCES bank_deposits(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    PRIMARY KEY (deposit_id, report_id)
);

-- Optional: Create triggers to automatically update the 'updated_at' timestamp.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_reports_updated_at
BEFORE UPDATE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_expenses_updated_at
BEFORE UPDATE ON daily_expenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_deposits_updated_at
BEFORE UPDATE ON bank_deposits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create indexes for frequently queried columns.
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_expenses_report_id ON daily_expenses(report_id);
CREATE INDEX idx_bank_deposits_date ON bank_deposits(deposit_date);