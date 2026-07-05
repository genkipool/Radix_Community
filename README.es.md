# Radix DLT - Web Portal (Community Proposal)

> **Nota de la Comunidad:** Este proyecto ha sido desarrollado e impulsado por la comunidad de Radix. El objetivo central de este repositorio es proponer, iterar y refinar este portal web para presentarlo como candidato a convertirse en la **página web oficial de Radix DLT**. 

Un portal moderno, ultrarrápido y altamente interactivo construido con el ecosistema de **Next.js (App Router)**. Diseñado para centralizar todo el conocimiento, herramientas, aplicaciones y discusiones de la red Radix DLT en un único ecosistema fluido.

---

## 🚀 Características Principales (Features)

El proyecto está dividido en varios módulos o "features" verticales, cada uno enfocado en una necesidad específica del ecosistema Radix:

### 🏠 Home (Página Principal)
- **Hero & Auto-play Carousel:** Presentación interactiva con métricas en tiempo real.
- **Secciones de Ecosistema:** Muestra la interoperabilidad, billeteras (Wallet), seguridad (Cerberus) y el problema que Radix resuelve.
- **Animaciones fluidas:** Amplio uso de `framer-motion` para Scroll Reveals y transiciones de diseño (Shared Layouts).

### 📊 Dashboard & Explorer
- **Explorador de la Red:** Integración directa con `@radixdlt/babylon-gateway-api-sdk` para obtener datos on-chain en tiempo real.
- **Métricas on-chain:** Transacciones, estado de la red e historial de staking.
- **Staking y Validadores:** Interfaz dedicada para buscar, filtrar y analizar Nodos Validadores con métricas de rendimiento y comisiones (Fee).

### 📰 Blog
- **Grid Dinámico:** Diseño de tarjetas de mampostería (Masonry) para artículos.
- **Modo Lectura (Reading Mode):** Transición estilo "Medium" utilizando `layoutId` para expandir la tarjeta a pantalla completa de forma inmersiva y sin saltos.
- **Filtros Avanzados:** Búsqueda por texto, tags y ordenación temporal (más recientes, más antiguos).

### 💬 Forum (Foro de la Comunidad)
- **Discusiones Anidadas:** Soporte para hilos y respuestas en formato árbol o lineal.
- **Filtros de Conversación Avanzados:**
  - *Protagonist:* Filtra y resalta mensajes de un usuario específico dentro de un hilo extenso.
  - *All Deep:* Despliega cadenas de respuestas anidadas completas.
- **Editor Markdown Enriquecido:** Creador de posts con soporte para formateo, tablas y código.

### 📚 Docs & Academy
- **Lector de Documentación:** Sistema optimizado de lectura de documentos técnicos con navegación lateral (Sidebar) y resaltador de sintaxis (`shiki`).
- **Validación Estricta:** Uso estricto de `zod` para mantener la consistencia en metadatos y títulos (límite de caracteres, reglas formativas).
- **Academy:** Zona orientada a la educación interactiva sobre Scrypto y los conceptos de la red Radix.

### 🌍 DApps & Games Directory
- Directorios indexados y categorizados de proyectos construidos sobre Radix (Finanzas Descentralizadas, Exchanges, Juegos Web3).

---

## 🛠 Stack Tecnológico

Este proyecto aplica pautas de arquitectura estricta y código limpio:

- **Core:** Next.js 16+ (App Router exclusivamente), React 19, TypeScript (Strict Mode).
- **Estilos & UI:** Tailwind CSS, Shadcn UI (Componentes Accesibles), CSS Variables (Soporte Multi-Tema: Claro, Oscuro, Oro), Lucide React (Íconos).
- **Estado y Mutaciones:** Server Components (RSC), Server Actions, React Query, `"use cache"` (Next.js 16).
- **Formularios & Validación:** React Hook Form + Zod.
- **Animaciones:** Motion (Framer Motion).
- **Internacionalización (i18n):** Sistema de Diccionarios Locales (JSON) con Middleware (`proxy.ts`) para detección automática de idioma (es/en).
- **Observabilidad:** `pino` logger (JSON logs estructurados, cero `console.log` en producción).

---

## 🧪 Testing

La suite de pruebas garantiza la fiabilidad de los flujos críticos de la aplicación.

- **Pruebas Unitarias y de Integración:** `vitest` + `@testing-library/react`.
- **Ejecución de Pruebas:**
  ```bash
  pnpm run test        # Modo interactivo (watch)
  pnpm run test:run    # Ejecución de CI
  pnpm run test:coverage # Generar reporte de cobertura
  ```

---

## ⚙️ Instalación y Configuración Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/genkipool/Radix_Community.git
   cd Radix_Community
   ```

2. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

3. **Variables de Entorno:**
   Copia el archivo de ejemplo para configurar tus claves locales.
   ```bash
   cp .env.local.example .env.local
   ```
   *(Añade tus tokens, ejemplo: `RESEND_API_KEY`, etc.)*

4. **Ejecutar servidor de desarrollo:**
   ```bash
   pnpm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🤝 Guía de Contribución (Gitflow Workflow)

Para colaborar en este proyecto y mantener el repositorio estable para futuros despliegues o la revisión oficial por parte del equipo central de Radix, utilizamos un flujo de trabajo basado en **Gitflow**.

### Arquitectura de Ramas
- **`main`**: Rama de producción. El código aquí siempre es estable y es el que se despliega directamente a Vercel en el entorno final. Nunca se debe comitear directamente a `main`.
- **`develop`**: Rama principal de desarrollo (Integration Branch). Las nuevas funcionalidades terminadas se integran aquí. 

### Flujo de Trabajo Paso a Paso

1. **Actualiza tu entorno local:**
   Antes de empezar cualquier tarea, asegúrate de estar sincronizado con la última versión de desarrollo.
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Crea una rama de Feature / Bugfix:**
   Crea una rama descriptiva partiendo siempre de `develop`. Tipos comunes: `feature/`, `bugfix/`, `hotfix/` (esta última si proviene de `main`).
   ```bash
   git checkout -b feature/nombre-de-la-funcionalidad
   # o
   git checkout -b bugfix/nombre-del-error
   ```

3. **Desarrolla siguiendo las Reglas Globales (User Rules):**
   - Usa componentes de servidor (RSC) por defecto.
   - Aplica validación estricta (Zod).
   - Asegura la accesibilidad WCAG en los contrastes de colores.
   - Pasa todos los linterns e inspeciones visuales (`pnpm run lint`).
   - Escribe Unit Tests de tu componente en la carpeta `__tests__/`.

4. **Haz Commit de tus cambios:**
   Haz commits atómicos, descriptivos y preferiblemente en inglés.
   ```bash
   git add .
   git commit -m "Feat: Add new staking calculator component"
   ```

5. **Prueba tu código antes de subir:**
   Verifica que los tests sigan en verde.
   ```bash
   pnpm run test:run
   ```

6. **Sube tu rama y abre un Pull Request (PR):**
   ```bash
   git push origin feature/nombre-de-la-funcionalidad
   ```
   - Abre un Pull Request en GitHub comparando tu rama contra **`develop`**.
   - Solicita revisión.
   - Una vez aprobado, se realizará el Merge a `develop`.

7. **Releases (Administradores):**
   Cuando `develop` acumula suficientes características estables, se integra hacia `main` mediante un Pull Request de Release, disparando el despliegue automático en Vercel para producción.

---

*Desarrollado con ❤️ por la comunidad de Radix.*
