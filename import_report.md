# FairShare Import Report

## Overview
This report documents the anomalies detected and resolved by the FairShare Import Engine when ingesting the provided `expenses_export.csv` file. 

The system operates on a "strict validation, interactive resolution" philosophy. It automatically resolves unambiguous formatting issues and mathematical normalization, while flagging logical conflicts or missing crucial data for manual review.

## Anomaly Resolution Log

### Global Anomalies (File-Level Issues)
None detected in this file format that required full rejection.

### Row-Level Expense Anomalies

| Row | Expense Description | Detected Anomaly | Resolution Action | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Row 5 & 6** | Dinner at Marina Bites / dinner - marina bites | **Conflict Duplicate Detected:** Similar expense exists: "Dinner at Marina Bites". | **Requires manual review:** Flagged in UI for the user to explicitly keep, merge, or delete. | <span style="color:red">CONFLICT</span> |
| **Row 9** | Movie night snacks | **Name Inconsistency:** "Priya S" | **Normalized:** Mapped to standardized user "Priya" | <span style="color:blue">INFO</span> |
| **Row 11** | Groceries BigBasket | **Name Inconsistency:** "rohan " | **Normalized:** Mapped to standardized user "Rohan" | <span style="color:blue">INFO</span> |
| **Row 14** | Rohan paid Aisha back | **Settlement as Expense:** No split type provided for a direct payment. | **Type Conversion:** Converted from an Expense to a Payment entity to accurately reduce debt. | <span style="color:orange">WARNING</span> |
| **Row 15** | Weekend trip petrol | **Invalid Percentage Math:** Percentages (30+30+30+20) sum to 110%. | **Proportional Normalization:** Recalculated to sum exactly to 100% (27.27% each for first three, 18.18% for the last). | <span style="color:orange">WARNING</span> |
| **Row 16-19, 27** | Various (Groceries, Maid, etc.) | **Inconsistent Date Formats:** YYYY-MM-DD, DD/MM/YYYY, MMM DD mixed. | **Date Parsing:** Normalized to strict ISO Datetime objects. | <span style="color:blue">INFO</span> |
| **Row 20, 21, 23** | Flight tickets, Hotel, Museum | **Multi-Currency Mix:** Logged in USD instead of base currency (INR). | **Currency Conversion:** Converted to INR at a fixed rate (1 USD = 83 INR) for balance calculations. | <span style="color:blue">INFO</span> |
| **Row 23** | Museum tickets | **Unregistered Participant:** "Dev's friend Kabir" | **Guest Account Assignment:** Created virtual guest user linked to Dev to ensure math balances. | <span style="color:orange">WARNING</span> |
| **Row 24 & 25** | Dinner at Thalassa / Thalassa dinner | **Near-Duplicate:** Conflicting amounts (2400 vs 2450) on same date. | **Requires manual review:** Flagged in UI for explicit user resolution. | <span style="color:red">CONFLICT</span> |
| **Row 26** | Parasailing refund | **Negative Amount:** Dev logged "-30 USD". | **Refund Processing:** Handled as an inverse expense (Dev receives money, owes others their share). | <span style="color:orange">WARNING</span> |
| **Row 28** | Unknown | **Missing Currency:** No currency specified. | **Base Defaulting:** Auto-defaulted to group's primary currency (INR). | <span style="color:blue">INFO</span> |
| **Row 31** | Empty/Mistake | **Zero Amount:** Logged as "0 INR". | **Exclusion:** Skipped entirely to prevent DB pollution. | <span style="color:orange">WARNING</span> |
| **Row 34** | Cab to airport | **Ambiguous Date:** "04/05/2026" | **Chronological Inference:** Contextual assumption made as May 4th. Flagged for review. | <span style="color:orange">WARNING</span> |
| **Row 36** | April Groceries | **Temporal Ghost Member:** Split includes Meera, but she left March 31. | **Temporal Pruning:** Meera forcefully removed from split. Cost redistributed to active members. | <span style="color:red">CONFLICT</span> |
| **Row 38** | Sam deposit share | **Deposit as Expense:** 15000 logged. | **Type Conversion:** Converted to a direct Settlement Payment. | <span style="color:orange">WARNING</span> |
| **Row 42** | Dinner | **Conflicting Split Instructions:** Type is "equal" but "shares" are detailed. | **Explicit Override:** Explicit share details take precedence over the general "equal" type string. | <span style="color:orange">WARNING</span> |
