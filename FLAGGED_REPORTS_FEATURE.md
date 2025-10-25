# Flagged Reports Feature

## Overview
The Impala Express Fleet Manager now automatically flags daily reports that require management attention and forces users to provide explanations for these situations.

## Flagging Criteria
A daily report is automatically flagged if it meets **any** of the following conditions:

1. **Low Net Revenue**: Net revenue is less than 50% of total revenue
2. **High Expenses**: Total expenses exceed 210,000.00 AOA

## Visual Indicators

### Table Row Highlighting
- Flagged reports have a **light red background** (`bg-red-50`) in the financials table
- This immediately draws attention to problematic reports

### Warning Icons
- **Amber triangle icon** (⚠️) appears next to vehicle plates for flagged reports
- **Green triangle icon** appears when an explanation has been provided
- Hovering over the icon shows:
  - The specific reason why the report was flagged
  - The explanation (if provided)

### Action Buttons
- Flagged reports show an additional **amber warning button** in the Actions column
- Button tooltip indicates whether an explanation is needed or can be viewed/edited

## Explanation Requirements

### When Required
- Explanations are **mandatory** for all flagged reports
- Users cannot save updates to flagged reports without providing an explanation
- The explanation field appears automatically in the edit dialog for flagged reports

### How to Add Explanations

#### Method 1: Through Edit Dialog
1. Click the **Edit** button (pencil icon) on a flagged report
2. The explanation field will appear at the bottom of the form with:
   - Amber-colored label indicating it's required
   - Description of why the report was flagged
   - Large text area for detailed explanation
3. Fill in the explanation and save the report

#### Method 2: Standalone Explanation Dialog
1. Click the **Warning** button (triangle icon) in the Actions column
2. A dedicated explanation dialog opens showing:
   - The specific flag reason
   - Current explanation (if any)
   - Text area to add/edit explanation
3. Save the explanation directly

### Validation
- Explanation text cannot be empty for flagged reports
- Validation occurs when saving report updates
- Clear error messages guide users to provide explanations

## Database Schema
A new `explanation` field has been added to the `daily_reports` table:

```sql
-- Migration: 20241218000000_add_explanation_to_daily_reports.sql
ALTER TABLE daily_reports ADD COLUMN explanation TEXT;
COMMENT ON COLUMN daily_reports.explanation IS 'Explanation required when net revenue is less than 50% of total revenue or expenses exceed 210,000 AOA';
CREATE INDEX idx_daily_reports_explanation ON daily_reports(explanation) WHERE explanation IS NOT NULL;
```

## Technical Implementation

### Helper Functions
- `isReportFlagged(report)`: Determines if a report meets flagging criteria
- `getFlagReason(report)`: Returns human-readable explanation of why report was flagged

### State Management
- Explanation dialog state managed separately from edit dialog
- Automatic validation prevents saving flagged reports without explanations
- Real-time UI updates when explanations are added/modified

### User Experience Features
- **Clean, modern UI** with consistent design patterns
- **Tooltips** provide context without cluttering the interface
- **Color coding**: Amber for needs attention, Green for resolved
- **Non-intrusive** warnings that don't interrupt normal workflow
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Business Benefits

1. **Proactive Management**: Automatically identifies problematic financial situations
2. **Accountability**: Requires explanations for unusual circumstances
3. **Audit Trail**: Stores explanations for future reference and analysis
4. **Risk Management**: Early detection of potential issues
5. **Transparency**: Clear visibility into operational challenges

## Usage Examples

### Example 1: High Expenses
A vehicle reports 250,000 AOA in expenses (exceeding the 210,000 threshold):
- Row highlighted in light red
- Warning icon appears with tooltip: "Expenses exceed 210,000 AOA (250,000 AOA)"
- Manager clicks explanation button and enters: "Emergency tire replacement due to road damage on Luanda-Huambo route"

### Example 2: Low Net Revenue
A vehicle has 500,000 AOA revenue but 400,000 AOA expenses (80% expense ratio, net revenue only 20%):
- Row highlighted in light red  
- Warning icon appears with tooltip: "Net revenue is 20.0% of total revenue (less than 50%)"
- Manager explains: "Unexpected mechanical repairs reduced profitability. Vehicle serviced and back to normal operations."

## Migration Instructions

1. **Apply Database Migration**:
   ```bash
   npx supabase migration up
   ```

2. **Update Production**: Deploy the updated code and run migrations

3. **Training**: Brief team on new flagged reports feature and explanation requirements

## Monitoring

- Reports with explanations can be tracked via the `explanation` field
- Use queries to identify patterns in flagged reports
- Monitor explanation quality and frequency for operational insights 