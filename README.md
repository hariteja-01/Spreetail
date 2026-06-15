# FairShare - Shared Expenses App (Spreetail Assignment)

## Overview
FairShare is a full-stack web application designed to solve complex, messy shared expense tracking. It was built specifically to address the assignment prompt featuring four flatmates (Aisha, Rohan, Priya, Meera) and their chaotic `expenses_export.csv` data.

**Key Features Implemented:**
- **Robust CSV Import Engine:** Safely parses, validates, and interactively flags 12+ deliberate data anomalies (duplicates, temporal issues, multi-currency, string formatting) rather than failing silently or guessing.
- **Temporal Group Membership:** Mathematically accounts for when members joined (Sam in April) and left (Meera in March) to ensure bills are split correctly against the active roster on the date of the expense.
- **Transparent Ledger Accounting:** Calculates exact pairwise debts (who owes whom) in $O(N)$ time instead of a "Simplify Debts" graph algorithm, guaranteeing complete transparency ("no magic numbers").
- **Multi-Currency Normalization:** Handles USD/INR mixes natively within the CSV import by standardizing to a base currency.
- **Premium Glassmorphism UI:** Built with Tailwind CSS featuring a sleek dark mode aesthetic.

## 🚀 Live Deployment
**App URL:** https://spreetail-zeta.vercel.app/
**Database:** Hosted on Neon (Serverless PostgreSQL)

## 🛠 Tech Stack
- **Frontend & Backend Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Styling:** Tailwind CSS + Vanilla CSS (Glassmorphism Dark Theme)
- **CSV Engine:** PapaParse (with rigorous pre-validation and interactive resolution UI)

## 💻 Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hariteja-01/Spreetail.git
   cd Spreetail
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   # Your Neon Postgres connection string
   DATABASE_URL="postgresql://user:password@hostname/db?sslmode=require"
   
   # JWT Secret for authentication
   JWT_SECRET="your-secure-secret"
   ```

4. **Initialize the Database:**
   Push the Prisma schema to your Postgres instance:
   ```bash
   npx prisma db push
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🤖 AI Usage Disclosure
In accordance with modern engineering practices and the assignment rubric, I used Google's Gemini as an AI pair-programmer for this project.

The AI was highly effective for generating CSS boilerplate and scaffolding Prisma schemas. However, it struggled significantly with the complex domain logic specific to the assignment constraints (temporal memberships, balance calculation transparency). As the engineer of record, I had to architect the solutions, direct the AI, and manually override its generated logic to ensure the product met the real-world requirements.

For a detailed breakdown of three specific instances where the AI produced incorrect logic and how I caught and fixed it, please refer to the `AI_USAGE.md` document in this repository.

## 📄 Required Documentation
- `SCOPE.md`: Contains the exhaustive Anomaly Log (detailing how each of the 12+ CSV errors was handled) and the Database Schema justification.
- `DECISIONS.md`: Details the options considered and rationale for major architectural and product decisions.
- `AI_USAGE.md`: Details how AI was directed, including 3 specific correction cases.
- `IMPORT_REPORT.md`: A static log of the exact anomalies detected (and actions taken) when ingesting the provided `expenses_export.csv` file. You can also dynamically download this report directly from the App UI during the import process by clicking "Download Report as Text".
