#!/usr/bin/env python3
"""
Extract tables from PDF files using pdfplumber.
Returns structured table data as JSON.
"""
import sys
import json
import pdfplumber

def extract_tables_from_pdf(pdf_path):
    """Extract all tables from a PDF file."""
    tables_data = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract tables from this page
                tables = page.extract_tables()
                
                for table_num, table in enumerate(tables, start=1):
                    if table and len(table) > 0:
                        # Convert table to structured format
                        headers = table[0] if table else []
                        rows = table[1:] if len(table) > 1 else []
                        
                        table_data = {
                            'page': page_num,
                            'table_number': table_num,
                            'headers': headers,
                            'rows': rows,
                            'raw_data': table
                        }
                        tables_data.append(table_data)
        
        return {
            'success': True,
            'tables': tables_data,
            'table_count': len(tables_data)
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'tables': []
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No PDF path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_tables_from_pdf(pdf_path)
    print(json.dumps(result, indent=2))
