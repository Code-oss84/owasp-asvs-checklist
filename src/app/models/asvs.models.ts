// src/app/models/asvs.models.ts

export interface ASVSRequirement {
  '#'?: string;
  Area?: string;
  'ASVS Level'?: number;
  CWE?: string;
  NIST?: string;
  'Verification Requirement'?: string;
  Valid?: 'Valid' | 'Invalid' | 'Not Applicable' | '';
  'Source Code Reference'?: string;
  Comment?: string;
  'Tool Used'?: string;
  category?: string; // Ajouté pour le groupement
}

export interface ASVSCategory {
  name: string;
  requirements: ASVSRequirement[];
  totalCount: number;
  validCount: number;
  progress: number;
}

export interface AIExplanation {
  requirementId: string;
  technology: string;
  explanation: string;
  implementationSteps: string[];
  codeExamples: CodeExample[];
  risks: string[];
  bestPractices: string[];
}

export interface CodeExample {
  language: string;
  code: string;
  description: string;
}

export interface ValidationState {
  [key: string]: {
    status: 'Valid' | 'Invalid' | 'Not Applicable';
    comment: string;
    date: Date;
  };
}