export const APP_NAME = 'C.E.R.P.A.';
export const INSTITUTION_NAME = 'Fe y Alegría';
export const SCHOOL_NAME = 'E. T. Enrique de Ossó';

export const CATEGORIES = [
  'General',
  'Valores y Ciudadanía', 
  'Empleabilidad', 
  'Ciencias I', 
  'Ciencias II', 
  'Lenguaje y Comunicación', 
  'Sociales', 
  'Labor Social', 
  'Bienestar Socio Emocional', 
  'Proyecto', 
  'DPOSA'
] as const;

export type CerpaCategory = (typeof CATEGORIES)[number];

/** Fuerza la materia a una entrada válida del catálogo CERPA (respuesta del modelo). */
export function normalizeCerpaCategory(raw: string | undefined | null): CerpaCategory {
  if (!raw || typeof raw !== 'string') return 'General';
  const t = raw.trim();
  const byExact = CATEGORIES.find((c) => c.toLowerCase() === t.toLowerCase());
  if (byExact) return byExact;

  const lower = t.toLowerCase();
  if (lower.includes('dposa')) return 'DPOSA';
  if (lower.includes('proyecto')) return 'Proyecto';
  if (lower.includes('bienestar') || lower.includes('socio emocional')) return 'Bienestar Socio Emocional';
  if (lower.includes('labor social')) return 'Labor Social';
  if (lower.includes('valores') || lower.includes('ciudadan')) return 'Valores y Ciudadanía';
  if (lower.includes('empleabil')) return 'Empleabilidad';
  if (lower.includes('lenguaje') || lower.includes('comunicación') || lower.includes('comunicacion'))
    return 'Lenguaje y Comunicación';
  if (lower.includes('social') || lower.includes('historia') || lower.includes('geografía') || lower.includes('geografia'))
    return 'Sociales';
  if (lower.includes('ciencias ii') || lower.includes('ciencia ii') || lower.includes('ciencias 2')) return 'Ciencias II';
  if (lower.includes('ciencias i') || lower.includes('ciencia i') || lower.includes('ciencias 1') || lower === 'ciencias')
    return 'Ciencias I';

  return 'General';
}

export const PRIMARIA_LEVELS = [
  '1er Grado', 
  '2do Grado', 
  '3er Grado', 
  '4to Grado', 
  '5to Grado', 
  '6to Grado'
];

export const MEDIA_TECNICA_LEVELS = [
  '1er Año', 
  '2do Año', 
  '3er Año', 
  '4to Año', 
  '5to Año'
] as const;

/** Todos los grados/años válidos para el catálogo (Primaria + Media Técnica). */
export const ALL_CERPA_ACADEMIC_LEVELS = [
  ...PRIMARIA_LEVELS,
  ...MEDIA_TECNICA_LEVELS,
] as const;

export type CerpaAcademicLevel = (typeof ALL_CERPA_ACADEMIC_LEVELS)[number];

export type EducationalStage = 'Primaria' | 'Media Técnica';

export function getEducationalStageFromLevel(
  level: string | undefined | null
): EducationalStage | null {
  if (!level || typeof level !== 'string') return null;
  const t = level.trim();
  if ((PRIMARIA_LEVELS as readonly string[]).includes(t)) return 'Primaria';
  if ((MEDIA_TECNICA_LEVELS as readonly string[]).includes(t)) return 'Media Técnica';
  return null;
}

/**
 * Ajusta la respuesta del modelo (o texto libre) a un grado/año CERPA válido.
 */
export function normalizeAcademicLevel(raw: string | undefined | null): CerpaAcademicLevel {
  if (!raw || typeof raw !== 'string') return '3er Año';
  const t = raw.trim();
  const exact = ALL_CERPA_ACADEMIC_LEVELS.find(
    (l) => l.toLowerCase() === t.toLowerCase()
  );
  if (exact) return exact as CerpaAcademicLevel;

  const n = t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  const gradoMatch = n.match(
    /(1|2|3|4|5|6)(er|do|er|to|to|to)?\s*grado|grado\s*(1|2|3|4|5|6)|primer|segundo|tercer|cuarto|quinto|sexto/
  );
  if (gradoMatch || /primaria|primarios/.test(n)) {
    const wordToNum: Record<string, number> = {
      primer: 1,
      primero: 1,
      segundo: 2,
      tercer: 3,
      tercero: 3,
      cuarto: 4,
      quinto: 5,
      sexto: 6,
    };
    let g = 0;
    for (const [w, num] of Object.entries(wordToNum)) {
      if (n.includes(w)) {
        g = num;
        break;
      }
    }
    if (!g) {
      const d = gradoMatch ? parseInt(gradoMatch[1] || gradoMatch[2] || '0', 10) : 0;
      if (d >= 1 && d <= 6) g = d;
    }
    if (g >= 1 && g <= 6) {
      const ord = (['1er', '2do', '3er', '4to', '5to', '6to'] as const)[g - 1];
      return `${ord} Grado` as CerpaAcademicLevel;
    }
    if (/primaria/.test(n)) return '3er Grado' as CerpaAcademicLevel;
  }

  const añoMatch = n.match(
    /(1|2|3|4|5)(er|do|er|to|to)?\s*an[oó]|an[oó]\s*(1|2|3|4|5)|primer|segundo|tercer|cuarto|quinto/
  );
  if (añoMatch || /media\s*tecnica|media-tecnica|bachillerato|secundaria/.test(n)) {
    const wordToNum: Record<string, number> = {
      primer: 1,
      primero: 1,
      segundo: 2,
      tercer: 3,
      tercero: 3,
      cuarto: 4,
      quinto: 5,
    };
    let y = 0;
    for (const [w, num] of Object.entries(wordToNum)) {
      if (n.includes(w) && (n.includes('año') || n.includes('ano') || /media|secundaria/.test(n))) {
        y = num;
        break;
      }
    }
    if (!y) {
      const d = añoMatch ? parseInt(añoMatch[1] || añoMatch[2] || '0', 10) : 0;
      if (d >= 1 && d <= 5) y = d;
    }
    if (y >= 1 && y <= 5) {
      const ord = (['1er', '2do', '3er', '4to', '5to'] as const)[y - 1];
      return `${ord} Año` as CerpaAcademicLevel;
    }
    if (/media|secundaria|bachillerato/.test(n)) return '3er Año';
  }

  return '3er Año';
}

/** Etapa guardada en el libro o inferida del grado/año. */
export function resolveEducationalStage(
  book: { educationalStage?: string; academicLevel?: string }
): EducationalStage | null {
  const s = book.educationalStage?.trim();
  if (s === 'Primaria' || s === 'Media Técnica') return s;
  return getEducationalStageFromLevel(book.academicLevel);
}

// Using a placeholder that represents the uploaded logo. 
// The user can replace this URL with their actual hosted logo image.
export const LOGO_URL = 'https://storage.googleapis.com/static.antigravity.dev/ais-dev-qphskssft3zapy6w2ya2ga-594912766059/input_file_0.png';
export const LOGO_FALLBACK = 'https://ui-avatars.com/api/?name=Fe+y+Alegria&background=570013&color=fff&bold=true';
