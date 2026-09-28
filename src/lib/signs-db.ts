import fs from 'fs';
import path from 'path';
import { CustomSign, RecognizedResult } from './types';

const DATA_FILE = path.join(process.cwd(), 'data', 'custom_signs.json');

// Built-in Indian Sign Language (ISL) baseline gestures
export const DEFAULT_SIGNS: CustomSign[] = [
  {
    id: 'sign-namaste',
    nameHindi: 'नमस्ते',
    nameEnglish: 'Namaste / Hello',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-paani',
    nameHindi: 'पानी',
    nameEnglish: 'Water',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-madad',
    nameHindi: 'मदद चाहिए (SOS)',
    nameEnglish: 'Help / Emergency',
    category: 'emergency',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-haan',
    nameHindi: 'हाँ',
    nameEnglish: 'Yes',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-nahi',
    nameHindi: 'नहीं',
    nameEnglish: 'No',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-dhanyavaad',
    nameHindi: 'धन्यवाद',
    nameEnglish: 'Thank You',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-doctor',
    nameHindi: 'डॉक्टर',
    nameEnglish: 'Doctor / Medical',
    category: 'emergency',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-khana',
    nameHindi: 'खाना',
    nameEnglish: 'Food / Hunger',
    category: 'daily',
    landmarksSample: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sign-library',
    nameHindi: 'लाइब्रेरी (कॉलेज)',
    nameEnglish: 'College Library',
    category: 'college',
    landmarksSample: [],
    createdAt: new Date().toISOString(),
    recordedBy: 'College Employee'
  },
  {
    id: 'sign-attendance',
    nameHindi: 'अटेंडेंस',
    nameEnglish: 'Attendance',
    category: 'college',
    landmarksSample: [],
    createdAt: new Date().toISOString(),
    recordedBy: 'College Employee'
  }
];

// Memory cache for serverless environments (Vercel)
let memoryCache: CustomSign[] | null = null;

function getDataFilePath(): string {
  // On Vercel, the app root is read-only, but /tmp is writable
  if (process.env.VERCEL || process.platform === 'linux') {
    const tmpFile = path.join('/tmp', 'custom_signs.json');
    if (!fs.existsSync(tmpFile)) {
      try {
        const sourceData = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : JSON.stringify(DEFAULT_SIGNS, null, 2);
        fs.writeFileSync(tmpFile, sourceData, 'utf8');
      } catch (e) {
        // Fallback to in-memory
      }
    }
    return tmpFile;
  }
  return DATA_FILE;
}

function ensureDataDirectory(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Ignore in read-only environment
  }
}

export function getAllSigns(): CustomSign[] {
  if (memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  const targetFile = getDataFilePath();
  ensureDataDirectory(targetFile);

  try {
    if (fs.existsSync(targetFile)) {
      const raw = fs.readFileSync(targetFile, 'utf8');
      const signs = JSON.parse(raw) as CustomSign[];
      memoryCache = signs;
      return signs;
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const signs = JSON.parse(raw) as CustomSign[];
      memoryCache = signs;
      return signs;
    }
    memoryCache = [...DEFAULT_SIGNS];
    return memoryCache;
  } catch (err) {
    console.error('Error reading signs data file:', err);
    memoryCache = [...DEFAULT_SIGNS];
    return memoryCache;
  }
}

function persistSigns(signs: CustomSign[]) {
  memoryCache = signs;
  const targetFile = getDataFilePath();
  try {
    ensureDataDirectory(targetFile);
    fs.writeFileSync(targetFile, JSON.stringify(signs, null, 2), 'utf8');
  } catch (err) {
    console.warn('Persist to disk failed, maintained in memory:', err);
  }
}

export function saveNewSign(sign: Omit<CustomSign, 'id' | 'createdAt'>): CustomSign {
  const signs = [...getAllSigns()];
  const newSign: CustomSign = {
    ...sign,
    id: 'sign-custom-' + Date.now(),
    createdAt: new Date().toISOString()
  };
  signs.push(newSign);
  persistSigns(signs);
  return newSign;
}

export function deleteSign(id: string): boolean {
  let signs = [...getAllSigns()];
  const initialLen = signs.length;
  signs = signs.filter(s => s.id !== id);
  if (signs.length !== initialLen) {
    persistSigns(signs);
    return true;
  }
  return false;
}

export function updateSign(id: string, updates: Partial<CustomSign>): CustomSign | null {
  const signs = [...getAllSigns()];
  const index = signs.findIndex(s => s.id === id);
  if (index === -1) return null;
  signs[index] = { ...signs[index], ...updates };
  persistSigns(signs);
  return signs[index];
}

