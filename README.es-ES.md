

<div align="center">
  <h1>Teach Anything</h1>
  <h3>Plataforma Educativa Impulsada por IA</h3>
  <p>Crea chatbots inteligentes a partir de tus materiales de curso usando RAG.</p>
</div>

<p align="center">
  <a href="https://github.com/akhileshrangani4/teachanything/blob/main/LICENSE"><img src="https://img.shields.io/github/license/akhileshrangani4/teachanything" alt="Licencia" /></a>
  <a href="https://github.com/akhileshrangani4/teachanything/commits/main"><img src="https://img.shields.io/github/last-commit/akhileshrangani4/teachanything" alt="Último Commit" /></a>
</p>

<p align="center">
  <strong>¿Eres nuevo aquí?</strong> Comienza por <a href="./CONTRIBUTING.md">CONTRIBUTING.md</a> antes de abrir un issue o PR. ¿Usas un asistente de código con IA? Lee <a href="./AGENTS.md">AGENTS.md</a>.
</p>

---

## ¿Qué es Teach Anything?

Teach Anything es una plataforma lista para producción para crear chatbots de IA que responden preguntas utilizando tus materiales de curso. Carga archivos PDF, documentos de Word y más: la IA utiliza RAG (Generación Aumentada por Recuperación) para proporcionar respuestas precisas y conscientes del contexto.

## Características

- **7 Modelos de Código Abierto** — Llama 3.3 70B, Llama 4 Maverick, Mistral Large 2411, Qwen 3 235B, GPT-OSS 120B, NVIDIA Nemotron 3 Super, Gemma 4 31B
- **Pipeline RAG** — Búsqueda semántica indexada con HNSW con atribución de origen, manifiesto de archivos y asignación de tokens para que las respuestas citen el archivo y fragmento exactos de procedencia
- **Ingesta de Archivos** — PDF, Word, PowerPoint (con límites de diapositivas y notas del ponente) y Markdown, procesados de forma asíncrona mediante QStash
- **Rastreador Web** — Descubrimiento e indexación automática de páginas desde una URL raíz con límites de profundidad/páginas, patrones de inclusión/exclusión, detección de re-rastreo mediante hash de contenido y exportación a JSON
- **Analíticas de Conversaciones** — Los profesores pueden explorar, buscar y reproducir cada conversación de estudiante con ordenación, paginación y fuentes citadas
- **Widget Incorporable** — Inserta un chatbot en cualquier sitio web con una sola etiqueta de script
- **Flujo de Aprobación de Profesores** — Registro controlado por administrador, lista de dominios permitidos y eliminación de cuenta autogestionada
- **Páginas Legales + Eliminación de Cuenta** — Páginas de Política de Privacidad y Términos de Uso, además de eliminación autogestionada con confirmación de contraseña
- **Probado y Seguro en Tipos** — Más de 350 pruebas de Jest, TypeScript estricto, seguridad de tipos de extremo a extremo mediante tRPC, CI con Codecov

## Cómo Empezar

```bash
git clone https://github.com/akhileshrangani4/teachanything.git
cd teachanything
npm install
docker compose up -d                     # Start PostgreSQL (port 5433)
cp apps/web/.env.example apps/web/.env   # Configure environment
npm run db:push                          # Push database schema
npm run db:seed                          # Seed demo data (users, chatbots, files)
npm run dev                              # Start development server
```

Visita http://localhost:3000 e inicia sesión con las credenciales imprimidas por `db:seed`.

Solo se requieren Docker, una [clave API de OpenRouter](https://openrouter.ai/) y una [clave API de OpenAI](https://platform.openai.com/) (para embeddings) para comenzar. Consulta [SETUP.md](./SETUP.md) para una configuración detallada.

## Documentación

Las guías para usuarios se encuentran en **[teachanything.ai/docs](https://teachanything.ai/docs)** — tutoriales paso a paso para instructores y estudiantes, además de guías prácticas. Los documentos son un sitio estático de Blume con fuente en [`apps/docs`](./apps/docs) y se sirven en `/docs`.

Para desarrolladores, consulta [SETUP.md](./SETUP.md) (configuración del entorno), [CONTRIBUTING.md](./CONTRIBUTING.md) (configuración de desarrollo) y [AGENTS.md](./AGENTS.md) (estándares de codificación).

## Tecnologías Utilizadas

| Categoría            | Tecnologías                                      |
| -------------------- | ------------------------------------------------ |
| **Framework**        | Next.js 16, React 19, TypeScript, Turborepo      |
| **API**              | tRPC (seguridad de tipos de extremo a extremo)   |
| **Base de Datos**    | PostgreSQL, Drizzle ORM, pgvector                |
| **Autenticación**    | Better Auth (correo/contraseña + aprobación)     |
| **IA**               | OpenRouter, Vercel AI SDK, LangChain             |
| **Infraestructura**  | Upstash Redis/QStash, Supabase Storage, Resend   |
| **Interfaz**         | Shadcn UI, Tailwind CSS                          |

## Estructura del Repositorio

```
teachanything/
├── apps/web/           # Next.js application
│   ├── src/app/        # Pages & API routes
│   ├── src/components/ # UI components
│   └── src/server/     # tRPC routers (incl. rag-context, analytics, crawler)
├── apps/docs/          # User guides (Blume static site, served at /docs)
├── packages/
│   ├── db/             # Database schema (Drizzle, pgvector, HNSW index)
│   ├── ai/             # Model registry, RAG service, web crawler, token budgeter
│   └── logger/         # Shared structured logger
```

## Desarrollo

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build all packages
npm run lint         # Lint codebase
npm run test         # Run test suite
npm run db:push      # Push schema to database
npm run db:seed      # Seed demo data
npm run db:studio    # Open Drizzle Studio
npm run stop         # Stop PostgreSQL container
```

## Contribuciones

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) para la configuración de desarrollo, [SETUP.md](./SETUP.md) para la configuración del entorno y [AGENTS.md](./AGENTS.md) para las directrices de codificación.

## Licencia

[GNU Affero General Public License v3.0](./LICENSE)

---

<p align="center">
  <strong>Creado para educadores, impulsado por IA.</strong>
</p>
