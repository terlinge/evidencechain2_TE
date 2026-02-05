# Error Handling & Recovery Patterns

## Overview
Comprehensive error handling strategies for EvidenceChain's 7-stage extraction pipeline, API failures, and user-facing errors.

## Extraction Pipeline Error Taxonomy

### Stage-Specific Failures

#### 1. Document Upload Errors

**Common Issues:**
- File size exceeds 50MB limit
- Invalid file type (not PDF/Word/text)
- Corrupted file
- Network timeout during upload

**Handling Pattern:**
```typescript
// components/extraction/DocumentUpload.tsx
async function handleUpload(file: File) {
  try {
    // Pre-upload validation
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `${file.name} exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB). Try compressing the PDF or splitting into multiple files.`,
        variant: "destructive",
        action: <ToastAction altText="Learn more">Compression Guide</ToastAction>
      });
      return;
    }
    
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: `${file.name} is not a supported format. Please upload PDF or Word documents.`,
        variant: "destructive"
      });
      return;
    }
    
    // Upload with progress tracking
    const result = await uploadDocument(file, (progress) => {
      setUploadProgress(progress);
    });
    
    setUploadedFile(result);
    
  } catch (error) {
    if (error.code === 'NETWORK_ERROR') {
      toast({
        title: "Upload Failed",
        description: "Network connection lost. Please check your internet and try again.",
        variant: "destructive",
        action: <ToastAction altText="Retry" onClick={() => handleUpload(file)}>Retry</ToastAction>
      });
    } else if (error.code === 'FILE_CORRUPTED') {
      toast({
        title: "Corrupted File",
        description: `Unable to read ${file.name}. The file may be corrupted. Try re-downloading from the source.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Upload Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  }
}
```

#### 2. OCR/PDF Extraction Errors

**Common Issues:**
- OCR service timeout (large scanned PDFs)
- Poor image quality → low confidence
- Non-English text (if OCR not configured for it)
- Protected/encrypted PDFs

**Handling Pattern:**
```typescript
// server/services/ocrService.ts
export async function extractTextWithOCR(filePath: string): Promise<OCRResult> {
  try {
    // Try primary OCR service (Tesseract)
    const result = await tesseract.recognize(filePath, {
      timeout: 300000,  // 5 min timeout
      lang: 'eng'
    });
    
    if (result.confidence < 0.6) {
      // Low confidence - try alternative OCR
      console.warn(`Low OCR confidence (${result.confidence}), trying Google Vision`);
      return await fallbackToGoogleVision(filePath);
    }
    
    return result;
    
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      throw new ExtractionError(
        'OCR_TIMEOUT',
        'Document OCR timed out after 5 minutes. Try splitting into smaller files or using native PDF.',
        { filePath, stage: 'OCR' }
      );
    } else if (error.code === 'UNSUPPORTED_LANGUAGE') {
      throw new ExtractionError(
        'OCR_LANGUAGE',
        'Document language not supported. Currently only English is supported.',
        { filePath, stage: 'OCR' }
      );
    } else if (error.code === 'ENCRYPTED_PDF') {
      throw new ExtractionError(
        'PDF_ENCRYPTED',
        'PDF is password-protected. Please unlock and re-upload.',
        { filePath, stage: 'OCR' }
      );
    } else {
      // Log full error for debugging
      logger.error('OCR extraction failed', { error, filePath });
      throw new ExtractionError(
        'OCR_FAILED',
        'Text extraction failed. Please try uploading a different version of the document.',
        { filePath, stage: 'OCR', originalError: error.message }
      );
    }
  }
}
```

#### 3. AI/LLM Processing Errors

**Common Issues:**
- API rate limits (OpenAI/Anthropic)
- Token limit exceeded (very large documents)
- Model hallucination → invalid data
- API key invalid/expired

**Handling Pattern:**
```typescript
// server/services/llmService.ts
export async function extractWithLLM(
  documentText: string,
  picots: EnhancedPICOTS
): Promise<AIExtractionResult> {
  
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Check token count
      const tokens = countTokens(documentText);
      if (tokens > 100000) {
        // Chunk document
        const chunks = chunkDocument(documentText, 80000);
        const results = await Promise.all(
          chunks.map(chunk => extractChunkWithLLM(chunk, picots))
        );
        return mergeChunkResults(results);
      }
      
      // Call LLM API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: getExtractionPrompt(picots) },
          { role: 'user', content: documentText }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,  // Low temp for consistency
        timeout: 120000  // 2 min timeout
      });
      
      // Validate response structure
      const extracted = JSON.parse(response.choices[0].message.content);
      validateExtractionSchema(extracted);
      
      return extracted;
      
    } catch (error) {
      attempt++;
      
      if (error.code === 'rate_limit_exceeded') {
        const waitTime = Math.pow(2, attempt) * 1000;  // Exponential backoff
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }
      
      if (error.code === 'context_length_exceeded') {
        throw new ExtractionError(
          'DOCUMENT_TOO_LARGE',
          'Document exceeds AI processing limits. Try splitting into smaller sections.',
          { stage: 'AI', tokens: countTokens(documentText) }
        );
      }
      
      if (error.code === 'invalid_api_key') {
        throw new ExtractionError(
          'AI_CONFIG_ERROR',
          'AI service configuration error. Please contact administrator.',
          { stage: 'AI', isConfigIssue: true }
        );
      }
      
      if (error instanceof SyntaxError) {
        // LLM returned invalid JSON
        logger.error('LLM returned invalid JSON', { error, response: error.message });
        throw new ExtractionError(
          'AI_INVALID_RESPONSE',
          'AI extraction produced invalid output. Try re-uploading or using manual extraction.',
          { stage: 'AI' }
        );
      }
      
      if (attempt === maxRetries) {
        throw new ExtractionError(
          'AI_EXTRACTION_FAILED',
          `AI extraction failed after ${maxRetries} attempts. Please try again later.`,
          { stage: 'AI', attempts: maxRetries }
        );
      }
    }
  }
}
```

#### 4. Validation Errors

**Common Issues:**
- Extracted data missing required fields
- Data type mismatches (text in numeric field)
- PICOTS mismatch (wrong study)
- Implausible values (negative sample size)

**Handling Pattern:**
```typescript
// server/services/validationService.ts
export function validateExtraction(
  extraction: AIExtractionResult
): ValidationResult {
  
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Required field validation
  extraction.singleArmData.forEach((row, index) => {
    if (!row.study || !row.treatment || !row.measureName) {
      errors.push({
        row: index + 1,
        type: 'MISSING_REQUIRED_FIELD',
        message: `Row ${index + 1}: Missing required field (study, treatment, or measureName)`,
        severity: 'error',
        field: 'multiple'
      });
    }
    
    // Numeric field validation
    if (row.n !== undefined && (isNaN(row.n) || row.n <= 0)) {
      errors.push({
        row: index + 1,
        type: 'INVALID_VALUE',
        message: `Row ${index + 1}: Sample size (n) must be positive number, got: ${row.n}`,
        severity: 'error',
        field: 'n'
      });
    }
    
    // Statistical validation
    if (row.mean !== undefined && row.sd !== undefined) {
      if (row.sd < 0) {
        errors.push({
          row: index + 1,
          type: 'INVALID_VALUE',
          message: `Row ${index + 1}: Standard deviation cannot be negative`,
          severity: 'error',
          field: 'sd'
        });
      }
      
      // Check for implausible coefficient of variation
      const cv = Math.abs(row.sd / row.mean);
      if (cv > 2) {
        warnings.push({
          row: index + 1,
          type: 'IMPLAUSIBLE_VALUE',
          message: `Row ${index + 1}: Very high variability (CV=${cv.toFixed(2)}). Please verify SD value.`,
          severity: 'warning',
          field: 'sd'
        });
      }
    }
    
    // Treatment effect validation
    if (row.te !== undefined && row.seTE !== undefined) {
      if (row.seTE <= 0) {
        errors.push({
          row: index + 1,
          type: 'INVALID_VALUE',
          message: `Row ${index + 1}: Standard error (seTE) must be positive`,
          severity: 'error',
          field: 'seTE'
        });
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    canProceedWithWarnings: errors.length === 0 && warnings.length > 0
  };
}
```

## API Error Handling

### Centralized Error Interceptor

```typescript
// client/src/api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, request, message } = error;
    
    // Network errors (no response)
    if (!response) {
      if (request) {
        // Request made but no response
        toast({
          title: "Connection Error",
          description: "Unable to reach server. Please check your internet connection.",
          variant: "destructive"
        });
      } else {
        // Request setup failed
        console.error('Request setup error:', message);
      }
      return Promise.reject(new APIError('NETWORK_ERROR', 'Network connection failed', error));
    }
    
    // HTTP error responses
    const { status, data } = response;
    
    switch (status) {
      case 400:
        // Bad request - validation error
        return Promise.reject(new APIError('VALIDATION_ERROR', data.message || 'Invalid request', data.errors));
        
      case 401:
        // Unauthorized - redirect to login
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive"
        });
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(new APIError('UNAUTHORIZED', 'Session expired'));
        
      case 403:
        // Forbidden - insufficient permissions
        toast({
          title: "Access Denied",
          description: "You don't have permission to perform this action.",
          variant: "destructive"
        });
        return Promise.reject(new APIError('FORBIDDEN', 'Insufficient permissions'));
        
      case 404:
        // Not found
        return Promise.reject(new APIError('NOT_FOUND', data.message || 'Resource not found'));
        
      case 409:
        // Conflict - resource already exists
        return Promise.reject(new APIError('CONFLICT', data.message || 'Resource already exists'));
        
      case 429:
        // Rate limit exceeded
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please wait a moment and try again.",
          variant: "destructive"
        });
        return Promise.reject(new APIError('RATE_LIMIT', 'Rate limit exceeded'));
        
      case 500:
      case 502:
      case 503:
        // Server errors
        toast({
          title: "Server Error",
          description: "An unexpected error occurred. Please try again later.",
          variant: "destructive",
          action: <ToastAction altText="Report issue">Report Issue</ToastAction>
        });
        return Promise.reject(new APIError('SERVER_ERROR', data.message || 'Internal server error'));
        
      default:
        return Promise.reject(new APIError('UNKNOWN_ERROR', `HTTP ${status}: ${data.message || 'Unknown error'}`));
    }
  }
);

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export default api;
```

### Component-Level Error Handling

```typescript
// pages/DataExtraction.tsx
export function DataExtraction() {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  async function handleExtraction(file: File) {
    setError(null);
    
    try {
      const result = await extractDocument(projectId, studyId, file);
      setExtractionResult(result);
      
    } catch (error) {
      if (error instanceof APIError) {
        switch (error.code) {
          case 'VALIDATION_ERROR':
            // Show specific validation errors
            setError(`Validation failed: ${error.details.join(', ')}`);
            break;
            
          case 'OCR_TIMEOUT':
            // Offer alternative solutions
            setError(
              'Document processing timed out. This usually happens with large scanned PDFs. ' +
              'Try: (1) Splitting into smaller files, (2) Using a native PDF instead of scanned, ' +
              'or (3) Reducing image resolution.'
            );
            break;
            
          case 'DOCUMENT_TOO_LARGE':
            setError(
              `Document exceeds size limits (${error.details.tokens} tokens). ` +
              'Please split into smaller sections or extract tables manually.'
            );
            break;
            
          case 'NETWORK_ERROR':
            // Offer retry
            if (retryCount < 3) {
              toast({
                title: "Connection Lost",
                description: "Attempting to reconnect...",
                action: <ToastAction altText="Retry now" onClick={() => {
                  setRetryCount(retryCount + 1);
                  handleExtraction(file);
                }}>Retry Now</ToastAction>
              });
            } else {
              setError('Unable to connect after multiple attempts. Please check your internet and try again later.');
            }
            break;
            
          default:
            setError(error.message);
        }
      } else {
        // Unexpected error
        console.error('Unexpected extraction error:', error);
        setError('An unexpected error occurred. Please try again or contact support.');
      }
    }
  }
  
  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Extraction Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* ... rest of component */}
    </div>
  );
}
```

## User Feedback Patterns

### Loading States

```typescript
// Show stage-specific progress
interface ExtractionProgress {
  stage: 'upload' | 'analysis' | 'ocr' | 'table' | 'ai' | 'validation' | 'complete';
  percent: number;
  message: string;
}

<Card>
  <CardHeader>
    <CardTitle>Processing Document</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <Progress value={progress.percent} />
      <p className="text-sm text-muted-foreground">{progress.message}</p>
      
      <div className="text-xs space-y-1">
        {stages.map(stage => (
          <div key={stage.name} className="flex items-center gap-2">
            {progress.stage === stage.name ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : stage.complete ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <Circle className="h-3 w-3 text-gray-300" />
            )}
            <span className={stage.complete ? 'text-green-600' : ''}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  </CardContent>
</Card>
```

### Recovery Actions

```typescript
// Offer specific recovery actions based on error type
function getRecoveryActions(error: APIError): RecoveryAction[] {
  switch (error.code) {
    case 'FILE_TOO_LARGE':
      return [
        { label: 'Compress PDF', action: () => window.open('/guides/pdf-compression') },
        { label: 'Split Document', action: () => setShowSplitGuide(true) },
        { label: 'Manual Extract', action: () => router.push('/manual-extraction') }
      ];
      
    case 'OCR_FAILED':
      return [
        { label: 'Try Different File', action: () => setShowUpload(true) },
        { label: 'Manual Entry', action: () => setMode('manual') },
        { label: 'Contact Support', action: () => window.open('/support') }
      ];
      
    case 'PICOTS_MISMATCH':
      return [
        { label: 'Review PICOTS', action: () => router.push(`/projects/${projectId}/picots`) },
        { label: 'Proceed Anyway', action: () => setIgnorePICOTS(true) },
        { label: 'Upload Different File', action: () => setShowUpload(true) }
      ];
      
    default:
      return [
        { label: 'Retry', action: () => retry() },
        { label: 'Report Issue', action: () => setShowReportDialog(true) }
      ];
  }
}
```

## Logging & Monitoring

### Client-Side Error Logging

```typescript
// utils/errorLogger.ts
export function logError(error: Error, context?: Record<string, any>) {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Error:', error, 'Context:', context);
  }
  
  // Send to monitoring service in production
  if (import.meta.env.PROD) {
    // Example: Sentry, LogRocket, etc.
    window.errorMonitoring?.captureException(error, {
      extra: context
    });
  }
  
  // Store locally for support tickets
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
  logs.push(errorLog);
  // Keep last 50 errors
  if (logs.length > 50) logs.shift();
  localStorage.setItem('errorLogs', JSON.stringify(logs));
}
```

### Server-Side Error Logging

```typescript
// server/middleware/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error with context
  logger.error('API Error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      user: req.user?.id
    }
  });
  
  // Send appropriate response
  if (err instanceof ExtractionError) {
    return res.status(400).json({
      error: err.code,
      message: err.message,
      details: err.details,
      stage: err.details?.stage
    });
  }
  
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: err.message,
      errors: err.errors
    });
  }
  
  // Generic server error
  res.status(500).json({
    error: 'SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
}
```

## Testing Error Scenarios

```typescript
// tests/extraction.test.ts
describe('Extraction Error Handling', () => {
  test('handles file size limit', async () => {
    const largeFile = new File(['x'.repeat(60 * 1024 * 1024)], 'large.pdf');
    
    await expect(uploadDocument(largeFile)).rejects.toThrow('File Too Large');
  });
  
  test('handles OCR timeout gracefully', async () => {
    // Mock OCR service timeout
    jest.spyOn(ocrService, 'recognize').mockRejectedValue(new Error('TIMEOUT'));
    
    const result = await extractDocument(file);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('OCR_TIMEOUT');
  });
  
  test('retries on rate limit', async () => {
    let callCount = 0;
    jest.spyOn(llmService, 'extract').mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('rate_limit_exceeded');
      }
      return mockExtractionResult;
    });
    
    const result = await extractWithRetry(document);
    expect(callCount).toBe(3);
    expect(result).toBeDefined();
  });
});
```

## Key Takeaways

1. **Fail gracefully** - Always provide actionable error messages
2. **Retry intelligently** - Use exponential backoff for transient errors
3. **Validate early** - Catch errors before expensive AI calls
4. **Log everything** - Both client and server errors for debugging
5. **Offer alternatives** - Give users multiple paths forward
6. **Monitor patterns** - Track common errors to improve system
