-- Cleanup migration to clear legacy deposit_slip_url field
-- This prevents duplication between old and new slip systems

-- Clear the legacy deposit_slip_url field for deposits that have been migrated to the new system
UPDATE bank_deposits 
SET deposit_slip_url = NULL 
WHERE id IN (
    SELECT DISTINCT deposit_id 
    FROM bank_deposit_slips 
    WHERE deposit_id IS NOT NULL
);

-- Add a comment to document this cleanup
COMMENT ON COLUMN bank_deposits.deposit_slip_url IS 'Legacy field - replaced by bank_deposit_slips table. Should be NULL for new deposits.'; 