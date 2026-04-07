import { db } from './firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-error';

const initialBooks = [
  {
    title: "A Través de los Mapas",
    author: "Eduardo Galeano & Martina Rossi",
    isbn: "978-980-12-3456-7",
    description: "Una exploración profunda de la geografía humana y política de América Latina. A través de este texto, los estudiantes de tercer año desentrañarán cómo las fronteras y los mapas no son solo líneas físicas, sino construcciones sociales que han moldeado nuestra identidad histórica.",
    category: "Sociales",
    academicLevel: "3er Año",
    year: 2023,
    pages: 342,
    language: "Español",
    stock: 12,
    publisher: "Lumen Press"
  },
  {
    title: "Culturas del Mundo",
    author: "Elena Rodríguez",
    isbn: "978-980-001-224",
    description: "Un viaje fascinante por las diversas culturas que habitan nuestro planeta, analizando sus tradiciones, lenguajes y formas de organización social.",
    category: "Valores y Ciudadanía",
    academicLevel: "3er Año",
    year: 2022,
    pages: 280,
    language: "Español",
    stock: 8,
    publisher: "Editorial Académica"
  },
  {
    title: "Próceres de América",
    author: "Simón Bolívar Institucional",
    isbn: "978-980-001-225",
    description: "Biografías detalladas de los hombres y mujeres que lucharon por la independencia de las naciones americanas.",
    category: "Sociales",
    academicLevel: "3er Año",
    year: 2021,
    pages: 450,
    language: "Español",
    stock: 25,
    publisher: "Ediciones Fe y Alegría"
  },
  {
    title: "Guía de Empleabilidad",
    author: "C.E.R.P.A. Editorial",
    isbn: "978-980-001-226",
    description: "Herramientas prácticas para la inserción laboral y el desarrollo de competencias profesionales.",
    category: "Empleabilidad",
    academicLevel: "5to Año",
    year: 2024,
    pages: 120,
    language: "Español",
    stock: 50,
    publisher: "Ediciones Fe y Alegría"
  },
  {
    title: "Mi Primer Cuaderno de Valores",
    author: "Marta Sánchez",
    isbn: "978-980-001-227",
    description: "Actividades lúdicas para el aprendizaje de valores fundamentales en la etapa escolar inicial.",
    category: "Valores y Ciudadanía",
    academicLevel: "1er Grado",
    year: 2023,
    pages: 64,
    language: "Español",
    stock: 40,
    publisher: "Editorial Infantil"
  },
  {
    title: "Ciencias Naturales Divertidas",
    author: "Roberto Gómez",
    isbn: "978-980-001-228",
    description: "Experimentos sencillos y explicaciones claras sobre el mundo natural para niños de primaria.",
    category: "Ciencias I",
    academicLevel: "4to Grado",
    year: 2022,
    pages: 150,
    language: "Español",
    stock: 30,
    publisher: "Ciencia Joven"
  },
  {
    title: "Matemáticas para la Vida",
    author: "Ricardo Pérez",
    isbn: "978-980-001-229",
    description: "Un enfoque práctico de las matemáticas aplicadas a situaciones cotidianas, desde finanzas personales hasta lógica básica.",
    category: "Ciencias II",
    academicLevel: "5to Año",
    year: 2023,
    pages: 310,
    language: "Español",
    stock: 15,
    publisher: "Editorial Didáctica"
  },
  {
    title: "Historia Universal Contemporánea",
    author: "Javier Morales",
    isbn: "978-980-001-230",
    description: "Análisis de los eventos más significativos del siglo XX y XXI que han dado forma al mundo actual.",
    category: "Sociales",
    academicLevel: "4to Año",
    year: 2024,
    pages: 420,
    language: "Español",
    stock: 20,
    publisher: "Historia Viva"
  },
  {
    title: "Literatura Hispanoamericana",
    author: "Gabriela Mistral (Antología)",
    isbn: "978-980-001-231",
    description: "Una selección de las obras más representativas de los grandes autores de nuestra región.",
    category: "Lengua y Literatura",
    academicLevel: "5to Año",
    year: 2022,
    pages: 380,
    language: "Español",
    stock: 18,
    publisher: "Letras de América"
  },
  {
    title: "Física Conceptual",
    author: "Paul Hewitt",
    isbn: "978-980-001-232",
    description: "Entiende las leyes del universo sin complicaciones matemáticas excesivas. Ideal para bachillerato.",
    category: "Ciencias II",
    academicLevel: "4to Año",
    year: 2021,
    pages: 560,
    language: "Español",
    stock: 10,
    publisher: "Pearson Educación"
  },
  {
    title: "Inglés para Todos",
    author: "Sarah Jenkins",
    isbn: "978-980-001-233",
    description: "Método comunicativo para el aprendizaje del idioma inglés desde nivel básico hasta intermedio.",
    category: "Idiomas",
    academicLevel: "Todos",
    year: 2023,
    pages: 240,
    language: "Inglés/Español",
    stock: 35,
    publisher: "Global English"
  },
  {
    title: "Informática y Programación",
    author: "Alan Turing Jr.",
    isbn: "978-980-001-234",
    description: "Introducción al pensamiento computacional y los fundamentos de la programación moderna.",
    category: "Tecnología",
    academicLevel: "5to Año",
    year: 2024,
    pages: 290,
    language: "Español",
    stock: 22,
    publisher: "Tech Press"
  },
  {
    title: "Filosofía para Jóvenes",
    author: "Sócrates Moderno",
    isbn: "978-980-001-235",
    description: "Una introducción amena a los grandes pensadores de la historia y cómo sus ideas siguen vigentes hoy.",
    category: "Valores y Ciudadanía",
    academicLevel: "5to Año",
    year: 2023,
    pages: 210,
    language: "Español",
    stock: 15,
    publisher: "Pensamiento Libre"
  },
  {
    title: "Química Orgánica Básica",
    author: "Marie Curie II",
    isbn: "978-980-001-236",
    description: "Fundamentos de la química del carbono explicados de forma sencilla para estudiantes de media técnica.",
    category: "Ciencias II",
    academicLevel: "5to Año",
    year: 2024,
    pages: 320,
    language: "Español",
    stock: 12,
    publisher: "Laboratorio Editorial"
  },
  {
    title: "Arte y Expresión",
    author: "Frida Kahlo Jr.",
    isbn: "978-980-001-237",
    description: "Técnicas de dibujo, pintura y apreciación artística para desarrollar la creatividad.",
    category: "Proyecto",
    academicLevel: "Todos",
    year: 2022,
    pages: 180,
    language: "Español",
    stock: 20,
    publisher: "Pinceladas"
  },
  {
    title: "Geografía de Venezuela",
    author: "Humboldt Institucional",
    isbn: "978-980-001-238",
    description: "Estudio detallado de las regiones, climas y recursos naturales de nuestro país.",
    category: "Sociales",
    academicLevel: "2do Año",
    year: 2023,
    pages: 250,
    language: "Español",
    stock: 30,
    publisher: "Ediciones Fe y Alegría"
  },
  {
    title: "Educación Física y Salud",
    author: "Atleta Nacional",
    isbn: "978-980-001-239",
    description: "Guía completa sobre ejercicios, nutrición y hábitos saludables para adolescentes.",
    category: "Bienestar Socio Emocional",
    academicLevel: "Todos",
    year: 2024,
    pages: 140,
    language: "Español",
    stock: 45,
    publisher: "Vida Sana"
  },
  {
    title: "Liderazgo Comunitario",
    author: "Nelson Mandela (Inspiración)",
    isbn: "978-980-001-240",
    description: "Cómo organizar proyectos sociales y liderar cambios positivos en tu comunidad.",
    category: "Labor Social",
    academicLevel: "4to Año",
    year: 2023,
    pages: 190,
    language: "Español",
    stock: 25,
    publisher: "C.E.R.P.A. Editorial"
  },
  {
    title: "Psicología del Aprendizaje",
    author: "Jean Piaget Jr.",
    isbn: "978-980-001-241",
    description: "Entiende cómo funciona tu mente al estudiar y mejora tus técnicas de aprendizaje.",
    category: "Bienestar Socio Emocional",
    academicLevel: "5to Año",
    year: 2022,
    pages: 230,
    language: "Español",
    stock: 18,
    publisher: "Mente Abierta"
  },
  {
    title: "Ecología y Sostenibilidad",
    author: "Gaia Guardián",
    isbn: "978-980-001-242",
    description: "La importancia de cuidar el medio ambiente y prácticas para un futuro sostenible.",
    category: "Ciencias I",
    academicLevel: "3er Año",
    year: 2024,
    pages: 200,
    language: "Español",
    stock: 28,
    publisher: "Planeta Verde"
  },
  {
    title: "Matemáticas Avanzadas",
    author: "Euler Rodríguez",
    isbn: "978-980-001-243",
    description: "Cálculo, álgebra lineal y geometría analítica para el último año de bachillerato.",
    category: "Ciencias II",
    academicLevel: "5to Año",
    year: 2024,
    pages: 400,
    language: "Español",
    stock: 10,
    publisher: "Editorial Científica"
  },
  {
    title: "Química Inorgánica",
    author: "Mendeleev Pérez",
    isbn: "978-980-001-244",
    description: "Estudio de los elementos y sus reacciones. Incluye tabla periódica actualizada.",
    category: "Ciencias II",
    academicLevel: "4to Año",
    year: 2023,
    pages: 350,
    language: "Español",
    stock: 15,
    publisher: "Laboratorio Editorial"
  },
  {
    title: "Biología Celular",
    author: "Watson & Crick Jr.",
    isbn: "978-980-001-245",
    description: "Explora el mundo microscópico y los fundamentos de la genética moderna.",
    category: "Ciencias I",
    academicLevel: "4to Año",
    year: 2024,
    pages: 380,
    language: "Español",
    stock: 20,
    publisher: "BioPress"
  },
  {
    title: "Historia de Venezuela Siglo XX",
    author: "Arturo Uslar Pietri (Inspiración)",
    isbn: "978-980-001-246",
    description: "Un recorrido por los cambios políticos y sociales de Venezuela en el último siglo.",
    category: "Sociales",
    academicLevel: "5to Año",
    year: 2022,
    pages: 300,
    language: "Español",
    stock: 25,
    publisher: "Historia Viva"
  },
  {
    title: "Cívica y Constitución",
    author: "Andrés Bello (Legado)",
    isbn: "978-980-001-247",
    description: "Conoce tus derechos y deberes como ciudadano venezolano. Estudio de la Constitución.",
    category: "Valores y Ciudadanía",
    academicLevel: "Todos",
    year: 2024,
    pages: 150,
    language: "Español",
    stock: 60,
    publisher: "Estado de Derecho"
  },
  {
    title: "Emprendimiento Social",
    author: "Muhammad Yunus (Inspiración)",
    isbn: "978-980-001-248",
    description: "Cómo crear negocios que resuelvan problemas sociales y ambientales.",
    category: "Empleabilidad",
    academicLevel: "5to Año",
    year: 2023,
    pages: 220,
    language: "Español",
    stock: 30,
    publisher: "Innovación Social"
  },
  {
    title: "Redacción y Estilo",
    author: "Miguel de Cervantes Jr.",
    isbn: "978-980-001-249",
    description: "Mejora tu escritura, ortografía y capacidad de expresión escrita.",
    category: "Lenguaje y Comunicación",
    academicLevel: "Todos",
    year: 2024,
    pages: 180,
    language: "Español",
    stock: 40,
    publisher: "Letras Claras"
  },
  {
    title: "Oratoria y Debate",
    author: "Cicerón Moderno",
    isbn: "978-980-001-250",
    description: "Técnicas para hablar en público, argumentar y participar en debates constructivos.",
    category: "Lenguaje y Comunicación",
    academicLevel: "4to Año",
    year: 2023,
    pages: 160,
    language: "Español",
    stock: 20,
    publisher: "Voz y Palabra"
  }
];

export const seedDatabase = async () => {
  // Seeding disabled by request
  console.log("Seeding is disabled.");
  return 0;
};

export const clearSeedBooks = async () => {
  try {
    const booksRef = collection(db, 'books');
    const snapshot = await getDocs(booksRef);
    const initialTitles = new Set(initialBooks.map(book => book.title.trim().toLowerCase()));
    
    let deletedCount = 0;
    for (const bookDoc of snapshot.docs) {
      const title = bookDoc.data().title?.trim().toLowerCase();
      if (title && initialTitles.has(title)) {
        await deleteDoc(doc(db, 'books', bookDoc.id));
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} filler books.`);
    return deletedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'books (clearing)');
    throw error;
  }
};
