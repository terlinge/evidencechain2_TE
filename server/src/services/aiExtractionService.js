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
        tableSection = '\n\n**EXTRACTED TABLES (Structured Data):**\n\n';
        tables.forEach((table, idx) => {
          tableSection += `Table ${idx + 1} (Page ${table.page}):\n`;
          tableSection += `Headers: ${JSON.stringify(table.headers)}\n`;
          tableSection += `Data:\n`;
          table.rows.forEach((row, rowIdx) => {
            tableSection += `  Row ${rowIdx + 1}: ${JSON.stringify(row)}\n`;
          });
          tableSection += '\n';
        });
      }
      
      const prompt = `You are a clinical trial data extraction expert for Network Meta-Analysis (NMA). Extract arm-level and contrast-level outcome data from this clinical trial document section.
${picotsContext}

**CRITICAL: Return ONLY valid JSON, no other text.**

Extract data in this EXACT format with ALL 23 single-arm fields and ALL 22 comparative fields:
{
  "singleArmData": [
    {
      "study": "Study name from document",
      "treatment": "Treatment arm name",
      "measureName": "Outcome measure name (e.g., 'all-cause mortality', '6-minute walk test')",
      "timePoint": "Time point (e.g., '12 weeks', '30 months')",
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
      "te": <treatment effect in log scale for ratios>,
      "seTE": <standard error of treatment effect>,
      "notes": "Additional notes (e.g., HR: 0.69, 95% CI: 0.49-0.98)",
      "calculationNotes": "Calculation details (e.g., TE converted to log scale)",
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

**IMPORTANT EXTRACTION RULES:**
1. **Extract EVERYTHING by default**: All primary outcomes, secondary outcomes, AEs, SAEs
2. **Multiple outcomes = multiple rows**: One row per outcome per treatment per timepoint
3. **All treatment arms**: Include placebo, active comparators, different doses
4. **Page/table tracking**: Critical for verification - always include source location
5. **Effect measures**: For comparativeData, calculate treatment effects when possible
6. For dichotomous outcomes: Extract n (sample size) and event (number of events)
7. For continuous outcomes: Extract n, mean, and sd
8. For comparative data: Calculate log(HR), log(RR), or log(OR) for te field
9. Calculate standard error (seTE) from 95% CI: seTE ≈ (log(upper) - log(lower)) / 3.92
10. Extract ONLY data explicitly stated in tables/text
11. Include page and table references for every extraction
12. If data is unclear or missing, set to null and add a warning
13. Extract all outcome measures found in the document
14. **PRIORITIZE TABLE DATA**: If structured tables are provided below, extract numerical data from them first

${tableSection}

**Document Section ${chunkIndex + 1} of ${chunks.length}:**
${chunk}

Extract all relevant clinical trial data from this section. Use the structured table data above for accurate numerical values. Return ONLY the JSON object.`;

    console.log(`🔄 Sending chunk ${chunkIndex + 1}/${chunks.length} to GPT-4 (with ${tables.length} tables)...`);
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical trial data extraction expert. Extract structured data from this section and return ONLY valid JSON, no additional text or formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 4096, // GPT-4-turbo max output tokens
      response_format: { type: 'json_object' }, // Force JSON response
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
