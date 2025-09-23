-- Add item_name column to inventory_items table (if table exists)
-- This adds the field for storing the name of the inventory item (separate from description)

-- Check if inventory_items table exists and add item_name column
DO $$
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items') THEN
        -- Add the column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'item_name') THEN
            ALTER TABLE inventory_items ADD COLUMN item_name TEXT;
            RAISE NOTICE 'Added item_name column to inventory_items table';
        END IF;
        
        -- Update existing records to have a default item_name
        UPDATE inventory_items 
        SET item_name = 'Legacy Item' 
        WHERE item_name IS NULL OR item_name = '';
        
        -- Make the column NOT NULL
        ALTER TABLE inventory_items 
        ALTER COLUMN item_name SET NOT NULL;
        
        -- Add comment to document the new column
        COMMENT ON COLUMN inventory_items.item_name IS 'Name/type of the inventory item (separate from detailed description)';
        
        -- Create index for better performance when searching by item name
        CREATE INDEX IF NOT EXISTS idx_inventory_items_item_name ON inventory_items(item_name);
        
        RAISE NOTICE 'Successfully added item_name column and index to inventory_items table';
    ELSE
        RAISE NOTICE 'inventory_items table does not exist. Please run the create_inventory_system migration first.';
    END IF;
END
$$;
