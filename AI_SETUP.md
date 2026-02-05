# Real AI Extraction Setup Guide

## ✅ What's Installed

Your app now has **real AI extraction** using OpenAI GPT-4:

- ✅ **OpenAI SDK** - Connects to GPT-4 API
- ✅ **PDF Parser** - Extracts text from PDF documents  
- ✅ **AI Extraction Service** - Sends document text to GPT-4 with structured prompts
- ✅ **Automatic Schema Mapping** - Converts AI response to your exact 23-field single-arm and 22-field comparative format

## 🔑 Getting Your OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

## ⚙️ Configuration

Open `server/.env` and replace this line:
```
OPENAI_API_KEY=your-openai-api-key-here
```

With your actual key:
```
OPENAI_API_KEY=sk-proj-abc123...
```

**Save the file** - the server will automatically restart.

## 🚀 How It Works

1. **Upload PDF** → Document is saved to `server/uploads/`
2. **Extract Text** → PDF parser extracts all text content
3. **Send to GPT-4** → Text is sent with detailed extraction prompt:
   - Extract all outcome data
   - Identify treatment arms
   - Find sample sizes, events, means, SDs
   - Calculate treatment effects (log scale)
   - Calculate standard errors from confidence intervals
   - Include page and table references
4. **Parse Response** → AI returns structured JSON
5. **Map to Schema** → Converts to your exact 23/22 field format
6. **Save to Database** → Stored in `server/data/extractions.json`

## 📊 What Gets Extracted

**Single-Arm Data (23 fields):**
- Study name, treatment, outcome measure, time point
- Sample size (n), events, mean, SD
- PICOTS fields (condition, age, severity, etc.)
- Source tracking (page, table, ref)
- Quality flags (sensitivity, exclude, reviewed)

**Comparative Data (22 fields):**
- Treatment 1 vs Treatment 2
- Sample sizes (n1, n2)
- Treatment effect (te) - log scale for ratios
- Standard error (seTE)
- Same PICOTS, source, and quality fields

## 💰 Costs

OpenAI GPT-4 Turbo pricing (as of Feb 2026):
- **Input**: ~$10 per 1M tokens
- **Output**: ~$30 per 1M tokens

Typical costs per extraction:
- Small paper (10 pages): ~$0.10-0.20
- Large paper (50 pages): ~$0.50-1.00

## 🔄 Fallback Behavior

If the AI key is not configured or API fails:
- App automatically uses **mock data**
- Warning message shown in extraction results
- You can still test the full workflow

## 🧪 Testing

1. **Without API key**: Uses mock data (works immediately)
2. **With API key**: Real extraction from your PDF

Upload a clinical trial PDF and watch the extraction happen in real-time!

## 🐛 Troubleshooting

**Server won't start:**
- Check `.env` file syntax (no spaces around `=`)
- Make sure key starts with `sk-`

**Extraction returns mock data:**
- Check server console for "⚠️ No OPENAI_API_KEY found"
- Verify `.env` has `OPENAI_API_KEY=sk-...`
- Restart server: `npm run dev`

**PDF parsing fails:**
- Only PDF files currently supported (Word doc support coming)
- Check file isn't password-protected
- Try another PDF if file is corrupted

**AI extraction is slow:**
- Large PDFs take 10-30 seconds
- GPT-4 processes ~2000 tokens/second
- Shows "processing" status during extraction

## 📝 Example Output

When extraction completes, you'll see in server console:
```
📄 File uploaded: Smith2023_RCT.pdf
💾 Saved to: server/uploads/1738704567890-xyz-Smith2023_RCT.pdf
🤖 Starting REAL AI extraction...
📄 Extracted 45234 characters from PDF
🔄 Sending to GPT-4...
✅ Received GPT-4 response
✅ AI Extraction completed: extraction-1738704567890-xyz
   - 8 single-arm records
   - 4 comparative records
   - Confidence: 87.5%
```

## 🎯 Next Steps

1. Add your OpenAI API key to `.env`
2. Restart the server (it auto-restarts when you save `.env`)
3. Upload a clinical trial PDF
4. Watch real AI extraction in action!

Your extractions will follow the exact 23/22 field schema you specified, ready for Network Meta-Analysis in R or Stata.
