import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const speakText = async (text: string) => {
  if (!text) return;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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
      const audioBlob = await fetch(`data:audio/pcm;base64,${base64Audio}`).then(res => res.blob());
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  } catch (error) {
    console.error("Error in TTS:", error);
  }
};

export const analyzeBookImage = async (base64Image: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
              },
            },
            { text: "Identify this book. Return JSON with {title: string, author: string, isbn: string}. If not a book, return empty strings." },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Error analyzing book image:", error);
    return {};
  }
};

export const analyzeBookMetadata = async (pdfText: string, totalPages: number): Promise<any> => {
  const prompt = `
    Actúa como un extractor de datos de alto rendimiento para una biblioteca digital.
    Tu objetivo es procesar el texto extraído de un PDF de forma técnica y rápida.
    
    Instrucciones Críticas:
    1. Prioridad de Lectura: Enfócate exclusivamente en el texto del índice, la introducción y la contraportada para determinar la categoría.
    2. Clasificación: Asigna el libro a una de las categorías preestablecidas (Ciencias, Literatura, Historia, Tecnología, Arte, Filosofía, Psicología, Medicina, Derecho, Economía, Otros).
    3. Resumen Ejecutivo: Genera un resumen de máximo 3 párrafos usando una técnica de 'escaneo rápido'. Busca la tesis central y los puntos clave.
    4. Formato de Salida: Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
    {
      "title": "Título del libro",
      "author": "Nombre del autor",
      "category": "Categoría asignada",
      "academicLevel": "Nivel recomendado (ej: 1er Año, 2do Año, 3er Año, 4to Año, 5to Año, Primaria, Universitario)",
      "publisher": "Editorial",
      "year": 2024,
      "description": "Resumen ejecutivo de 3 párrafos",
      "isbn": "ISBN si está disponible",
      "language": "Idioma detectado"
    }

    Si el PDF presenta errores de codificación o texto protegido, extrae solo los fragmentos legibles.
    
    Texto extraído:
    ${pdfText.substring(0, 8000)}
    
    Total de páginas: ${totalPages}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      ...result,
      pages: totalPages
    };
  } catch (error) {
    console.error("Error analyzing metadata:", error);
    return null;
  }
};
