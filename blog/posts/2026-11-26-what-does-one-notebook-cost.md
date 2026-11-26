---
title: What does one notebook cost?
description: A materials-costing lesson. Count the misprints and the torn cover, predict the cost of a print run, and undo the entry without losing a cent.
date: 2026-11-26
draft: false
---

Twenty-four notebooks are ready to pack. Each one contains twelve sheets and one cover. On the cutting table there are also twelve misprinted sheets and a torn cover. How many sheets and covers should come off the shelf?

The answer you give changes the cost of every notebook, even the ones that came out perfectly. [Open the notebook run in Batch Ledger.](/batch-ledger-lab/#notebooks)

<!--more-->

The bindery paid $81 for 900 sheets, or nine cents a sheet. It paid $30 for 120 covers, or a quarter each. If you count only the finished books, the run cost $31.92. That leaves material on the books that you can find only in the recycling bin.

Try the **Notebook run**. The boxes already contain the counts from the cutting table. Before selecting **Preview cost**, work out what the discarded material adds. Twelve sheets cost $1.08. The cover adds 25 cents. That brings the total to **$33.25**, about **$1.39 per finished notebook**. The ledger keeps the exact total in cents. Multiplying the rounded unit average by 24 would give you $33.36.

Now select **Post batch**. There should be 600 sheets and 95 covers left. Suppose the foreman tells you the cover was only scuffed and went back on the shelf. Choose **Reverse this batch**, set cover scrap to zero, then preview and post again. You should see $33.00 in materials, 600 sheets and 96 covers. The CSV lets you see the original entry, the reversal and the correction side by side.

The other sheet is the candle example from an October batch-import prototype. Try reversing the **$40.20** run and check how many grams and cents come back to each lot. The calculation covers materials. What you pay the binder and what you charge for the notebook are separate questions.
