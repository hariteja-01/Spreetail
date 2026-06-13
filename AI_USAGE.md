# AI Usage Log: FairShare

In the interest of full transparency and modern engineering practices, I utilized Google's Gemini as an AI pair-programmer while developing FairShare. The AI was highly effective for generating boilerplate code (like Prisma schema scaffolding and Tailwind components), but it struggled significantly with the complex domain logic specific to the assignment constraints. 

As a junior developer and product manager on this project, I frequently had to override, correct, or completely rewrite the AI's suggestions to ensure the product met the real-world requirements of the flatmates. 

Here are three specific instances where the AI provided incorrect or suboptimal advice, and how I corrected it:

## 1. Mishandling Temporal Group Membership Dates
**The AI's Suggestion:** When designing the Prisma schema to handle Sam joining in April and Meera leaving in March, the AI suggested storing the `joinedAt` and `leftAt` values as `String` types (e.g., "YYYY-MM-DD") because "it's easier to render on the frontend without timezone issues."
**My Correction:** I immediately rejected this. Storing dates as strings makes mathematical comparison (`expense.date > member.joinedAt`) extremely fragile and database-dependent. I forced the AI to refactor the schema to use native ISO `DateTime` objects. This allowed me to leverage Prisma's built-in date filtering capabilities and ensures temporal logic is mathematically robust, which is the cornerstone of the entire balance calculation engine.

## 2. Over-Engineering the Balance Calculation Algorithm
**The AI's Suggestion:** When asked how to calculate balances, the AI generated a massive, 200-line "Simplify Debts" graph optimization algorithm using Min-Cost Max-Flow logic.
**My Correction:** I evaluated the code and realized it violated a core product requirement: Rohan wanted *total transparency* into exactly who owed what for which expense. The AI's algorithm obscured this by routing debts through third parties (creating "magic numbers"). I deleted the AI's complex graph algorithm and wrote a much simpler `O(N)` direct pairwise aggregation ledger. This ensured the balance summary page could show Rohan a precise, auditable breakdown of every expense that contributed to his debt.

## 3. Ignoring Null Values in Edge Cases
**The AI's Suggestion:** During the implementation of the CSV parsing logic, the AI wrote a function to filter active members for an expense:
`members.filter(m => expense.date >= m.joinedAt && expense.date <= m.leftAt)`
**My Correction:** The AI completely forgot to handle the most common state: active members who haven't left yet! If an active member is still living in the apartment, `leftAt` is `null` in the database. The AI's logic would evaluate `expense.date <= null` (which is false or throws an error in TS), excluding everyone currently living in the apartment from paying the bill. I corrected the logic to:
`members.filter(m => expense.date >= m.joinedAt && (m.leftAt === null || expense.date <= m.leftAt))`

These instances reinforced that while AI is an excellent tool for speed and boilerplate, it cannot replace deep product understanding, domain modeling, and edge-case testing.
