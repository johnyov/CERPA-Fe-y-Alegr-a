import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import {
  ALL_CERPA_ACADEMIC_LEVELS,
  CATEGORIES,
  getEducationalStageFromLevel,
  normalizeAcademicLevel,
  normalizeCerpaCategory,
} from '../constants';

function getGeminiApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const key = getGeminiApiKey();
  if (!key) {
    console.warn(
      '[Gemini] Falta VITE_GEMINI_API_KEY. Crea .env.local con VITE_GEMINI_API_KEY=tu_clave'
    );
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

export const speakText = async (text: string) => {
  if (!text) return;
  const ai = getClient();
  if (!ai) return;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioBlob = await fetch(`data:audio/pcm;base64,${base64Audio}`).then((res) =>
        res.blob()
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  } catch (error) {
    console.error('Error in TTS:', error);
  }
};

export const analyzeBookImage = async (base64Image: string) => {
  const ai = getClient();
  if (!ai) return {};

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/jpeg',
              },
            },
            {
              text: 'Identify this book. Return JSON with {title: string, author: string, isbn: string}. If not a book, return empty strings.',
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error analyzing book image:', error);
    return {};
  }
};

export const analyzeBookMetadata = async (
  pdfText: string,
  totalPages: number
): Promise<any> => {
  const ai = getClient();
  if (!ai) {
    return null;
  }

  const materiasLista = CATEGORIES.map((m) => `"${m}"`).join(', ');
  const nivelesLista = ALL_CERPA_ACADEMIC_LEVELS.map((n) => `"${n}"`).join(', ');

  const prompt = `
    Eres el catalogador automático de la biblioteca digital C.E.R.P.A. (Fe y Alegría).
    A partir del texto extraído del PDF, debes producir metadatos precisos para el catálogo.

    Materias permitidas (el campo "category" DEBE ser exactamente UNA de estas cadenas, sin inventar otras):
    [${materiasLista}]

    Niveles académicos permitidos — el campo "academicLevel" DEBE ser exactamente UNA de estas cadenas:
    [${nivelesLista}]
    - Primaria: "1er Grado" … "6to Grado" (lecturas para educación primaria).
    - Media Técnica: "1er Año" … "5to Año" (secundaria / media técnica).

    Instrucciones:
    1. Metadatos: extrae título y autor desde portada, contraportada, página legal o primeras páginas. Editorial (publisher) si aparece.
    2. Páginas: el número real de páginas del documento es ${totalPages} (usa este valor en "pages" salvo que el texto del PDF muestre claramente un número de páginas impreso distinto y más fiable).
    3. Resumen profesional: redacta "description" en tono de fichero bibliográfico (2–4 párrafos claros): público, enfoque, contenidos principales y utilidad para el estudiante. Sin marketing vacío.
    4. Clasificación: elige la materia que mejor encaje con el contenido e intención pedagógica; si hay duda, usa "General".
    5. Nivel académico recomendado: analiza el idioma (registro, vocabulario, complejidad sintáctica), la densidad conceptual, el tipo de actividades, referencias curriculares o menciones explícitas de grado/año en el texto. Decide si el material corresponde a Primaria o a Media Técnica y elige UN único valor de "academicLevel" de la lista permitida. Si el libro es claramente para adultos o no escolar, elige el nivel de Media Técnica más cercano al público (p. ej. "5to Año") y explica brevemente en una frase interna mental; no inventes cadenas fuera de la lista.
    6. Etapa educativa: "educationalStage" debe ser exactamente "Primaria" si academicLevel es un Grado, o "Media Técnica" si academicLevel es un Año.
    7. Otros campos: year (número), isbn, language (idioma principal del contenido).

    Responde ÚNICAMENTE con JSON válido:
    {
      "title": "",
      "author": "",
      "publisher": "",
      "pages": ${totalPages},
      "description": "",
      "category": "",
      "academicLevel": "",
      "educationalStage": "",
      "year": null,
      "isbn": "",
      "language": ""
    }

    Usa null o cadena vacía cuando no haya dato. category y academicLevel deben coincidir exactamente con las listas permitidas.

    Texto extraído (fragmento):
    ${pdfText.substring(0, 8000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const result = JSON.parse(response.text || '{}');
    const pagesFromAi =
      typeof result.pages === 'number' && result.pages > 0 ? result.pages : totalPages;
    const category = normalizeCerpaCategory(result.category);
    const academicLevel = normalizeAcademicLevel(result.academicLevel);
    const stageFromLevel = getEducationalStageFromLevel(academicLevel);
    const educationalStageRaw =
      typeof result.educationalStage === 'string' ? result.educationalStage.trim() : '';
    const educationalStage =
      educationalStageRaw === 'Primaria' || educationalStageRaw === 'Media Técnica'
        ? educationalStageRaw
        : stageFromLevel || 'Media Técnica';
    const description =
      typeof result.description === 'string'
        ? result.description
        : typeof result.summary === 'string'
          ? result.summary
          : typeof result.resumen === 'string'
            ? result.resumen
            : '';

    return {
      ...result,
      category,
      pages: pagesFromAi,
      description,
      academicLevel,
      educationalStage,
    };
  } catch (error) {
    console.error('Error analyzing metadata:', error);
    return null;
  }
};
