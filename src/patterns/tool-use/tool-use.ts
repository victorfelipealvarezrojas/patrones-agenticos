/**
 * PATRÓN: Uso de herramientas - Tool use
 * ---------------------------
 * El catálogo de cursos NO está en el entrenamiento
 * del modelo. Sin herramientas, el modelo inventa precios y cursos con
 * total confianza o en su defecto, no hace nada.
 * Con herramientas, consulta el dato real.
 */

import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createTracer, model } from "../../helpers/index.js";

// ---------------------------------------------------------------------------
//  LA "BASE DE DATOS" — datos que el modelo no puede conocer
// ---------------------------------------------------------------------------
type Course = {
  id: string;
  title: string;
  hours: number;
  priceUSD: number;
  level: "basic" | "intermediate" | "advanced";
  students: number;
};

const COURSE_CATALOG: Course[] = [
  {
    id: "ts-01",
    title: "TypeScript desde cero",
    hours: 22,
    priceUSD: 19.99,
    level: "basic",
    students: 48_120,
  },
  {
    id: "nest-02",
    title: "NestJS: API REST modular",
    hours: 31,
    priceUSD: 24.99,
    level: "intermediate",
    students: 22_450,
  },
  {
    id: "flu-03",
    title: "Flutter: apps multiplataforma",
    hours: 46,
    priceUSD: 29.99,
    level: "intermediate",
    students: 61_300,
  },
  {
    id: "agt-04",
    title: "Agentes de IA con TypeScript",
    hours: 18,
    priceUSD: 34.99,
    level: "advanced",
    students: 1_890,
  },
  {
    id: "dkr-05",
    title: "Docker para desarrolladores",
    hours: 14,
    priceUSD: 17.99,
    level: "basic",
    students: 35_770,
  },
];

const QUESTIONS =
  "¿Cuanto costarin juntos el curso de typescript y el de docker " +
  "con un 20% de descuento? dame tambien las horas totales.";

const findCoursesTools = tool({
  description:
    "Busca cursos en el catalogo, por texto, en el titulo o en el nivel.",
  inputSchema: z.object({
    text: z
      .string()
      .optional()
      .describe("Texto a buscar en el titulo del curso."),
    level: z.enum(["basic", "intermediate", "advanced"]).optional(),
  }),
  execute: async ({ level, text }) => {
    const filteredCourses = COURSE_CATALOG.filter((course) => {
      const matchesText =
        !text || course.title.toLowerCase().includes(text.toLowerCase());
      const matchesLevel = !level || course.level === level;
      return matchesText && matchesLevel;
    });
    return {
      found: filteredCourses.length,
      courses: filteredCourses,
    };
  },
});

const caclulateTotal = tool({
  description:
    "Calcula el precio total de una lista de cursos aplicando un descuento porcentual.",
  inputSchema: z.object({
    ids: z.array(z.string()).describe("IDs de los cursos"),
    descountPercent: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .describe("Porcentaje(%) de descuento"),
  }),
  execute: async ({ ids, descountPercent }) => {
    const foundCourses = COURSE_CATALOG.filter((couse) => {
      ids.includes(couse.id);
    });

    const notFound = ids.filter(
      (id) => !COURSE_CATALOG.some((couse) => couse.id === id),
    );

    const subTotal = foundCourses.reduce(
      (acc, course) => acc + course.priceUSD,
      0,
    );

    const discount = subTotal * (descountPercent / 100);

    return {
      subTotal: Number(subTotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total: Number(subTotal - discount).toFixed(2),
      notFound: notFound
    };
  },
});

//NOTE: funcion con tools
async function withTools() {
  const tracer = createTracer("tools-tracer");

  const { text } = await generateText({
    model: model,
    prompt: QUESTIONS,
    tools: {
      findCoursesTools,
      caclulateTotal,
    },
    stopWhen: stepCountIs(6), // circuit breaker
    instructions:
      "Eres un asistente de catalogo de cursos. no inventes informacion y no des ejemplos. " +
      "responde con la infromacion entregada por las herramientas disponibles.",
    onStepEnd: tracer.onStepFinish,
  });
  console.log("\n Respuesta: ", text.green);
  console.log("\n verificar los numeros contra el catalogo de cursos");

  return tracer.summary();
}

export async function toolUseMain() {
  const resultWitTools = await withTools();

  console.log("\n=== Comparativa ===");

  console.table({
    "Resumen: ": resultWitTools,
  });
}
