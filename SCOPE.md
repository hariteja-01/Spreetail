# Project Scope: FairShare

## Overview
This document outlines the scope of the FairShare application, focusing on how we handle the extremely messy `expenses_export.csv` data and the database schema designed to support these complex real-world use cases.

## CSV Anomaly Handling Policies

Here is the exhaustive list of data anomalies I detected in the provided CSV file, and the exact policy implemented to handle each one during the import process:

| Row # | Anomaly Detected | Handling Policy |
|-------|------------------|-----------------|
| **5 & 6** | **Exact Duplicate**: Same payer (Dev), amount (3200 INR), date, and splits. One has a note ("Dev visiting..."), the other doesn't. | **Auto-Merge**: The system detects the duplicate via an integrity hash. It merges the entries, keeping the row with the descriptive `notes` and discarding the empty one. |
| **9, 11, 27** | **Inconsistent Payer Names**: "priya", "Priya S", "rohan " (with space). | **Normalization**: Names are strictly lowercased, trimmed of whitespace, and mapped to the standardized user list (e.g., "Priya S" -> "Priya"). |
| **14** | **Settlement as Expense**: "Rohan paid Aisha back" (5000 INR) with no `split_type`. | **Type Conversion**: Converted from an `Expense` entity to a `Payment` entity. This reduces Rohan's debt to Aisha instead of treating it as a split bill. |
| **15** | **Invalid Percentage Math**: 30% + 30% + 30% + 20% = 110%. | **Proportional Normalization**: The system recalculates the percentages to sum strictly to 100% (27.27% each for the first three, 18.18% for Meera) and flags a warning in the Import Report. |
| **16-19, 27** | **Inconsistent Date Formats**: Mix of `YYYY-MM-DD`, `DD/MM/YYYY`, and `MMM DD`. | **Multi-Format Parsing**: Passed through an array of strict format parsers. Ambiguous dates are flagged for user review. |
| **20, 21, 23** | **Multi-Currency Mix**: USD entries mixed with INR. | **Currency Conversion**: Detected via the `currency` column. Converted to the base currency (INR) using a fixed exchange rate (1 USD = 83 INR) for balance aggregation. |
| **23** | **Unregistered Participant**: "Dev's friend Kabir" included in the split. | **Guest Account Creation**: Created a virtual "Guest" user linked to Dev to ensure the math balances without requiring Kabir to register. |
| **24 & 25** | **Conflicting Near-Duplicates**: "Dinner at Thalassa" (Aisha, 2400) vs "Thalassa dinner" (Rohan, 2450) on the same date. | **Manual Resolution Flag**: Too ambiguous to auto-merge. Flagged in the UI as a "Conflict" requiring the user to explicitly choose one to keep or keep both. |
| **26** | **Negative Amount (Refund)**: Dev logged "-30 USD" for parasailing. | **Refund Processing**: Handled as an inverse expense. Instead of Dev paying for others, Dev receives money, making Dev owe the others their equal share of the 30 USD. |
| **28** | **Missing Currency**: `2105,,equal`. | **Base Defaulting**: Null currencies automatically default to the group's primary currency (INR). |
| **31** | **Zero Amount Expense**: `0 INR`. | **Exclusion**: Zero-amount expenses are flagged and automatically skipped to prevent polluting the database. |
| **34** | **Ambiguous Date**: `04/05/2026` (Apr 5 or May 4). | **Chronological Inference / Warning**: Based on surrounding dates, defaults to `DD/MM/YYYY` (May 4), but triggers a high-priority warning in the import wizard for user confirmation. |
| **36** | **Temporal Ghost Member**: April 2 Groceries split includes Meera, but she left March 31. | **Temporal Pruning**: The system cross-references the expense date against `GroupMember.leftAt`. Meera is forcefully removed from the split, and the cost is equally redistributed among the remaining active members. |
| **38** | **Deposit as Expense**: "Sam deposit share" (15000). | **Type Conversion**: Same as Row 14, converted to a direct `Payment` (Settlement). |
| **42** | **Conflicting Split Instructions**: `split_type` is equal, but `split_details` has shares. | **Explicit Override**: Explicit details (shares) take precedence over general types (equal). The system processes it as shares and logs a warning. |

## Database Schema (Prisma) & Justification

To handle the complexity above, especially temporal membership and varied split types, I designed the following schema:

### `User`
- `id` (String, UUID)
- `name` (String)
- `email` (String, unique)
- `password` (String)
- *Justification*: Standard authentication table.

### `Group`
- `id` (String, UUID)
- `name` (String)
- `currency` (String, default: "INR")
- *Justification*: Acts as the container for all related expenses and memberships.

### `GroupMember`
- `id` (String, UUID)
- `userId` (String)
- `groupId` (String)
- `joinedAt` (DateTime) - **Crucial for Sam joining in April.**
- `leftAt` (DateTime?) - **Crucial for Meera leaving in March.**
- *Justification*: Instead of a simple many-to-many join table, tracking the exact temporal bounds of membership is the *only* way to correctly exclude former or future roommates from recurring or delayed expenses.

### `Expense`
- `id` (String, UUID)
- `groupId` (String)
- `paidById` (String)
- `description` (String)
- `amount` (Float)
- `currency` (String)
- `date` (DateTime)
- `splitType` (Enum: EQUAL, PERCENTAGE, SHARES, EXACT)
- *Justification*: Stores the receipt-level metadata. Separating the overall expense from the individual splits allows flexibility for multi-payer or complex splits later.

### `ExpenseSplit`
- `id` (String, UUID)
- `expenseId` (String)
- `userId` (String)
- `amount` (Float) - The final calculated debt in the base currency.
- `shareValue` (Float?) - The original percentage or share count (e.g., "30" for 30%).
- *Justification*: This is the magic table. Regardless of how complicated the split math is (percentages, shares, etc.), the *result* is always stored here as a hard dollar amount. This makes balance calculations incredibly fast (just summing amounts) without needing to re-parse percentages on the fly.

### `Payment` (Settlement)
- `id` (String, UUID)
- `groupId` (String)
- `payerId` (String)
- `payeeId` (String)
- `amount` (Float)
- `date` (DateTime)
- *Justification*: Tracks direct transfers (like Rohan paying Aisha back). These reduce debts and are kept completely separate from shared `Expenses`.

### `ImportReport` & `ImportAnomaly`
- *Justification*: Temporarily stores the JSON payload of the uploaded CSV so the user can review anomalies, tweak decisions, and then explicitly "Commit" the import to the main tables.
