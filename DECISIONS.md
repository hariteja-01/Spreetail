# Decision Log: FairShare

This document outlines the significant technical and product decisions I made while building FairShare, including the options considered and the rationale behind my final choices.

## 1. Technical Stack Selection
**Decision:** Use Next.js (App Router) with Prisma and PostgreSQL (Neon).
- **Options Considered:** 
  1. *React SPA + separate Express backend*: Slower to deploy, requires configuring CORS, and managing two separate repositories/deployments.
  2. *Next.js*: Unified frontend and backend in one repository. Fast deployment to Vercel. Server Actions allow seamless processing of the complex CSV without building standard REST APIs.
- **Rationale:** Given the extremely tight 2-day deadline and the need for a highly interactive CSV import process, Next.js was the obvious choice. The ability to parse the CSV on the server, run complex Prisma queries to check temporal memberships, and return validated data to a React client component immediately saved hours of boilerplate API work.

## 2. Handling Group Membership Changes (Temporal Membership)
**Decision:** Add `joinedAt` and `leftAt` timestamps to the `GroupMember` table rather than soft-deleting members.
- **Options Considered:**
  1. *Simple Many-to-Many Join*: Just delete the row when Meera leaves. (Result: Past expenses break because she no longer exists in the group).
  2. *Soft Deletion (`isActive: boolean`)*: Mark her inactive. (Result: How do we know *when* she was active? Still fails if looking at a past expense).
  3. *Temporal Bounds (`joinedAt`, `leftAt`)*: Store the exact dates.
- **Rationale:** Sam joined in April, Meera left in March. An expense on April 2nd must automatically exclude Meera and include Sam. By storing exact dates, I can simply filter the active members for any specific expense by checking `expense.date >= member.joinedAt && (member.leftAt == null || expense.date <= member.leftAt)`. This makes the logic mathematically bulletproof.

## 3. Balance Calculation Strategy
**Decision:** Fast `O(E+P)` SQL/Prisma aggregation of exact pairwise debts, rather than a "Simplify Debts" graph algorithm.
- **Options Considered:**
  1. *Simplify Debts (Min-Cost Max-Flow)*: Highly optimized graph algorithm to minimize total transactions. Hard to implement correctly in 2 days, and confuses users who want transparency.
  2. *Direct Pairwise Aggregation*: Simple ledger logic. If Rohan owes Priya 500 for dinner and Priya owes Rohan 200 for wifi, Rohan owes Priya a net of 300.
- **Rationale:** As a product decision, Rohan specifically stated he wants "complete transparency... no magic numbers." The Simplify Debts algorithm creates "magic numbers" by re-routing debts through third parties. Pairwise aggregation allows me to build a detailed breakdown for Rohan showing exactly which expenses constitute his debt.

## 4. Multi-Currency Handling
**Decision:** Standardize on a base currency (INR) and convert USD expenses at a fixed hardcoded rate at import time.
- **Options Considered:**
  1. *Live Exchange Rate API*: Fetch rates dynamically based on the exact date of the expense. (Result: Over-engineered, prone to API rate limits, adds latency).
  2. *Keep Currencies Separate*: Calculate balances as "You owe 500 INR and 10 USD." (Result: Violates Aisha's requirement for "one simple number per person").
  3. *Fixed Rate Conversion at Import*: Convert USD to INR using a standard rate (1 USD = 83 INR) and store the final debt in INR.
- **Rationale:** A fixed rate meets Aisha's requirement for a simple summary number. While a live API would be more accurate, a fixed rate is perfectly acceptable for an MVP. I ensure the UI displays the original USD amount alongside the converted INR amount for transparency.

## 5. CSV Import Strategy
**Decision:** Interactive "Import Wizard" UI over silent auto-fixing.
- **Options Considered:**
  1. *Silent Auto-Fixing*: Script runs, guesses what to do, and saves. (Result: High risk of data corruption, violates Meera's requirement for "control over cleanup").
  2. *Strict Rejection*: Script crashes and rejects the file if any error exists. (Result: User has to manually clean the 44-row messy CSV. Bad UX).
  3. *Interactive Wizard*: Script parses data, fixes obvious issues (whitespace), but flags ambiguous anomalies (duplicate conflicts, ambiguous dates) for user review in a clean UI before committing to the DB.
- **Rationale:** Meets all flatmate requirements. The system does the heavy lifting of anomaly detection but gives Meera final approval power. Generating an "Import Report" proves to the group that the data wasn't manipulated silently.

## 6. UI Framework
**Decision:** Tailwind CSS + shadcn/ui.
- **Options Considered:** Material-UI, Chakra UI, Vanilla CSS.
- **Rationale:** `shadcn/ui` provides beautiful, accessible, copy-paste components that don't bloat the bundle size. It looks highly professional and modern without looking like a generic Bootstrap template, proving design competence.
