# Radix DLT - Web Portal (Community Proposal)

> **Community Note:** This project has been developed and driven by the Radix community. The central goal of this repository is to propose, iterate, and refine this web portal to present it as a candidate for the **official Radix DLT website**.

A modern, ultra-fast, and highly interactive portal built with the **Next.js (App Router)** ecosystem. Designed to centralize all knowledge, tools, applications, and discussions of the Radix DLT network into a single, fluid ecosystem.

---

## 🚀 Key Features

The project is divided into several vertical modules or "features", each focused on a specific need of the Radix ecosystem:

### 🏠 Home (Main Page)
- **Hero & Auto-play Carousel:** Interactive presentation with real-time metrics.
- **Ecosystem Sections:** Showcases interoperability, wallets, security (Cerberus), and the problem Radix solves.
- **Fluid Animations:** Extensive use of `framer-motion` for Scroll Reveals and layout transitions (Shared Layouts).

### 📊 Dashboard & Explorer
- **Network Explorer:** Direct integration with `@radixdlt/babylon-gateway-api-sdk` to fetch on-chain data in real-time.
- **On-chain Metrics:** Transactions, network status, and staking history.
- **Staking & Validators:** Dedicated interface to search, filter, and analyze Validator Nodes with performance metrics and fees.

### 📰 Blog
- **Dynamic Grid:** Masonry card layout for articles.
- **Reading Mode:** "Medium-style" transition using `layoutId` to expand the card to full screen immersively and without layout shifts.
- **Advanced Filters:** Search by text, tags, and temporal sorting (newest, oldest).

### 💬 Forum (Community Discussions)
- **Nested Discussions:** Support for threads and replies in tree or linear format.
- **Advanced Conversation Filters:**
  - *Protagonist:* Filters and highlights messages from a specific user within a long thread.
  - *All Deep:* Unfolds complete nested reply chains.
- **Rich Markdown Editor:** Post creator with support for formatting, tables, and code blocks.

### 📚 Docs & Academy
- **Documentation Reader:** Optimized technical document reading system with lateral navigation (Sidebar) and syntax highlighting (`shiki`).
- **Strict Validation:** Strict use of `zod` to maintain consistency in metadata and titles (character limits, formatting rules).
- **Academy:** Area oriented towards interactive education on Scrypto and Radix network concepts.

### 🌍 DApps & Games Directory
- Indexed and categorized directories of projects built on Radix (Decentralized Finance, Exchanges, Web3 Games).

---

## 🛠 Tech Stack

This project strictly applies clean code and architecture guidelines:

- **Core:** Next.js 15+ (App Router Exclusively), React 19, TypeScript (Strict Mode).
- **Styles & UI:** Tailwind CSS, Shadcn UI (Accessible Components), CSS Variables (Multi-Theme Support: Light, Dark, Gold), Lucide React (Icons).
- **State & Mutations:** Server Components (RSC), Server Actions, React Query, `unstable_cache`.
- **Forms & Validation:** React Hook Form + Zod.
- **Animations:** Motion (Framer Motion).
- **Internationalization (i18n):** Local Dictionary System (JSON) with Middleware (`proxy.ts`) for automatic language detection (es/en).
- **Observability:** `pino` logger (Structured JSON logs, zero `console.log` in production).

---

## 🧪 Testing

The testing suite ensures the reliability of the application's critical flows.

- **Unit and Integration Testing:** `vitest` + `@testing-library/react`.
- **Running tests:**
  ```bash
  npm run test        # Interactive mode (watch)
  npm run test:run    # CI execution mode
  npm run test:coverage # Generate coverage report
  ```

---

## ⚙️ Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/genkipool/Radix_Community.git
   cd Radix_Community
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Copy the example file to configure your local keys.
   ```bash
   cp .env.local.example .env.local
   ```
   *(Add your tokens, e.g., `RESEND_API_KEY`, etc.)*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🤝 Contribution Guide (Gitflow Workflow)

To collaborate on this project and keep the repository stable for future deployments or an official review by the Radix core team, we use a workflow based on **Gitflow**.

### Branch Architecture
- **`main`**: Production branch. Code here is always stable and is the one directly deployed to Vercel in the final environment. You should never commit directly to `main`.
- **`develop`**: Main development branch (Integration Branch). Finished new features are integrated here.

### Step-by-Step Workflow

1. **Update your local environment:**
   Before starting any task, make sure you are in sync with the latest development version.
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create a Feature / Bugfix branch:**
   Create a descriptive branch always starting from `develop`. Common types: `feature/`, `bugfix/`, `hotfix/` (the latter if it comes from `main`).
   ```bash
   git checkout -b feature/feature-name
   # or
   git checkout -b bugfix/bug-name
   ```

3. **Develop following the Global Rules (User Rules):**
   - Use Server Components (RSC) by default.
   - Apply strict validation (Zod).
   - Ensure WCAG accessibility in color contrasts.
   - Pass all linters and visual inspections (`npm run lint`).
   - Write Unit Tests for your component in the `__tests__/` folder.

4. **Commit your changes:**
   Make atomic, descriptive commits, preferably in English.
   ```bash
   git add .
   git commit -m "Feat: Add new staking calculator component"
   ```

5. **Test your code before pushing:**
   Verify that tests are still green.
   ```bash
   npm run test:run
   ```

6. **Push your branch and open a Pull Request (PR):**
   ```bash
   git push origin feature/feature-name
   ```
   - Open a Pull Request on GitHub comparing your branch against **`develop`**.
   - Request a review.
   - Once approved, it will be merged into `develop`.

7. **Releases (Administrators):**
   When `develop` accumulates enough stable features, it is integrated into `main` via a Release Pull Request, triggering the automatic deployment to Vercel for production.

---

*Developed with ❤️ by the Radix community.*
