// Test pdf-parse import
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

console.log('Testing pdf-parse import...');
const pdfParseModule = require('pdf-parse');
console.log('Has PDFParse:', !!pdfParseModule.PDFParse);
console.log('PDFParse type:', typeof pdfParseModule.PDFParse);

const pdfParse = pdfParseModule.PDFParse || pdfParseModule;
console.log('Final pdfParse type:', typeof pdfParse);

// Test with a real PDF
try {
  const files = fs.readdirSync('uploads');
  if (files.length > 0) {
    const pdfFile = files.find(f => f.endsWith('.pdf'));
    if (pdfFile) {
      console.log('\\nTesting with:', pdfFile);
      const buffer = fs.readFileSync(`uploads/${pdfFile}`);
      const parser = new pdfParse();
      parser.parseBuffer(buffer).then(data => {
        console.log('SUCCESS! Extracted', data.text.length, 'characters');
        console.log('First 200 chars:', data.text.substring(0, 200));
      }).catch(err => {
        console.error('PDF parse error:', err.message);
      });
    }
  }
} catch (e) {
  console.log('Could not test with real PDF:', e.message);
}
