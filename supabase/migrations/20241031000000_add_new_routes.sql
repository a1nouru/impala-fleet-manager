-- Add new routes to the valid_routes constraint
-- Drop the existing constraint
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS valid_routes;

-- Add updated constraint with new routes
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
        'LUANDA - UIGE',
        'BENGUELA - LUANDA',
        'LUANDA - BENGUELA',
        'URUBANO'
    )
);

