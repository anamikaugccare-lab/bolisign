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

function ensureDataDirectory() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getAllSigns(): CustomSign[] {
  ensureDataDirectory();
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_SIGNS, null, 2), 'utf8');
      return DEFAULT_SIGNS;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const signs = JSON.parse(raw) as CustomSign[];
    return signs;
  } catch (err) {
    console.error('Error reading signs data file:', err);
    return DEFAULT_SIGNS;
  }
}

export function saveNewSign(sign: Omit<CustomSign, 'id' | 'createdAt'>): CustomSign {
  ensureDataDirectory();
  const signs = getAllSigns();
  const newSign: CustomSign = {
    ...sign,
    id: 'sign-custom-' + Date.now(),
    createdAt: new Date().toISOString()
  };
  signs.push(newSign);
  fs.writeFileSync(DATA_FILE, JSON.stringify(signs, null, 2), 'utf8');
  return newSign;
}

export function deleteSign(id: string): boolean {
  ensureDataDirectory();
  let signs = getAllSigns();
  const initialLen = signs.length;
  signs = signs.filter(s => s.id !== id);
  if (signs.length !== initialLen) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(signs, null, 2), 'utf8');
    return true;
  }
  return false;
}

export function updateSign(id: string, updates: Partial<CustomSign>): CustomSign | null {
  ensureDataDirectory();
  const signs = getAllSigns();
  const index = signs.findIndex(s => s.id === id);
  if (index === -1) return null;
  signs[index] = { ...signs[index], ...updates };
  fs.writeFileSync(DATA_FILE, JSON.stringify(signs, null, 2), 'utf8');
  return signs[index];
}

