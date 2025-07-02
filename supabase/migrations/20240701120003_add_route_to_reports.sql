-- Add route field to daily_reports table
ALTER TABLE daily_reports ADD COLUMN route TEXT;

-- Add common routes as a check constraint (optional - you can remove this if you want completely flexible routes)
ALTER TABLE daily_reports ADD CONSTRAINT valid_routes CHECK (
    route IS NULL OR route IN (
        'LUANDA - MBANZA',
        'MBANZA - LUANDA', 
        'LUANDA - HUAMBO',
        'HUAMBO - LUANDA',
        'LUVU - LUANDA',
        'LUANDA - LUVU',
        'MBANZA - HUAMBO',
        'HUAMBO - MBANZA',
        'CAXITO - LUANDA',
        'LUANDA - CAXITO',
        'UIGE - LUANDA',
        'LUANDA - UIGE'
    )
);

-- Create an index for better performance on route queries
CREATE INDEX idx_daily_reports_route ON daily_reports(route);

-- Update RLS policies to include route field (if needed)
-- The existing policies should automatically cover the new route field 