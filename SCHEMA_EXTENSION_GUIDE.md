# Safe Schema Extension Patterns

## Core Principle
The 23-field single-arm and 22-field comparative structures are **immutable** for NMA compatibility. However, projects may need additional metadata. This guide shows how to extend safely.

## Extension Pattern 1: Custom Metadata Object

### Implementation
Add a `customFields` object to extraction records without touching core fields:

```typescript
// types/extraction.ts - ADD this interface
export interface CustomExtractionMetadata {
  [key: string]: string | number | boolean | string[];
}

// EXTEND existing interfaces (don't replace)
export interface SingleArmExtraction {
  // ... existing 23 fields ...
  
  // NEW: Optional custom metadata
  customFields?: CustomExtractionMetadata;
}

export interface ComparativeExtraction {
  // ... existing 22 fields ...
  
  // NEW: Optional custom metadata
  customFields?: CustomExtractionMetadata;
}
```

### Usage Example
```typescript
// Project-specific extensions without breaking NMA export
const extraction: SingleArmExtraction = {
  // Standard fields
  id: '1',
  study: 'ATTR-ACT',
  treatment: 'tafamidis',
  measureName: '6-minute walk distance',
  // ... other 19 required fields ...
  
  // Custom project-specific data
  customFields: {
    ethnicity: 'mixed',
    geographicRegion: 'North America',
    fundingSource: 'pharmaceutical',
    registryLink: 'https://clinicaltrials.gov/...',
    additionalNotes: 'Subgroup analysis pending'
  }
};
```

### Export Strategy
```typescript
// exports.ts - Separate custom fields from NMA export
export function exportToCSV(extractions: SingleArmExtraction[]) {
  // Core NMA export - ONLY 23 fields
  const nmaData = extractions.map(e => ({
    id: e.id,
    study: e.study,
    treatment: e.treatment,
    // ... 20 more standard fields
  }));
  
  // Separate custom metadata export
  const customData = extractions
    .filter(e => e.customFields && Object.keys(e.customFields).length > 0)
    .map(e => ({
      extractionId: e.id,
      ...e.customFields
    }));
  
  return {
    nmaExport: convertToCSV(nmaData),
    customExport: customData.length > 0 ? convertToCSV(customData) : null
  };
}
```

## Extension Pattern 2: Linked Annotations

### Implementation
Create separate annotation records that reference extractions:

```typescript
// types/annotation.ts - NEW file
export interface ExtractionAnnotation {
  id: string;
  extractionId: string;  // FK to extraction
  annotationType: 'quality-flag' | 'clarification' | 'assumption' | 'calculation-detail';
  content: string;
  createdBy: string;
  createdAt: Date;
  resolvedAt?: Date;
  tags: string[];
}

// Database schema
{
  _id: ObjectId,
  extractionId: ObjectId (ref: 'Extraction'),
  projectId: ObjectId (ref: 'Project'),
  annotationType: String,
  content: String,
  createdBy: ObjectId (ref: 'User'),
  createdAt: Date,
  resolvedAt: Date,
  tags: [String]
}
```

### Usage Example
```typescript
// Add quality flags without modifying extraction
const annotation: ExtractionAnnotation = {
  id: 'ann-1',
  extractionId: 'sa-1',
  annotationType: 'quality-flag',
  content: 'SD calculated from reported SE, not directly stated in paper',
  createdBy: 'user-123',
  createdAt: new Date(),
  tags: ['calculation', 'imputed-value']
};

// Query with annotations
const extractionWithAnnotations = {
  ...extraction,
  annotations: await getAnnotations(extraction.id)
};
```

## Extension Pattern 3: Project-Level Custom Schema

### Implementation
Allow projects to define custom field schemas:

```typescript
// types/picots.ts - ADD to EnhancedPICOTS
export interface EnhancedPICOTS {
  // ... existing fields ...
  
  // NEW: Project-specific extraction fields
  customExtractionFields?: Array<{
    fieldName: string;
    fieldType: 'text' | 'number' | 'select' | 'multi-select' | 'date';
    required: boolean;
    options?: string[];  // For select fields
    description: string;
    category: 'population' | 'intervention' | 'outcome' | 'quality' | 'other';
  }>;
}

// Example usage
const projectWithCustomFields: EnhancedPICOTS = {
  conditionName: 'ATTR Amyloidosis',
  // ... other PICOTS ...
  
  customExtractionFields: [
    {
      fieldName: 'biomarkerLevel',
      fieldType: 'number',
      required: false,
      description: 'Baseline NT-proBNP level (pg/mL)',
      category: 'population'
    },
    {
      fieldName: 'priorTherapy',
      fieldType: 'multi-select',
      required: true,
      options: ['TTR stabilizer', 'Gene silencer', 'None'],
      description: 'Prior amyloidosis treatments',
      category: 'population'
    }
  ]
};
```

### Form Generation
```typescript
// components/extraction/CustomFieldsSection.tsx
export function CustomFieldsSection({ 
  projectCustomFields, 
  data, 
  onChange 
}: CustomFieldsSectionProps) {
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project-Specific Fields</CardTitle>
      </CardHeader>
      <CardContent>
        {projectCustomFields.map(field => (
          <div key={field.fieldName} className="space-y-2">
            <Label>
              {field.description}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            
            {field.fieldType === 'text' && (
              <Input
                value={data.customFields?.[field.fieldName] || ''}
                onChange={e => onChange({
                  ...data,
                  customFields: {
                    ...data.customFields,
                    [field.fieldName]: e.target.value
                  }
                })}
              />
            )}
            
            {field.fieldType === 'select' && (
              <Select
                value={data.customFields?.[field.fieldName] as string}
                onValueChange={v => onChange({
                  ...data,
                  customFields: {
                    ...data.customFields,
                    [field.fieldName]: v
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Add other field type renderers */}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

## Version Migration Strategies

### Schema Version Tracking

```typescript
// types/extraction.ts
export interface ExtractionSchemaVersion {
  version: string;
  createdAt: Date;
  changes: string[];
}

export interface SingleArmExtraction {
  // Core fields...
  
  // Metadata
  schemaVersion?: string;  // e.g., "1.0", "1.1"
  customFields?: CustomExtractionMetadata;
}
```

### Migration Functions

```typescript
// migrations/extractionMigrations.ts

export const migrations = {
  '1.0-to-1.1': (extraction: any): SingleArmExtraction => {
    // Example: Move deprecated field to customFields
    return {
      ...extraction,
      schemaVersion: '1.1',
      customFields: {
        ...extraction.customFields,
        // Migrate old field if present
        oldFieldName: extraction.deprecatedField || ''
      }
    };
  },
  
  '1.1-to-1.2': (extraction: any): SingleArmExtraction => {
    // Another migration
    return {
      ...extraction,
      schemaVersion: '1.2'
    };
  }
};

export function migrateExtraction(
  extraction: any,
  targetVersion: string = '1.2'
): SingleArmExtraction {
  
  let current = extraction;
  const currentVersion = extraction.schemaVersion || '1.0';
  
  // Apply migrations in sequence
  if (currentVersion === '1.0' && targetVersion >= '1.1') {
    current = migrations['1.0-to-1.1'](current);
  }
  if (currentVersion <= '1.1' && targetVersion >= '1.2') {
    current = migrations['1.1-to-1.2'](current);
  }
  
  return current;
}
```

### Backward Compatibility

```typescript
// Ensure R exports always work
export function exportToRFormat(extractions: SingleArmExtraction[]): string {
  // Always extract only the core 23 fields for NMA
  const coreFields = [
    'id', 'study', 'treatment', 'measureName', 'timePoint',
    'n', 'event', 'time', 'mean', 'sd', 'te', 'seTE',
    'notes', 'calculationNotes',
    'condition', 'age', 'severity', 'conditionGenotype',
    'comorbidities', 'treatmentExperience', 'monoAdjunct',
    'page', 'table', 'ref'
  ];
  
  const rData = extractions.map(e => {
    const coreOnly: any = {};
    coreFields.forEach(field => {
      coreOnly[field] = e[field as keyof SingleArmExtraction];
    });
    return coreOnly;
  });
  
  return `
# Generated by EvidenceChain v${packageVersion}
# Core NMA data - ${rData.length} extractions
single_arm_data <- data.frame(
  ${Object.keys(rData[0]).map(key => 
    `${key} = c(${rData.map(r => JSON.stringify(r[key])).join(', ')})`
  ).join(',\n  ')}
)
  `;
}
```

## Safe Extension Checklist

When extending extraction schema:

- [ ] ✅ Core 23/22 fields remain **unchanged**
- [ ] ✅ Extensions use `customFields` object or separate tables
- [ ] ✅ R/Stata export functions ignore custom fields
- [ ] ✅ Schema version tracked in extraction records
- [ ] ✅ Migration path documented
- [ ] ✅ Backward compatibility tested
- [ ] ✅ UI components handle missing custom fields gracefully
- [ ] ✅ API validates custom fields separately from core fields
- [ ] ✅ Database indexes updated if needed
- [ ] ✅ Documentation updated in `DATABASE.md`

## Anti-Patterns to Avoid

### ❌ DON'T: Modify Core Fields
```typescript
// WRONG - breaks NMA export
interface SingleArmExtraction {
  id: string;
  study: string;
  treatment: string;
  // Adding new required field breaks existing data
  newRequiredField: string;  // ❌ NO!
  // ... rest of fields
}
```

### ❌ DON'T: Remove Core Fields
```typescript
// WRONG - R scripts will fail
interface SingleArmExtraction {
  // Removed 'page' field  ❌ NO!
  // ... other fields
}
```

### ❌ DON'T: Change Field Types
```typescript
// WRONG - data conversion issues
interface SingleArmExtraction {
  // Changed from number to string  ❌ NO!
  n: string;  // Was: n: number;
}
```

### ✅ DO: Use Extension Patterns
```typescript
// CORRECT - safe extension
interface SingleArmExtraction {
  // ... all 23 core fields unchanged ...
  
  // Safe additions
  customFields?: {
    newProjectField: string;
    anotherField: number;
  };
  schemaVersion?: string;
}
```

## Key Takeaways

1. **Core is sacred** - Never modify 23/22 field structure
2. **Extend sideways** - Use `customFields` or linked tables
3. **Version everything** - Track schema versions for migrations
4. **Export separately** - NMA gets core fields, custom data exported separately
5. **Test compatibility** - Ensure R export still works after changes
6. **Document extensively** - Future developers need to know constraints
