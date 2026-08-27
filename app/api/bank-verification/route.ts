import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface VerificationResult {
  dateRange: string;
  totalNetRevenue: number;
  account930508110002Total: number;
  account930508110001Total: number;
  bankTotalDeposits: number;
  status: "verified" | "mismatch";
  difference: number;
  details: string;
}

interface DailyReport {
  id: string;
  report_date: string;
  ticket_revenue: number;
  baggage_revenue: number;
  cargo_revenue: number;
  vehicles?: { plate: string }[];
  daily_expenses?: any[];
  payment_method?: "TPA" | "POS" | "Cash";
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const bank = formData.get("bank") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const account001Statement = formData.get("account001Statement") as File;
    const account002Statement = formData.get("account002Statement") as File;

    // Validate inputs
    if (!bank || !startDate || !endDate || !account001Statement || !account002Statement) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Fetch daily reports with vehicle and expense data for the date range
    console.log(`📅 Fetching reports from ${startDate} to ${endDate} for bank: ${bank}`);
    
    const { data: reports, error: reportsError } = await supabase
      .from("daily_reports")
      .select(`
        id,
        report_date,
        ticket_revenue,
        baggage_revenue,
        cargo_revenue,
        vehicles (plate),
        daily_expenses (amount)
      `)
      .eq("status", "Operational")
      .gte("report_date", startDate)
      .lte("report_date", endDate)
      .order("report_date", { ascending: true });

    console.log(`📊 Found ${reports?.length || 0} reports before filtering`);

    if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      return NextResponse.json(
        { error: "Failed to fetch daily reports" },
        { status: 500 }
      );
    }

    // Calculate total NET revenue for the entire date range
    let totalGrossRevenue = 0;
    let totalExpenses = 0;
    let validReportsCount = 0;
    let datesWithMissingExpenses = 0;

    console.log(`📊 Calculating total NET revenue for ${bank} from ${startDate} to ${endDate}`);

    for (const report of reports || []) {
      // Extract vehicle plate - handle both array and direct object structures
      let vehiclePlate = "";
      if (Array.isArray(report.vehicles) && report.vehicles.length > 0) {
        vehiclePlate = report.vehicles[0].plate || "";
      } else if (report.vehicles && typeof report.vehicles === 'object' && 'plate' in report.vehicles) {
        vehiclePlate = (report.vehicles as { plate: string }).plate || "";
      }
      
      // Debug logging for each report
      console.log(`🔍 Report ${report.id} (${report.report_date}): Vehicle plate: "${vehiclePlate}"`);
      
      // Add revenue from this vehicle
      const vehicleRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
      totalGrossRevenue += vehicleRevenue;
      validReportsCount += 1;
      console.log(`✅ Including vehicle ${vehiclePlate}: Revenue=${vehicleRevenue.toLocaleString()} AOA`);

      if (Array.isArray(report.daily_expenses) && report.daily_expenses.length > 0) {
        const reportExpenses = report.daily_expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);
        totalExpenses += reportExpenses;
        console.log(`💸 Including expenses for ${vehiclePlate}: ${reportExpenses.toLocaleString()} AOA`);
      } else {
        datesWithMissingExpenses += 1;
      }
    }

    const totalNetRevenue = totalGrossRevenue - totalExpenses;
    
    console.log(`\n📊 VERIFICATION CALCULATION SUMMARY:`);
    console.log(`🏦 Bank: ${bank}`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`💰 Total Gross Revenue: ${totalGrossRevenue.toLocaleString()} AOA`);
    console.log(`💸 Total Expenses: ${totalExpenses.toLocaleString()} AOA`);
    console.log(`📈 Total NET Revenue: ${totalNetRevenue.toLocaleString()} AOA`);
    console.log(`🚗 Valid reports included: ${validReportsCount}`);
    console.log(`📊 Total reports processed: ${reports?.length || 0}`);
    
    
    if (datesWithMissingExpenses > 0) {
      console.log(`⚠️ ${datesWithMissingExpenses} reports missing expense data`);
    }

    // Convert CSV files to text for Gemini API
    console.log(`📄 Processing CSV files for Gemini analysis:`);
    console.log(`   📊 Account 001 file: "${account001Statement.name}" (size: ${account001Statement.size} bytes)`);
    console.log(`   💰 Account 002 file: "${account002Statement.name}" (size: ${account002Statement.size} bytes)`);
    
    const account001Buffer = await account001Statement.arrayBuffer();
    const account002Buffer = await account002Statement.arrayBuffer();
    const account001Text = new TextDecoder('utf-8').decode(account001Buffer);
    const account002Text = new TextDecoder('utf-8').decode(account002Buffer);

    // Log first few lines of each CSV to verify correct mapping
    const account001Preview = account001Text.split('\n').slice(0, 3).join('\n');
    const account002Preview = account002Text.split('\n').slice(0, 3).join('\n');
    
    console.log(`💰 Account 002 (Cash) CSV preview:`);
    console.log(account002Preview);
    console.log(`📊 Account 001 (Electronic) CSV preview:`);
    console.log(account001Preview);

    // Parse CSV files directly and perform verification
    console.log("🧮 Starting direct CSV parsing and verification...");
    
    try {
      // Parse Account 002 (Cash) CSV for "Depósito" credits
      const account002Total = parseAccount002CSV(account002Text);
      console.log(`💰 Account 002 (Cash) - Total Depósito credits: ${account002Total.toLocaleString()} AOA`);
      
      // Parse Account 001 (Electronic) CSV for "Fecho TPA" credits  
      const account001Total = parseAccount001CSV(account001Text);
      console.log(`📊 Account 001 (Electronic) - Total Fecho TPA credits: ${account001Total.toLocaleString()} AOA`);
      
      // Calculate totals and verification
      const bankTotalDeposits = account002Total + account001Total;
      const difference = bankTotalDeposits - totalNetRevenue;
      const status: "verified" | "mismatch" = Math.abs(difference) <= 1000 ? "verified" : "mismatch";
      
      console.log(`\n📊 DIRECT VERIFICATION RESULTS:`);
      console.log(`💰 Account 002 (Cash): ${account002Total.toLocaleString()} AOA`);
      console.log(`📊 Account 001 (Electronic): ${account001Total.toLocaleString()} AOA`);
      console.log(`🏦 Total Bank Deposits: ${bankTotalDeposits.toLocaleString()} AOA`);
      console.log(`📈 NET Revenue from Reports: ${totalNetRevenue.toLocaleString()} AOA`);
      console.log(`⚖️ Difference: ${difference.toLocaleString()} AOA`);
      console.log(`✅ Status: ${status.toUpperCase()}`);
      
      let details = "";
      if (status === "verified") {
        details = `✅ Verified: Bank deposits (Account 002 Cash: ${account002Total.toLocaleString()} + Account 001 Electronic: ${account001Total.toLocaleString()} = ${bankTotalDeposits.toLocaleString()} AOA) match NET revenue within tolerance (difference: ${Math.abs(difference).toLocaleString()} AOA)`;
      } else {
        details = `⚠️ Mismatch: Bank deposits total ${bankTotalDeposits.toLocaleString()} AOA vs NET revenue ${totalNetRevenue.toLocaleString()} AOA (difference: ${Math.abs(difference).toLocaleString()} AOA exceeds 1,000 AOA tolerance)`;
      }
      
      const verificationResult: VerificationResult = {
        dateRange: `${startDate} to ${endDate}`,
        totalNetRevenue,
        account930508110002Total: account002Total,
        account930508110001Total: account001Total,
        bankTotalDeposits,
        status,
        difference,
        details
      };
      
             const verificationResults = [verificationResult];
       
       return NextResponse.json(verificationResults);
       
    } catch (error) {
      console.error("❌ CSV parsing error:", error);
      
      // Return detailed error information to the user
      return NextResponse.json(
        { 
          error: "CSV parsing failed",
          message: `Failed to parse bank statement CSV files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: "Please check that the uploaded CSV files are in the correct format and contain the expected transaction data.",
          troubleshooting: [
            "Verify Account 001 CSV contains 'Fecho TPA' transactions",
            "Verify Account 002 CSV contains 'Depósito nº' transactions", 
            "Check CSV file format and encoding",
            "Ensure files are not corrupted or empty"
          ]
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Bank verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to determine payment method
function determinePaymentMethod(report: any): "TPA" | "POS" | "Cash" {
  // This is a simplified logic - you might want to enhance this based on your data structure
  const expenses = report.daily_expenses || [];
  const hasCashExpenses = expenses.some((expense: any) => expense.type === "cash");
  
  if (hasCashExpenses) {
    return "Cash";
  }
  
  // Default to TPA/POS for card payments
  return Math.random() > 0.5 ? "TPA" : "POS";
}

// Helper function to calculate total revenue
function calculateTotalRevenue(report: DailyReport): number {
  return (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
}



// Function to parse Account 002 CSV and sum "Depósito" credits
function parseAccount002CSV(csvText: string): number {
  console.log("💰 Parsing Account 002 (Cash) CSV for Depósito credits...");
  
  if (!csvText || csvText.trim().length === 0) {
    throw new Error("Account 002 CSV file is empty or invalid");
  }
  
  const lines = csvText.split('\n');
  let total = 0;
  let depositCount = 0;
  let transactionRowsStarted = false;
  
  console.log(`📄 Processing ${lines.length} lines from Account 002 CSV`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Try different splitting approaches for better CSV parsing
      let columns: string[];
      
      if (line.includes('\t')) {
        // Tab-separated
        columns = line.split('\t');
      } else if (line.includes(',')) {
        // Comma-separated (handle quoted values)
        columns = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      } else {
        // Single column or unknown format
        columns = [line];
      }
      
      // Skip header rows until we find transaction data
      // Look for date patterns to identify when transaction rows start
      if (!transactionRowsStarted) {
        const hasDatePattern = columns.some(col => /^\d{2}\/\d{2}\/\d{4}$/.test(col?.trim()));
        if (hasDatePattern) {
          transactionRowsStarted = true;
          console.log(`📅 Account 002 transaction rows started at line ${i + 1}`);
          console.log(`📄 Column count: ${columns.length}, Sample columns: [${columns.slice(0, 8).map(c => `"${c?.trim()}"`).join(', ')}]`);
          console.log(`📄 Description (col 2): "${columns[2]?.trim()}", Value (col 3): "${columns[3]?.trim()}"`);
        } else {
          continue; // Skip header rows
        }
      }
      
            // Bank statement format: Movement Date | Effective Date | Description | Value | Currency | Balance After | Currency | Operation Number | Document Number
      // Look for "Depósito nº" in the description column (index 2) and get value from column 3
      
      if (columns.length >= 4) {
        const description = columns[2]?.trim().replace(/"/g, '') || '';
        const valueColumn = columns[3]?.trim().replace(/"/g, '') || '';
        
        // Debug every 10th transaction line to understand the structure
        if ((i % 10) === 0 && transactionRowsStarted) {
          console.log(`🔍 Line ${i + 1} structure: Desc="${description}" | Value="${valueColumn}" | Columns=${columns.length}`);
        }
        
        // Check if description contains "Depósito nº" or "Depósito n" (case insensitive and flexible)
        if (description && (description.toLowerCase().includes('depósito n') || description.toLowerCase().includes('deposito n'))) {
          // Parse the value column
          const cleanValue = valueColumn.replace(/[^\d.-]/g, ''); // Remove non-numeric except decimal and minus
          const amount = parseFloat(cleanValue);
          
          if (!isNaN(amount) && amount > 0) {
            total += amount;
            depositCount++;
            console.log(`💰 Found Depósito: ${amount.toLocaleString()} AOA - "${description}"`);
          } else {
            console.log(`⚠️ Found Depósito description but invalid amount: "${description}" - Value: "${valueColumn}" - Clean: "${cleanValue}"`);
          }
        }
      } else {
        // Fallback: search through all columns if structure is different
        let description = "";
        let valueStr = "";
        
        for (let j = 0; j < columns.length; j++) {
          const col = columns[j]?.trim().replace(/"/g, '');
          if (col && col.toLowerCase().includes('depósito n')) {
            description = col;
            // Value is typically in the next few columns
            for (let k = j + 1; k < Math.min(j + 4, columns.length); k++) {
              const potentialValue = columns[k]?.trim().replace(/"/g, '');
              // Handle various number formats: 131000, 1.500000, 15000.50, etc.
              if (potentialValue && /^-?\d+(\.\d+)?$/.test(potentialValue.replace(/,/g, ''))) {
                const numericValue = parseFloat(potentialValue.replace(/,/g, ''));
                if (numericValue > 0) { // Only positive values for deposits
                  valueStr = potentialValue.replace(/,/g, '');
                  break;
                }
              }
            }
            break;
          }
        }
        
        if (description && valueStr) {
          const amount = parseFloat(valueStr);
          if (!isNaN(amount) && amount > 0) {
            total += amount;
            depositCount++;
            console.log(`💰 Found Depósito (fallback): ${amount.toLocaleString()} AOA - "${description}"`);
          }
        }
      }
      

    } catch (lineError) {
      console.warn(`⚠️ Error parsing line ${i + 1} in Account 002 CSV:`, lineError);
      // Continue processing other lines
    }
  }
  
  if (depositCount === 0) {
    throw new Error(`No 'Depósito nº' transactions found in Account 002 CSV. Please verify the file contains cash deposit transactions.`);
  }
  
  console.log(`💰 Account 002 Summary: Found ${depositCount} Depósito transactions totaling ${total.toLocaleString()} AOA`);
  return total;
}

// Function to parse Account 001 CSV and sum "Fecho TPA" credits  
function parseAccount001CSV(csvText: string): number {
  console.log("📊 Parsing Account 001 (Electronic) CSV for Fecho TPA credits...");
  
  if (!csvText || csvText.trim().length === 0) {
    throw new Error("Account 001 CSV file is empty or invalid");
  }
  
  const lines = csvText.split('\n');
  let total = 0;
  let tpaCount = 0;
  let transactionRowsStarted = false;
  
  console.log(`📄 Processing ${lines.length} lines from Account 001 CSV`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Try different splitting approaches for better CSV parsing
      let columns: string[];
      
      if (line.includes('\t')) {
        // Tab-separated
        columns = line.split('\t');
      } else if (line.includes(',')) {
        // Comma-separated (handle quoted values)
        columns = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      } else {
        // Single column or unknown format
        columns = [line];
      }
      
      // Skip header rows until we find transaction data
      // Look for date patterns to identify when transaction rows start
      if (!transactionRowsStarted) {
        const hasDatePattern = columns.some(col => /^\d{2}\/\d{2}\/\d{4}$/.test(col?.trim()));
        if (hasDatePattern) {
          transactionRowsStarted = true;
          console.log(`📅 Account 001 transaction rows started at line ${i + 1}`);
          console.log(`📄 Column count: ${columns.length}, Sample columns: [${columns.slice(0, 8).map(c => `"${c?.trim()}"`).join(', ')}]`);
          console.log(`📄 Description (col 2): "${columns[2]?.trim()}", Value (col 3): "${columns[3]?.trim()}"`);
        } else {
          continue; // Skip header rows
        }
      }
      
            // Bank statement format: Movement Date | Effective Date | Description | Value | Currency | Balance After | Currency | Operation Number | Document Number
      // Look for "Fecho TPA" in the description column (index 2) and get value from column 3, EXCLUDE "Comissões-Fecho TPA" (fees)
      
      if (columns.length >= 4) {
        const description = columns[2]?.trim().replace(/"/g, '') || '';
        const valueColumn = columns[3]?.trim().replace(/"/g, '') || '';
        
        // Debug every 10th transaction line to understand the structure
        if ((i % 10) === 0 && transactionRowsStarted) {
          console.log(`🔍 Line ${i + 1} structure: Desc="${description}" | Value="${valueColumn}" | Columns=${columns.length}`);
        }
        
        // Check if description contains "Fecho TPA" but NOT "Comissões" (case insensitive)
        if (description && description.toLowerCase().includes('fecho tpa') && !description.toLowerCase().includes('comissões')) {
          // Parse the value column
          const cleanValue = valueColumn.replace(/[^\d.-]/g, ''); // Remove non-numeric except decimal and minus
          const amount = parseFloat(cleanValue);
          
          if (!isNaN(amount) && amount > 0) {
            total += amount;
            tpaCount++;
            console.log(`📊 Found Fecho TPA: ${amount.toLocaleString()} AOA - "${description}"`);
          } else {
            console.log(`⚠️ Found Fecho TPA description but invalid amount: "${description}" - Value: "${valueColumn}"`);
          }
        }
      } else {
        // Fallback: search through all columns if structure is different
        let description = "";
        let valueStr = "";
        
        for (let j = 0; j < columns.length; j++) {
          const col = columns[j]?.trim().replace(/"/g, '');
          if (col && col.toLowerCase().includes('fecho tpa') && !col.toLowerCase().includes('comissões')) {
            description = col;
            // Value is typically in the next few columns
            for (let k = j + 1; k < Math.min(j + 4, columns.length); k++) {
              const potentialValue = columns[k]?.trim().replace(/"/g, '');
              // Handle various number formats: 96000, 1.500000, 15000.50, etc.
              if (potentialValue && /^-?\d+(\.\d+)?$/.test(potentialValue.replace(/,/g, ''))) {
                const numericValue = parseFloat(potentialValue.replace(/,/g, ''));
                if (numericValue > 0) { // Only positive values for TPA credits
                  valueStr = potentialValue.replace(/,/g, '');
                  break;
                }
              }
            }
            break;
          }
        }
        
        if (description && valueStr) {
          const amount = parseFloat(valueStr);
          if (!isNaN(amount) && amount > 0) {
            total += amount;
            tpaCount++;
            console.log(`📊 Found Fecho TPA (fallback): ${amount.toLocaleString()} AOA - "${description}"`);
          }
        }
      }
    } catch (lineError) {
      console.warn(`⚠️ Error parsing line ${i + 1} in Account 001 CSV:`, lineError);
      // Continue processing other lines
    }
  }
  
  if (tpaCount === 0) {
    throw new Error(`No 'Fecho TPA' transactions found in Account 001 CSV. Please verify the file contains electronic payment transactions (excluding commission fees).`);
  }
  
  console.log(`📊 Account 001 Summary: Found ${tpaCount} Fecho TPA transactions totaling ${total.toLocaleString()} AOA`);
  return total;
}



 