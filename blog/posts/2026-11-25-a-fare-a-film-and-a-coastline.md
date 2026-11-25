---
title: A fare, a film cut and a coastline
description: Three hands-on lessons in checking an answer. Break a tie in SQL, repair a 36-second film cut, and measure a shoreline with two different rulers.
date: 2026-11-25
draft: false
---

A film editor hands you a 36-second cut. The approved cue sheet also adds up to 36 seconds. Would you sign off? In one of these lessons, every single cue is wrong.

Here are three little experiments you can run in a browser. For each one, make a prediction before you press the button.

<!--more-->

# A film cut that passes the stopwatch

Start with the lunch delivery in *Right Total, Wrong Door*. There are 17 packs for the Ink table and 18 for Fold. Six people change tables. The runner still has 35 lunches. Decide whether to send the trays.

Then try the editing desk with the instructor key closed. Hit **Check this cut** on the first export, fix the three cue lengths, and check it again. Both versions run for 36 seconds. The test that catches the mistake compares each cue ID with its approved duration. You can try a fresh sheet to see whether that test still works. [Try Right Total, Wrong Door.](/right-total-wrong-door/) · [Print the three-page handout.](/right-total-wrong-door/right-total-wrong-door.pdf)

# The third-cheapest ferry

In *Three Cheapest Crossings*, the starter SQL finds one sailing to Reed Steps for four credits. Change it to return the three cheapest sailings. Before you turn on **Add tied fares**, decide what should happen if three six-credit boats are competing for two places.

The assignment promises the lower sailing ID first when fares tie. Put that promise into your query with a second sort column. With the extra boats in the ledger, the IDs should come back as `14`, `19`, `27`, in that order. Try explaining why sailing `41` misses the cut even though its fare is also six. [Run the SQL lesson.](https://clpanic.com/three-cheapest-crossings/)

# What changes when the ruler shrinks?

For a drawing exercise, open Prízrak’s *The Coastline Problem*. Draw a straight stroke and select **Run the survey**. Read the field log from the coarsest ruler to the finest. Choose **Survey another shore**, draw a jagged line between roughly the same endpoints, and predict which way its measured length will move.

A long ruler can step across a bend. A shorter one can follow it. Compare the readings *within each drawing*, where the instrument keeps the same scale. An almost straight stroke should change little. On a zigzag, see which ruler starts to pick up the teeth you drew. The readings describe the finite line on your screen. [Draw and measure a shore in Prízrak’s instrument.](https://offerings-eight.vercel.app/the-coastline-problem)
