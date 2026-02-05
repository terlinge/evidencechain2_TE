import OpenAI from 'openai';
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization - create OpenAI client when first needed
let openai = null;
function getOpenAIClient() {
  if (openai) return openai;
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set in environment');
    return null;
  }
  
  console.log('✅ Initializing OpenAI client with API key:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return openai;
}

/**
 * Extract text from PDF file using pdfjs-dist
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + '\\n';
    }
    
    console.log(`✅ Extracted ${fullText.length} characters from ${pdfDocument.numPages} pages`);
    return fullText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract tables from PDF using Python pdfplumber script
 */
async function extractTablesFromPDF(filePath) {
  try {
    const pythonScript = path.join(__dirname, '../scripts/extract_tables.py');
    const venvPython = path.join(__dirname, '../../../.venv/Scripts/python.exe');
    
    console.log(`📊 Extracting tables with Python script...`);
    
    const { stdout, stderr } = await execAsync(`"${venvPython}" "${pythonScript}" "${filePath}"`);
    
    if (stderr && !stderr.includes('Warning')) {
      console.warn('Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.success) {
      console.log(`✅ Extracted ${result.table_count} tables from PDF`);
      return result.tables;
    } else {
      console.error('❌ Table extraction failed:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Table extraction error:', error);
    return []; // Return empty array instead of failing - we can still extract text
  }
}

/**
 * Extract study metadata (title, authors, DOI, year) from PDF
 */
export async function extractMetadata(filePath, fileName) {
  console.log('🔍 Extracting metadata from:', fileName);
  
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY not configured. Cannot extract metadata without API key.');
  }

  try {
    const documentText = await extractTextFromPDF(filePath);
    const first2000Chars = documentText.substring(0, 2000);

    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Extract study metadata from this document. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `Extract the following from this clinical trial document:
{
  "title": "Full study title",
  "authors": "First Author, Second Author, Third Author",
  "doi": "DOI if present",
  "nctNumber": "NCT number if present",
  "year": year as number
}

Document start:
${first2000Chars}

Return ONLY the JSON object.`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const metadata = JSON.parse(completion.choices[0].message.content);
    console.log('✅ Metadata extracted:', metadata.title);
    return metadata;
  } catch (error) {
    console.error('❌ Metadata extraction failed:', error.message);
    throw error;
  }
}

/**
 * Extract clinical trial data using GPT-4
 */
export async function extractClinicalData(filePath, fileName, projectPICOTS = {}) {
  console.log('🤖 Starting AI extraction for:', fileName);
  
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY not configured. Cannot extract clinical data without API key.');
  }

  try {
    // Extract text from PDF
    const documentText = await extractTextFromPDF(filePath);
    console.log(`📄 Extracted ${documentText.length} characters from PDF`);
    
    // Extract tables from PDF
    const tables = await extractTablesFromPDF(filePath);
    console.log(`📊 Extracted ${tables.length} tables from PDF`);
    
    // Split document into chunks if too large (>30,000 chars)
    const CHUNK_SIZE = 30000;
    const chunks = [];
    if (documentText.length > CHUNK_SIZE) {
      console.log(`📄 Document too large (${documentText.length} chars), splitting into chunks...`);
      for (let i = 0; i < documentText.length; i += CHUNK_SIZE) {
        chunks.push(documentText.substring(i, i + CHUNK_SIZE));
      }
      console.log(`📄 Split into ${chunks.length} chunks`);
    } else {
      chunks.push(documentText);
    }

    // Prepare the prompt template
    const picotsContext = projectPICOTS.conditionName 
      ? `\n**PROJECT CONTEXT (Use these PICOTS criteria for validation):**
- Condition: ${projectPICOTS.conditionName}
- Expected Treatments: ${projectPICOTS.drugs?.join(', ') || 'Any treatments found'}
- Population: ${projectPICOTS.population?.ageMin}-${projectPICOTS.population?.ageMax} years, ${projectPICOTS.population?.severity || 'Any severity'}
- Outcomes: ${projectPICOTS.outcomes?.primary?.map(o => o.name).join(', ') || 'Extract all outcomes found'}

⚠️ If document data doesn't match these PICOTS criteria, include a warning.`
      : `\n**DEFAULT EXTRACTION RULES (No PICOTS defined):**
- Extract ALL primary outcomes
- Extract ALL secondary outcomes  
- Extract ALL adverse events (AEs)
- Extract ALL serious adverse events (SAEs)
- Extract ALL treatment arms and comparisons`;

    // Process each chunk and collect results
    let allSingleArmData = [];
    let allComparativeData = [];
    let allWarnings = [];
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      console.log(`\n📄 CHUNK ${chunkIndex + 1}/${chunks.length} PREVIEW (first 500 chars):`);
      console.log(chunk.substring(0, 500) + '...\n');
      
      // Format tables for this chunk (tables that appear in this text range)
      let tableSection = '';
      if (tables.length > 0) {
        tableSection = '\n\n**EXTRACTED TABLES - FOCUS ON OUTCOME/RESULTS TABLES, SKIP BASELINE/DEMOGRAPHICS:**\n\n';
        tables.forEach((table, idx) => {
          tableSection += `=== TABLE ${idx + 1} (Page ${table.page}) ===\n`;
          
          // Format as proper table with columns aligned
          if (table.headers && table.headers.length > 0) {
            tableSection += `| ${table.headers.join(' | ')} |\n`;
            tableSection += `|${table.headers.map(() => '---').join('|')}|\n`;
          }
          
          table.rows.forEach((row) => {
            if (Array.isArray(row)) {
              tableSection += `| ${row.join(' | ')} |\n`;
            } else {
              tableSection += `| ${JSON.stringify(row)} |\n`;
            }
          });
          tableSection += '\n';
        });
        
        tableSection += '\n**EXTRACTION PRIORITY - LOOK FOR THESE IN OUTCOME TABLES:**\n';
        tableSection += '- Death/mortality counts and rates (all-cause, cardiovascular)\n';
        tableSection += '- Hospitalization events (CV-related, all-cause)\n';
        tableSection += '- Disease progression or worsening events\n';
        tableSection += '- Changes from baseline in symptom scores (any score reported)\n';
        tableSection += '- Changes from baseline in biomarkers (any lab values reported)\n';
        tableSection += '- Adverse events (any AE, serious AE, treatment discontinuations)\n';
        tableSection += '- Hazard ratios (HR), odds ratios (OR), risk ratios (RR) with 95% CI\n';
        tableSection += '- P-values for treatment comparisons\n';
        tableSection += '- Extract data from ALL timepoints found in tables (do not limit to specific timepoints)\n';
        tableSection += '\n**SKIP baseline demographics (age, sex, race) unless they are outcome measures.**\n\n';
      }
      
      const prompt = `You are a clinical trial data extraction expert for Network Meta-Analysis (NMA). Extract CLINICAL OUTCOME DATA (efficacy and safety endpoints), NOT baseline demographics.

${picotsContext}

**CRITICAL INSTRUCTIONS:**
1. **SKIP BASELINE CHARACTERISTICS**: Do NOT extract age, sex, weight, height, or other Table 1 demographics
2. **EXTRACT BOTH SINGLE-ARM AND COMPARATIVE DATA**: You MUST extract BOTH types - single-arm data (outcomes by treatment arm) AND comparative data (direct comparisons between arms). Both are equally important for network meta-analysis.
3. **EXTRACT ALL CLINICAL OUTCOMES**: Extract EVERY primary endpoint, ALL secondary endpoints, ALL safety outcomes, ALL adverse events reported in results sections. A typical RCT should yield 20-50+ records. Do NOT extract just 3-5 outcomes - that is insufficient.
4. **EXTRACT ALL TIMEPOINTS**: Include every timepoint reported (weeks, months, years - whatever is in the document). If outcomes reported at Month 6, 12, 18, 24, 30 - extract ALL of them.
5. **PUT NUMBERS IN CORRECT FIELDS**: Do NOT put statistical results in notes - extract them into te, seTE, mean, sd, event fields
6. **CALCULATE TREATMENT EFFECTS**: When HR/OR/RR with 95% CI are reported, ALWAYS calculate te=log(estimate) and seTE=(log(upper)-log(lower))/3.92
7. **CALCULATE STANDARD ERRORS**: When 95% CI reported for mean difference, ALWAYS calculate seTE=(upper-lower)/(2*1.96)
8. **COMPREHENSIVE EXTRACTION**: Scan entire document section thoroughly. Look at EVERY table and EVERY figure caption for outcome data.

**CRITICAL: Return ONLY valid JSON, no other text.**

Extract data in this EXACT format with ALL 23 single-arm fields and ALL 22 comparative fields:
{
  "singleArmData": [
    {
      "study": "Study name from document",
      "treatment": "Treatment arm name",
      "measureName": "Outcome measure name (e.g., 'all-cause mortality', '6-minute walk test', 'KCCQ-OS score')",
      "timePoint": "Time point as stated in document (e.g., '12 weeks', 'Week 24', '30 months', 'Month 18', 'Year 2', 'End of study')",
      "n": <sample size as number>,
      "event": <number of events if dichotomous, or null>,
      "time": <follow-up time if time-to-event, or null>,
      "mean": <mean value if continuous, or null>,
      "sd": <standard deviation if continuous, or null>,
      "te": <treatment effect if available, or null>,
      "seTE": <standard error of TE if available, or null>,
      "notes": "Additional notes",
      "calculationNotes": "Details of any calculations performed (e.g., SD calculated from SE)",
      "condition": "${projectPICOTS.conditionName || 'Extract from document'}",
      "age": "Age criteria (e.g., 'adults', '18-90 years')",
      "severity": "Disease severity criteria",
      "conditionGenotype": "Genotype information if applicable",
      "comorbidities": "Comorbidity information",
      "treatmentExperience": "Prior treatment status",
      "monoAdjunct": "Monotherapy or adjunct therapy (e.g., 'mono', 'mixed')",
      "page": "Page number",
      "table": "Table/Figure identifier",
      "ref": "${fileName}",
      "sensitivity": false,
      "exclude": false,
      "reviewed": false
    }
  ],
  "comparativeData": [
    {
      "study": "Study name",
      "treatment1": "First treatment arm",
      "treatment2": "Second treatment (comparator)",
      "measureName": "Outcome measure",
      "timePoint": "Time point",
      "n1": <sample size treatment 1>,
      "n2": <sample size treatment 2>,
      "te": <treatment effect - log(HR/OR/RR) for ratios, raw difference for continuous>,
      "seTE": <standard error calculated from 95% CI>,
      "notes": "Source data: HR 0.69 (95% CI 0.49-0.98), p=0.04",
      "calculationNotes": "te=log(0.69)=-0.371, seTE=(log(0.98)-log(0.49))/3.92=0.172",
      "condition": "${projectPICOTS.conditionName || 'Extract from document'}",
      "age": "Age criteria",
      "severity": "Disease severity",
      "conditionGenotype": "Genotype information",
      "comorbidities": "Comorbidity information",
      "treatmentExperience": "Prior treatment status",
      "monoAdjunct": "Monotherapy or adjunct",
      "page": "Page number",
      "table": "Table/Figure identifier",
      "ref": "${fileName}",
      "sensitivity": false,
      "exclude": false,
      "reviewed": false
    }
  ],
  "confidence": {
    "overall": <0-1 confidence score>,
    "notes": "Extraction confidence notes"
  },
  "warnings": ["Any warnings or issues", "PICOTS mismatches if applicable"]
}

**CRITICAL EXTRACTION RULES - COMPREHENSIVE OUTCOME EXTRACTION:**

**WHEN TO USE SINGLE-ARM vs COMPARATIVE DATA:**
- **Use SINGLE-ARM** when tables/text report outcomes separately by treatment arm (e.g., "Acoramidis: 12 deaths, Placebo: 18 deaths")
- **Use COMPARATIVE** when tables/text report direct comparisons (e.g., "HR 0.69, 95% CI 0.49-0.98")
- **EXTRACT BOTH** when paper reports both formats - don't choose one over the other!
- Example: A table showing "Deaths: Acoramidis 12/409, Placebo 18/202" → Extract as single-arm data (2 records)
- Example: Text says "Acoramidis reduced mortality vs placebo (HR 0.69, 95% CI 0.49-0.98)" → Extract as comparative data (1 record)
- **BEST PRACTICE**: If you see individual arm results in tables, extract them as single-arm. If you also see HR/RR/OR, extract that as comparative. Both are needed!

1. **WHAT TO EXTRACT - BE EXHAUSTIVE:**
   - **Primary endpoints**: ALL primary outcomes listed in methods/results (e.g., mortality, composite endpoints, win ratios)
   - **Secondary endpoints**: ALL secondary outcomes - typical RCTs have 10-20 secondary endpoints, extract ALL of them:
     * Cardiovascular hospitalizations (frequency, cumulative incidence)
     * All-cause hospitalizations
     * 6-minute walk distance changes
     * NT-proBNP or other biomarker changes
     * Quality of life scores (KCCQ-OS, KCCQ-CSS, EQ-5D)
     * Functional class changes (NYHA)
     * Disease progression markers
   - **Safety outcomes**: Extract EVERY adverse event category reported:
     * Any treatment-emergent adverse events (TEAEs)
     * Serious adverse events (SAEs)
     * Adverse events leading to discontinuation
     * Specific AE categories (infections, cardiac events, renal events, hepatic events)
     * Deaths during treatment
   - **Composite endpoints**: Extract composite AND all individual components separately
   - **Subgroup analyses**: If outcomes reported by genotype, age group, etc., extract all subgroups
   - **Subgroup analyses**: If multiple subgroups reported (e.g., by genotype), extract all

2. **WHAT TO SKIP:**
   - Baseline demographics (age, sex, race, BMI) - NEVER extract these
   - Baseline lab values (unless it's "change from baseline")
   - Enrollment/screening numbers

3. **EXTRACT EVERY TIMEPOINT**: If paper reports outcomes at Week 12, Month 6, Month 12, Month 30 - extract ALL of them, create separate records for each

4. **REQUIRED FIELDS - NEVER NULL**:
   - **Single-arm data**: study, treatment, measureName, timePoint, n are REQUIRED
   - **Comparative data**: study, treatment1, treatment2, measureName, timePoint, n1, n2 are REQUIRED
   - CRITICAL: n1 and n2 MUST be extracted for every comparative data record - look in the text/tables for "n=XXX" or sample size information
   - If sample size truly not reported in document, set n1/n2 to the total randomized numbers and explain in notes: "Sample size for this outcome not reported, using total randomized"
   - If truly missing and cannot infer, explain in notes

5. **DICHOTOMOUS OUTCOMES - Single Arm**:
   - Format: "Deaths: Acoramidis 12/409, Placebo 18/202" or "Acoramidis: 12 events (2.9%), Placebo: 18 events (8.9%)"
   - Extract 2 single-arm records:
     * Record 1: study=..., treatment="Acoramidis", measureName="Death", timePoint=..., n=409, event=12
     * Record 2: study=..., treatment="Placebo", measureName="Death", timePoint=..., n=202, event=18
   - DO NOT put this in notes - put in n and event fields!
   - CRITICAL: When you see "X events in treatment A, Y events in treatment B" this is SINGLE-ARM data, not comparative!

6. **CONTINUOUS OUTCOMES - Single Arm**:
   - Format: "Change in 6MWD: Acoramidis -30.5±95.2m (n=409), Placebo -48.3±102.1m (n=202)"
   - Extract 2 single-arm records:
     * Record 1: treatment="Acoramidis", n=409, mean=-30.5, sd=95.2
     * Record 2: treatment="Placebo", n=202, mean=-48.3, sd=102.1
   - If only SE given: Calculate sd = SE × √n, document in calculationNotes
   - If only 95% CI given: Calculate SE = (upper - lower)/(2×1.96), then sd = SE × √n
   - If data only shown graphically (no numerical values in text/tables): Leave mean/sd as null, explain in notes: "Data shown graphically only, numerical values not reported in text"
   - DO NOT put this in notes - put in mean/sd fields!

6a. **LOOK FOR SUPPLEMENTARY TABLES**: Many papers report detailed numerical data in supplementary appendices or online-only tables. Check tables in the document for exact numbers even if main text only references figures.

7. **HAZARD RATIOS (HR) - Comparative**:
   - Format: "HR 0.69 (95% CI 0.49-0.98)" or "HR=0.73, 95% CI: 0.56 to 0.96, p=0.02"
   - STEP 1: Find sample sizes n1 and n2 (look in table, text, or methods - e.g., "Acoramidis n=409, Placebo n=202")
   - STEP 2: te = ln(HR) = ln(0.69) = -0.371
   - STEP 3: seTE = (ln(upper) - ln(lower)) / 3.92 = (ln(0.98) - ln(0.49)) / 3.92 = 0.172
   - STEP 4: Extract as comparative data: treatment1="Acoramidis", treatment2="Placebo", n1=409, n2=202, te=-0.371, seTE=0.172
   - STEP 5: Document in notes: "HR 0.69 (95% CI 0.49-0.98)"
   - STEP 6: Document in calculationNotes: "te=ln(HR), seTE calculated from 95% CI using formula (ln(upper)-ln(lower))/3.92"
   - CRITICAL: DO NOT leave n1/n2 null - always find the sample sizes!

8. **ODDS RATIOS (OR) / RISK RATIOS (RR) - Comparative**:
   - Same as HR: Find n1/n2, calculate te = ln(OR), seTE = (ln(upper) - ln(lower)) / 3.92
   - Document calculation in calculationNotes

9. **MEAN DIFFERENCES - Comparative**:
   - Format: "Mean difference: -12.3 (95% CI: -18.7 to -5.9)" or "Difference: 3.4, 95% CI: 1.2 to 5.6"
   - STEP 1: Find sample sizes n1 and n2 from table/text
   - STEP 2: te = raw difference = -12.3
   - STEP 3: seTE = (upper - lower) / (2 × 1.96) = (-5.9 - (-18.7)) / 3.92 = 3.26
   - STEP 4: Extract with n1, n2, te, seTE all populated
   - STEP 5: Document in notes: "Mean difference -12.3 (95% CI -18.7 to -5.9)"
   - STEP 4: Document in calculationNotes: "seTE calculated from 95% CI using (upper-lower)/(2×1.96)"
   - DO NOT leave te/seTE null - CALCULATE THEM!

10. **P-VALUES WITHOUT CIs**:
   - If only p-value given (e.g., "HR 0.69, p=0.04") without CI:
   - Extract te = ln(0.69)
   - Leave seTE = null
   - Document in calculationNotes: "seTE could not be calculated - no CI reported, only p-value"

11. **WIN RATIOS**:
   - Format: "Win ratio: 1.8 (95% CI: 1.4 to 2.2)" or "Win ratio 1.64 (95% CI 1.27-2.14)"
   - STEP 1: Find sample sizes n1 and n2 (look nearby in text/table - often reported in same section)
   - STEP 2: te = ln(1.8) = 0.5878
   - STEP 3: seTE = (ln(2.2) - ln(1.4)) / 3.92 = 0.1012
   - STEP 4: Extract as COMPARATIVE data with n1, n2, te, seTE all populated
   - STEP 5: Document calculation in calculationNotes: "te=ln(1.8)=0.5878; seTE=(ln(2.2)-ln(1.4))/3.92=0.1012"
   - STEP 6: notes field can include original text: "Win ratio 1.8 (95% CI 1.4-2.2), p<0.001"
   - CRITICAL: Do NOT leave n1/n2 as null - search the document section for sample sizes!
   - STEP 3: Extract as COMPARATIVE data with these calculated values in te/seTE fields
   - STEP 4: Document calculation in calculationNotes: "te=ln(1.8)=0.5878; seTE=(ln(2.2)-ln(1.4))/3.92=0.1012"
   - STEP 5: notes field can include original text: "Win ratio 1.8 (95% CI 1.4-2.2), p<0.001"
   - CRITICAL: Do NOT leave te/seTE as null - ALWAYS calculate them when CI is provided!

12. **COMPREHENSIVE EXTRACTION**:
   - Read the ENTIRE document section carefully
   - Check main results tables, supplementary tables, figures, and appendices
   - Extract EVERY outcome reported - don't cherry-pick
   - If a table has 15 rows of outcomes, extract all 15

13. **SOURCE DOCUMENTATION**:
   - page: Page number where data found
   - table: Table/Figure number (e.g., "Table 2", "Figure 3", "Supplementary Table S4")
   - ref: Filename (already provided)

14. **CALCULATION TRANSPARENCY**:
   - calculationNotes: REQUIRED when you perform ANY calculation (te from HR, seTE from CI, sd from SE)
   - Example: "te=ln(0.69)=-0.371; seTE=(ln(0.98)-ln(0.49))/3.92=0.172"

15. **NULL VALUES**:
   - Only acceptable if data truly not in document
   - MUST explain in notes/calculationNotes why null
   - Example: "HR reported without confidence interval, cannot calculate seTE"

**FINAL REMINDER - WHERE TO PUT THE NUMBERS:**
- Win ratios, hazard ratios, odds ratios, risk ratios with CIs → Find n1/n2, calculate te and seTE, put ALL in proper fields (n1, n2, te, seTE)
- Mean differences with CIs → Find n1/n2, calculate te and seTE, put ALL in proper fields (n1, n2, te, seTE)
- Event counts by arm → Put in n and event fields (NOT in notes!)
- Means and SDs by arm → Put in mean and sd fields (NOT in notes!)
- CRITICAL: For comparative data, n1 and n2 are REQUIRED fields - search the document for sample sizes and extract them!
- Notes field is for context (p-values, original text), not for the primary numerical data

${tableSection}

**Document Section ${chunkIndex + 1} of ${chunks.length}:**
${chunk}

Extract all relevant clinical trial data from this section. Use the structured table data above for accurate numerical values. Return ONLY the JSON object.`;

    console.log(`🔄 Sending chunk ${chunkIndex + 1}/${chunks.length} to GPT-4 (with ${tables.length} tables)...`);
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical trial data extraction expert for Network Meta-Analysis. EXTRACT COMPREHENSIVELY - a typical RCT paper should yield 20-50+ outcome records (multiple endpoints × multiple timepoints × 2 arms). CRITICAL RULES: (1) Extract ALL clinical outcomes - primary endpoints, ALL secondary endpoints, ALL safety outcomes, ALL adverse events. Do NOT skip any. (2) Extract BOTH single-arm AND comparative data when available. (3) CALCULATE treatment effects: te=ln(HR/OR/RR), seTE=(ln(upper)-ln(lower))/3.92. (4) SAMPLE SIZES REQUIRED: n1/n2 MUST be extracted for comparative data. (5) Put numbers in CORRECT FIELDS: n1/n2/te/seTE for comparative, mean/sd for continuous, n/event for dichotomous. (6) Extract from ALL timepoints reported. (7) SKIP baseline demographics. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 16384, // Dramatically increased to allow comprehensive extraction
      response_format: { type: 'json_object' },
    });

      const responseText = completion.choices[0].message.content;
      console.log(`✅ Received GPT-4 response for chunk ${chunkIndex + 1}`);
      console.log(`📊 Response length: ${responseText.length} characters`);
      console.log(`📊 Completion reason: ${completion.choices[0].finish_reason}`);
      
      // Log raw response for debugging
      console.log(`📄 RAW GPT-4 RESPONSE:\n${responseText}\n`);
      
      // Parse the JSON response
      const extractedData = JSON.parse(responseText);
      
      console.log(`✅ Chunk ${chunkIndex + 1}: Extracted ${extractedData.singleArmData?.length || 0} single-arm, ${extractedData.comparativeData?.length || 0} comparative records`);
      
      // Log extracted records in detail
      if (extractedData.singleArmData && extractedData.singleArmData.length > 0) {
        console.log(`📊 SINGLE-ARM DATA FROM CHUNK ${chunkIndex + 1}:`);
        extractedData.singleArmData.forEach((record, idx) => {
          console.log(`  [${idx + 1}] ${record.treatment} - ${record.measureName} @ ${record.timePoint}: n=${record.n}, mean=${record.mean}, sd=${record.sd}, event=${record.event}`);
        });
      }
      
      if (extractedData.comparativeData && extractedData.comparativeData.length > 0) {
        console.log(`📊 COMPARATIVE DATA FROM CHUNK ${chunkIndex + 1}:`);
        extractedData.comparativeData.forEach((record, idx) => {
          console.log(`  [${idx + 1}] ${record.treatment1} vs ${record.treatment2} - ${record.measureName}: te=${record.te}, seTE=${record.seTE}`);
        });
      }
      
      // Collect data from this chunk
      if (extractedData.singleArmData) {
        allSingleArmData = allSingleArmData.concat(extractedData.singleArmData);
      }
      if (extractedData.comparativeData) {
        allComparativeData = allComparativeData.concat(extractedData.comparativeData);
      }
      if (extractedData.warnings) {
        allWarnings = allWarnings.concat(extractedData.warnings);
      }
    } // End chunk loop
    
    console.log(`📊 TOTAL EXTRACTED: ${allSingleArmData.length} single-arm, ${allComparativeData.length} comparative records`);
    
    // Transform to our exact schema format
    const singleArmData = allSingleArmData.map((item, idx) => ({
      id: `sa-${Date.now()}-${idx}`,
      study: item.study || fileName.replace(/\.[^/.]+$/, ''),
      treatment: item.treatment || '',
      measureName: item.measureName || '',
      timePoint: item.timePoint || '',
      n: item.n || null,
      event: item.event || null,
      time: item.time || null,
      mean: item.mean || null,
      sd: item.sd || null,
      te: item.te || null,
      seTE: item.seTE || null,
      page: item.page || '',
      table: item.table || '',
      ref: fileName,
      condition: item.condition || projectPICOTS.conditionName || '',
      age: item.age || '',
      severity: item.severity || '',
      conditionGenotype: item.conditionGenotype || '',
      comorbidities: item.comorbidities || '',
      treatmentExperience: item.treatmentExperience || '',
      monoAdjunct: item.monoAdjunct || '',
      sensitivity: false,
      exclude: false,
      reviewed: false,
      notes: item.notes || '',
      calculationNotes: item.calculationNotes || '',
    }));

    const comparativeData = allComparativeData.map((item, idx) => ({
      id: `comp-${Date.now()}-${idx}`,
      study: item.study || fileName.replace(/\.[^/.]+$/, ''),
      treatment1: item.treatment1 || '',
      treatment2: item.treatment2 || '',
      measureName: item.measureName || '',
      timePoint: item.timePoint || '',
      n1: item.n1 || null,
      n2: item.n2 || null,
      te: item.te || null,
      seTE: item.seTE || null,
      page: item.page || '',
      table: item.table || '',
      ref: fileName,
      condition: item.condition || projectPICOTS.conditionName || '',
      age: item.age || '',
      severity: item.severity || '',
      conditionGenotype: item.conditionGenotype || '',
      comorbidities: item.comorbidities || '',
      treatmentExperience: item.treatmentExperience || '',
      monoAdjunct: item.monoAdjunct || '',
      sensitivity: false,
      exclude: false,
      reviewed: false,
      notes: item.notes || '',
      calculationNotes: item.calculationNotes || '',
    }));

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✅ FINAL RESULTS: ${singleArmData.length} single-arm records, ${comparativeData.length} comparative records`);
    console.log(`═══════════════════════════════════════════════════\n`);
    
    if (singleArmData.length > 0) {
      console.log(`📊 FINAL SINGLE-ARM DATA:`);
      singleArmData.forEach((record, idx) => {
        console.log(`  [${idx + 1}] ${record.treatment} - ${record.measureName} @ ${record.timePoint}`);
        console.log(`      n=${record.n}, mean=${record.mean}, sd=${record.sd}, event=${record.event}`);
        console.log(`      page=${record.page}, table=${record.table}`);
      });
    }
    
    if (comparativeData.length > 0) {
      console.log(`\n📊 FINAL COMPARATIVE DATA:`);
      comparativeData.forEach((record, idx) => {
        console.log(`  [${idx + 1}] ${record.treatment1} vs ${record.treatment2} - ${record.measureName}`);
        console.log(`      te=${record.te}, seTE=${record.seTE}, n1=${record.n1}, n2=${record.n2}`);
        console.log(`      page=${record.page}, table=${record.table}`);
      });
    }
    
    console.log(`\n═══════════════════════════════════════════════════\n`);

    return {
      singleArmData,
      comparativeData,
      aiConfidence: {
        overall: 0.85,
        notes: `Extracted from ${chunks.length} document section(s)`,
      },
      warnings: allWarnings,
    };

  } catch (error) {
    console.error('❌ AI extraction failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}
