-- Create inventory_items table for tracking purchased items
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- Auto-generated code like in the image (1, 2, 3...)
    date DATE NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    amount_unit DECIMAL(12, 2) NOT NULL, -- Price per unit in Kz
    total_cost DECIMAL(12, 2) NOT NULL, -- Total cost (quantity * amount_unit)
    receipt_url TEXT, -- URL to the stored receipt image (required field)
    created_by TEXT, -- User who created the record
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure total_cost is calculated correctly
    CONSTRAINT check_total_cost CHECK (total_cost = quantity * amount_unit)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_date ON inventory_items(date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_code ON inventory_items(code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON inventory_items(created_at);

-- Create trigger to automatically update the 'updated_at' timestamp
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Set up Row Level Security
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inventory_items (allow all authenticated users)
CREATE POLICY "Enable read access for all users" ON inventory_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for all users" ON inventory_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for all users" ON inventory_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for all users" ON inventory_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create sequence for auto-generating codes
CREATE SEQUENCE IF NOT EXISTS inventory_code_seq START 1;

-- Create function to auto-generate the next code
CREATE OR REPLACE FUNCTION generate_inventory_code()
RETURNS TEXT AS $$
DECLARE
    next_code INTEGER;
BEGIN
    SELECT nextval('inventory_code_seq') INTO next_code;
    RETURN next_code::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate code if not provided
CREATE OR REPLACE FUNCTION set_inventory_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        NEW.code := generate_inventory_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_inventory_code
BEFORE INSERT ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION set_inventory_code();

-- Add comment to document the table
COMMENT ON TABLE inventory_items IS 'Table to track purchased inventory items with receipts and costs';
COMMENT ON COLUMN inventory_items.code IS 'Auto-generated sequential code for each item';
COMMENT ON COLUMN inventory_items.receipt_url IS 'Required field - URL to the stored receipt image';
COMMENT ON COLUMN inventory_items.amount_unit IS 'Price per unit in Angolan Kwanza (Kz)';
COMMENT ON COLUMN inventory_items.total_cost IS 'Total cost calculated as quantity * amount_unit';