# Vehicle Rental Feature Setup Instructions

## 🚀 Quick Setup

To enable the Vehicle Rental feature, you need to apply the database migrations in the correct order:

### 1. Apply Vehicles Table Migration (if not done already)
```sql
-- File: supabase/migrations/20241220110000_create_vehicles_table.sql
-- This creates the missing vehicles table that the system references
```

### 2. Apply Rental Tables Migration
```sql
-- File: supabase/migrations/20241220120000_create_rental_tables.sql  
-- This creates all rental-related tables and functions
```

## 📋 Migration Order

**IMPORTANT**: Apply migrations in this exact order:

1. `20241220110000_create_vehicles_table.sql` ← **Apply this FIRST**
2. `20241220120000_create_rental_tables.sql` ← **Then apply this**

## ✅ Verification

After applying the migrations, verify the setup:

1. **Navigate to Rental Page**: Go to `/dashboard/financials` → Click "Rental" tab
2. **Check for Errors**: Page should load without console errors
3. **Verify Tables**: You should see:
   - Empty state with "No rentals found" message
   - Summary cards showing zeros
   - "Log New Rental" button available
   - Filters and controls functional

## 🔧 Expected Tables Created

After successful migration, these tables will be created:

- ✅ `vehicles` - Fleet vehicles (with sample data)
- ✅ `vehicle_rentals` - Main rental bookings
- ✅ `rental_vehicles` - Vehicle-rental relationships (many-to-many)
- ✅ `rental_expenses` - Rental-related expenses
- ✅ `rental_receipts` - Payment receipt files
- ✅ Storage bucket: `rental-receipts` for file uploads

## 🎯 Features Available After Setup

- ✅ **Rental Tab Navigation**: New tab in financial section
- ✅ **Summary Dashboard**: Revenue, expenses, profit metrics
- ✅ **Modern UX**: Consistent with existing financial pages
- ✅ **Advanced Filtering**: Date range, client, status filters
- ✅ **Responsive Design**: Works on all devices
- ✅ **Multilingual**: English and Portuguese support
- ✅ **Error Handling**: Graceful fallbacks for missing data

## 🆘 Troubleshooting

### Issue: "relation 'vehicles' does not exist"
**Solution**: Apply the vehicles migration first (`20241220110000_create_vehicles_table.sql`)

### Issue: "relation 'vehicle_rentals' does not exist"  
**Solution**: Apply the rental migration (`20241220120000_create_rental_tables.sql`)

### Issue: Console errors about missing tables
**Solution**: The system will show warnings but won't crash. Apply the migrations to resolve.

## 📞 Support

The system is designed to handle missing tables gracefully:
- ✅ No page crashes
- ✅ Empty state shown when tables don't exist
- ✅ Console warnings (not errors) guide you to apply migrations
- ✅ Rental page loads immediately after migrations are applied

---

**Status**: ✅ Ready for production use after migrations are applied!
