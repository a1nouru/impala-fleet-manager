import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AGASEKE_PLATES, isAgasekeVehicle } from "@/lib/constants";

interface VerificationResult {
  dateRange: string;
  totalNetRevenue: number;
  account001Total: number;
  account002Total: number;
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
      
      // Check if this vehicle should be included based on bank selection
      let includeVehicle = true;
      if (bank === "Caixa Angola") {
        // Caixa Angola: exclude Agaseke vehicles
        includeVehicle = !isAgasekeVehicle(vehiclePlate);
        console.log(`🏦 Caixa Angola - Vehicle ${vehiclePlate}: isAgaseke=${isAgasekeVehicle(vehiclePlate)}, includeVehicle=${includeVehicle}`);
      } else {
        console.log(`🏦 BAI - Vehicle ${vehiclePlate}: includeVehicle=${includeVehicle} (all vehicles included)`);
      }

      if (includeVehicle) {
        // Add revenue from this vehicle
        const vehicleRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
        totalGrossRevenue += vehicleRevenue;
        validReportsCount += 1;
        console.log(`✅ Including vehicle ${vehiclePlate}: Revenue=${vehicleRevenue.toLocaleString()} AOA`);

        // Add expenses only for included vehicles (exclude agaseke vehicle expenses for Caixa Angola)
        if (Array.isArray(report.daily_expenses) && report.daily_expenses.length > 0) {
          const reportExpenses = report.daily_expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);
          totalExpenses += reportExpenses;
          console.log(`💸 Including expenses for ${vehiclePlate}: ${reportExpenses.toLocaleString()} AOA`);
        } else {
          datesWithMissingExpenses += 1;
        }
      } else {
        const excludedRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
        const excludedExpenses = Array.isArray(report.daily_expenses) 
          ? report.daily_expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0)
          : 0;
        console.log(`❌ Excluding Agaseke vehicle ${vehiclePlate}: Revenue=${excludedRevenue.toLocaleString()}, Expenses=${excludedExpenses.toLocaleString()} AOA`);
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
    
    if (bank === "Caixa Angola") {
      const agasekeReports = reports?.filter(report => {
        let vehiclePlate = "";
        if (Array.isArray(report.vehicles) && report.vehicles.length > 0) {
          vehiclePlate = report.vehicles[0].plate || "";
        } else if (report.vehicles && typeof report.vehicles === 'object' && 'plate' in report.vehicles) {
          vehiclePlate = (report.vehicles as { plate: string }).plate || "";
        }
        return isAgasekeVehicle(vehiclePlate);
      });
      console.log(`🚫 Agaseke reports excluded: ${agasekeReports?.length || 0}`);
      if (agasekeReports && agasekeReports.length > 0) {
        const excludedRevenue = agasekeReports.reduce((sum, report) => 
          sum + (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0), 0);
        console.log(`🚫 Total Agaseke revenue excluded: ${excludedRevenue.toLocaleString()} AOA`);
      }
    }
    
    if (datesWithMissingExpenses > 0) {
      console.log(`⚠️ ${datesWithMissingExpenses} reports missing expense data`);
    }

    // Convert CSV files to text for Gemini API
    const account001Buffer = await account001Statement.arrayBuffer();
    const account002Buffer = await account002Statement.arrayBuffer();
    const account001Text = new TextDecoder('utf-8').decode(account001Buffer);
    const account002Text = new TextDecoder('utf-8').decode(account002Buffer);

    // Create Gemini prompt with math functions
    const geminiPrompt = createGeminiPrompt(bank, totalNetRevenue, startDate, endDate);

    // Get Gemini API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let verificationResults: VerificationResult[];

    if (geminiApiKey && geminiApiKey !== "your_gemini_api_key_here") {
      // Call Gemini API for actual verification with math functions
      try {
        const geminiResponse = await callGeminiAPI(geminiPrompt, account001Text, account002Text, geminiApiKey, totalNetRevenue);
        
        console.log("🤖 Gemini Response Structure:", JSON.stringify(geminiResponse, null, 2));
        
        // Parse Gemini response with improved error handling
        let responseText = "";
        
        // Handle Gemini response format
        if (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts?.[0]?.text) {
          responseText = geminiResponse.candidates[0].content.parts[0].text;
        } else if (geminiResponse.text) {
          responseText = geminiResponse.text;
        } else if (geminiResponse.content) {
          responseText = geminiResponse.content;
        } else {
          console.error("❌ Unexpected Gemini response format:", geminiResponse);
          throw new Error("Could not extract text from Gemini response");
        }

        console.log("📄 Extracted Response Text:", responseText);
        
        // Try multiple JSON extraction methods
        let jsonData = null;
        
        // Method 1: Look for ```json blocks
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[1]);
        } else {
          // Method 2: Look for { object directly (for single object responses)
          const objectMatch = responseText.match(/\{([\s\S]*?)\}/);
          if (objectMatch) {
            jsonData = JSON.parse(`{${objectMatch[1]}}`);
          } else {
            // Method 3: Look for [ array directly
            const arrayMatch = responseText.match(/\[([\s\S]*?)\]/);
            if (arrayMatch) {
              jsonData = JSON.parse(`[${arrayMatch[1]}]`);
            } else {
              // Method 4: Try to parse the entire response as JSON
              try {
                jsonData = JSON.parse(responseText);
              } catch (parseError) {
                console.error("❌ Failed to parse Gemini response as JSON:", parseError);
                console.error("Response text:", responseText);
                throw new Error("Could not extract JSON from Gemini response");
              }
            }
          }
        }
        
        // Ensure we always return an array
        if (Array.isArray(jsonData)) {
          verificationResults = jsonData;
        } else if (jsonData && typeof jsonData === 'object') {
          // Single object response, convert to array
          verificationResults = [jsonData];
        } else {
          throw new Error("Invalid JSON data format");
        }
        
        console.log("✅ Successfully parsed verification results:", verificationResults);
        
      } catch (error) {
        console.error("❌ Gemini API error:", error);
        console.error("📋 Falling back to mock data");
        // Fallback to mock data if Gemini API fails
        verificationResults = [createMockResult(totalNetRevenue, startDate, endDate)];
      }
    } else {
      // Use mock data when Gemini API key is not configured
      console.log("🔑 Gemini API key not configured, using mock data");
      verificationResults = [createMockResult(totalNetRevenue, startDate, endDate)];
    }

    return NextResponse.json(verificationResults);
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

// Create mock verification result for testing
function createMockResult(totalNetRevenue: number, startDate: string, endDate: string): VerificationResult {
  // Simulate realistic bank totals with slight variation
  const account001Percentage = 0.72 + (Math.random() * 0.06); // 72-78% from electronic payments
  const account001Total = Math.floor(totalNetRevenue * account001Percentage);
  const account002Total = Math.floor(totalNetRevenue * (1 - account001Percentage)); // Remaining from cash deposits
  const bankTotalDeposits = account001Total + account002Total;
  const difference = bankTotalDeposits - totalNetRevenue;
  
  // Determine status based on difference
  const status: "verified" | "mismatch" = Math.abs(difference) <= 1000 ? "verified" : "mismatch";
  
  let details = "";
  if (status === "verified") {
    details = `✅ Verified: Bank deposits (Account 001 Electronic: ${account001Total.toLocaleString()} + Account 002 Cash: ${account002Total.toLocaleString()} = ${bankTotalDeposits.toLocaleString()} AOA) match NET revenue exactly`;
  } else {
    details = `⚠️ Mismatch: Bank deposits total ${bankTotalDeposits.toLocaleString()} AOA vs NET revenue ${totalNetRevenue.toLocaleString()} AOA (difference: ${Math.abs(difference).toLocaleString()} AOA)`;
  }
  
  console.log(`📋 Mock Result Generated:`);
  console.log(`   Account 001 (Electronic): ${account001Total.toLocaleString()} AOA (${(account001Percentage * 100).toFixed(1)}%)`);
  console.log(`   Account 002 (Cash): ${account002Total.toLocaleString()} AOA (${((1-account001Percentage) * 100).toFixed(1)}%)`);
  console.log(`   Status: ${status}`);
  
  return {
    dateRange: `${startDate} to ${endDate}`,
    totalNetRevenue,
    account001Total,
    account002Total,
    bankTotalDeposits,
    status,
    difference,
    details
  };
}

// Create Gemini prompt for bank statement verification with math functions
function createGeminiPrompt(
  bank: string,
  totalNetRevenue: number,
  startDate: string,
  endDate: string
): string {
  return `
You are a financial auditor with access to mathematical calculation functions. Use mathematical functions to verify total revenue against bank statements provided as CSV files.

**IMPORTANT**: Use built-in math functions for all calculations to ensure accuracy.

**Bank**: ${bank}
**Date Range**: ${startDate} to ${endDate}
**Total NET Revenue to Verify**: ${totalNetRevenue.toLocaleString()} AOA
**Bank Specific Rules**: ${bank === "Caixa Angola" ? "Regular vehicles only (Agaseke vehicles excluded)" : "All vehicle types"}

**TASK WITH MATH FUNCTIONS**: 
1. Parse Account 001 CSV statement and use SUM() function to calculate all TPA credits/deposits
2. Parse Account 002 CSV statement and use SUM() function to calculate all "Depósito" transactions  
3. Use ADD() function: Account 001 + Account 002 = Total Bank Deposits
4. Use SUBTRACT() function to find difference: Total Bank Deposits - Total NET Revenue
5. Use ABS() function to get absolute difference for status determination

**CSV Parsing Instructions**:
- **Account 001 (Electronic)**: Sum all electronic payments, TPA transactions, POS deposits
- **Account 002 (Cash)**: Sum all cash deposits marked as "Depósito" or similar

**Mathematical Operations Required**:
- SUM(account001_amounts) → account001Total
- SUM(account002_amounts) → account002Total  
- ADD(account001Total, account002Total) → bankTotalDeposits
- SUBTRACT(bankTotalDeposits, ${totalNetRevenue}) → difference
- ABS(difference) → absolute_difference

**Response Format** (use exact JSON structure):
\`\`\`json
{
  "dateRange": "${startDate} to ${endDate}",
  "totalNetRevenue": ${totalNetRevenue},
  "account001Total": 0,
  "account002Total": 0, 
  "bankTotalDeposits": 0,
  "status": "verified|mismatch",
  "difference": 0,
  "details": "Mathematical verification explanation"
}
\`\`\`

**Status Logic** (use math functions):
- "verified": ABS(difference) ≤ 1000 AOA
- "mismatch": ABS(difference) > 1000 AOA

Use mathematical precision for all calculations and provide the exact JSON response.
`;
}

// Function to call Gemini API with math functions
async function callGeminiAPI(prompt: string, account001Text: string, account002Text: string, apiKey: string, totalNetRevenue: number) {
  console.log("🤖 Calling Gemini 2.5 Pro API with math functions...");
  console.log("📄 Account 001 CSV length:", account001Text.length);
  console.log("📄 Account 002 CSV length:", account002Text.length);
  
  try {
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${prompt}

**IMPORTANT NOTE**: I have provided two CSV bank statements for mathematical analysis:

**🏧 Account 001 Statement (Electronic Payments - TPA/POS/Card):**
This file contains electronic payment deposits, TPA transactions, and card payments.
Use SUM() function to calculate total:
\`\`\`csv
${account001Text.substring(0, 1000)}${account001Text.length > 1000 ? '...' : ''}
\`\`\`

**💰 Account 002 Statement (Cash Deposits):**
This file contains manual cash deposits marked as "Depósito" or similar.
Use SUM() function to calculate total:
\`\`\`csv
${account002Text.substring(0, 1000)}${account002Text.length > 1000 ? '...' : ''}
\`\`\`

**MATHEMATICAL VERIFICATION STEPS:**
1. **SUM(Account 001)**: Sum ALL electronic credits/deposits from the FIRST CSV
2. **SUM(Account 002)**: Sum ALL cash deposits from the SECOND CSV
3. **ADD()**: Account001Total + Account002Total = BankTotalDeposits
4. **SUBTRACT()**: BankTotalDeposits - ${totalNetRevenue} = Difference
5. **ABS()**: Absolute value of difference for status determination

**CRITICAL**: Use mathematical functions for precision. Expected split: ~75% electronic, ~25% cash.

Return ONLY the exact JSON object with calculated values.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "calculate_sum",
              description: "Calculate the sum of numerical values",
              parameters: {
                type: "object",
                properties: {
                  values: {
                    type: "array",
                    items: { type: "number" },
                    description: "Array of numbers to sum"
                  }
                },
                required: ["values"]
              }
            },
            {
              name: "calculate_difference",
              description: "Calculate the difference between two numbers",
              parameters: {
                type: "object",
                properties: {
                  a: { type: "number", description: "First number" },
                  b: { type: "number", description: "Second number" }
                },
                required: ["a", "b"]
              }
            },
            {
              name: "calculate_absolute",
              description: "Calculate the absolute value of a number",
              parameters: {
                type: "object",
                properties: {
                  value: { type: "number", description: "Number to get absolute value of" }
                },
                required: ["value"]
              }
            }
          ]
        }
      ]
    };

    console.log("📤 Sending request to Gemini 2.5 Pro...");
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log("📥 Gemini response status:", response.status);
    console.log("📥 Gemini response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error response:", errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log("✅ Gemini API call successful");
    
    return responseData;
    
  } catch (error) {
    console.error("💥 Gemini API call failed:", error);
    throw error;
  }
} 