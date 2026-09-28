export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface CustomSign {
  id: string;
  nameHindi: string;
  nameEnglish: string;
  category: 'daily' | 'emergency' | 'college' | 'custom';
  // 21 landmarks x 3 coordinates normalized signature
  landmarksSample: number[][]; 
  fingerSignature?: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
    thumbPointsUp?: boolean;
    isPinch?: boolean;
  };
  recordedBy?: string;
  createdAt: string;
  confidenceThreshold?: number;
}

export interface RecognizedResult {
  signNameHindi: string;
  signNameEnglish: string;
  confidence: number;
  category: string;
}

export interface InterpretRequest {
  tokens: string[];
}

export interface InterpretResponse {
  originalTokens: string[];
  fluentHindi: string;
  englishMeaning: string;
}
