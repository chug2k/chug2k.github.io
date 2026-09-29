---
title: I rewired a shoe dryer with Gemini and almost got yelled at by physics
description: A multi-week SD-68 saga — melted Barricades, eldritch funk, Shopee blowers, WAGOs, and the 5-on/5-off trick that finally works.
date: 2026-09-29
---

Being married to an engineer can be tough sometimes — especially if he sweats through his shoes, soaking wet, every time he plays pickleball. Sometimes through two pairs.

This one started with an SD-68 / FujiHome shoe dryer that sux, and somehow turned into the coolest and fucking craziest thing I've ever done.

This is the saga. Bring a snack.

## Chapter 1: The dryer that melts shoes

Saigon humidity is rude. You come back from pickleball or a rainy commute and your shoes are a wet crime scene. So I bought one of those upright shoe dryers — the SD-68 — the kind with nozzles that shove air up into each shoe, a little cabinet, timers, even an ozone button for people who think ozone is a personality.

Out of the box it did one thing extremely well: cook shoes.

There was no switch for "just one heater." The UI doesn't offer that. Shoe glue. EVA / PEBA midsoles. The adhesives that hold a pair of Barricades together. I learned that the expensive way. Ruined a pair. Not "a little crispy." Ruined.

So I opened the damn thing — which I never would have done without an AI safety blanket walking me through 220V death notes and "don't short those leads" — and discovered there were actually *two* heater elements inside. Gemini later told me they're PTC ceramic with bimetal thermal switches, probably hanging out around 65–85°C in the housing — fine for towels, catastrophic for modern running shoes. Cool. Great product design. Perfect.

I disconnected one first. Still cooked. Then I cut both. Wiring freed from service. Problem solved. No more melting.

Also: no more drying.

![Opened cabinet — stock blowers, heater wires freed from service](/blog/assets/shoe-dryer/01-internals-wiring-fans.jpg)

## Chapter 2: The fans are weak as shit

With heaters gone, all I had left were the stock blowers. Generic 12V 7530 centrifugal fans. Looking at the labels and Gemini's guesses: maybe 2,000–2,500 RPM, under 8 CFM, drawing something pathetic like 0.15–0.25A each. They whispered air. They did not dry shoes.

What they *did* do was keep the midsoles politely humid while delivering nice fresh oxygen to whatever was living in there.

Not "a little sweaty" foul. Eldritch-horror-morning-breath-after-vomiting-from-too-much-booze foul. The kind of smell that makes you renegotiate your relationship with the concept of footwear.

![Stock blower label — 12V, 7530, politely useless](/blog/assets/shoe-dryer/24-installed-blower-label.jpg)

![Control board — two relays, a yellow transformer, and vibes](/blog/assets/shoe-dryer/04-control-board-wiring.jpg)

Gemini also pointed out that once you disconnect the PTCs, those cream heater housings become airflow bricks. Dense ceramic honeycomb / fin matrix sitting in the path like a traffic cone. Predicted 40–70% more nozzle air if you gut them. I tried to understand how. The assembly was glued, fused, metal/ceramic, and I am not dying for a shoe dryer. The housings stayed. The fans stayed weak. The smell got worse.

## Chapter 3: Floor fan era (eldritch farts, confined)

For a while I gave up on the cabinet as a machine and used it as... furniture that holds shoes while a massive floor fan screams at them.

That works alright. The ergonomics are so bad. You have to balance the insoles like you're playing Jenga with laundry. Point the fan. Reposition. Forget. Come back. Still damp in the toe box.

When I kept the shoes *inside* the dryer cabinet with the door open and the floor fan blasting into it, it just recirculated funk into every plastic corner. Eldritch farts, confined. The cabinet became a smell amplifier. I moved things around. I hated it. Jihye hated it. The shoes were technically drying but my life was worse.

There had to be a better way that didn't involve dedicating a corner of the apartment to a festival of wet rubber.

## Chapter 4: Fuck this is harder than software

I went back to Gemini with photos. Internals. PCB. Heater housings. Thermal snap switches. Blower labels. The whole crime scene.

Gemini kept reminding me the cabinet has lethal 220V AC in it, which is correct and also the kind of thing you want a chatbot to say more than once when you're holding a phone over an open appliance at 1am.

It also kept contradicting itself — including about whether to open the front door to "help airflow" on a unit that exhausts top/rear. I called it out. ("Yes you just fucking told me to open the door.") Gemini admitted it. Bottom-to-top path; opening the front short-circuits the intended flow. Keep the door closed. Ask me how I know.

![Heater housing — where air goes to die once the PTC is gone](/blog/assets/shoe-dryer/07-heater-element-housing.jpg)

![Thermostat / snap switch area — the little metal liar](/blog/assets/shoe-dryer/06-heater-thermostat-closeup.jpg)

Somewhere in this stretch I said out loud: fuck this is harder than software. Because it is. Software doesn't smell like ozone and shoe bacteria. Software doesn't have a bimetal disc deciding your night.

## Chapter 5: Shopee shopping montage

Gemini said the stock board maybe supplies 0.5–0.8A total at 12V. So you cannot hang serious blowers off it unless you enjoy magic smoke.

We went hunting on Shopee for 7530 centrifugal upgrades. Dual ball bearing, not sleeve. 12V preferred over the weird 24V listings that were often slower anyway. Spec tables in Chinese. Titles that say 5V/12V/24V like a personality disorder.

![Blower shopping — 7530 candidates in the wild](/blog/assets/shoe-dryer/12-blower-listing.jpg)

![Spec table — current, RPM, noise, the good stuff](/blog/assets/shoe-dryer/14-blower-specs.jpg)

The ones I actually bought landed around: 12V, ~0.56A each, ~6.72W, 6,000 RPM ±10%, dual ball, ~49 dBA, standard 75×75×30mm footprint, 39×30mm outlet. Loud in a way that feels like progress.

Then the support cast:

![12V 2A wall wart — because the stock board said no](/blog/assets/shoe-dryer/17-power-adapter-listing.jpg)

![DC barrel / screw-terminal stuff — 5.5×2.1mm world](/blog/assets/shoe-dryer/20-power-supply-listing.jpg)

![WAGO / lever connectors — because soldering at midnight is a personality flaw](/blog/assets/shoe-dryer/22-connectors-wago-listing.jpg)

Gemini wanted a PWM controller at one point. I looked at the listings, felt the subplot expanding, and chose a basic on/off switch instead. Rejected the ESP32 + SHT31 + MOSFET humidity-closed-loop fanfic. Simple was enough.

### Parts / price list (approx, Shopee VN, Sep 2026)

| What | Rough price | Notes |
| --- | --- | --- |
| 2× high-speed 12V 7530 blowers (~0.56A, ~6k RPM, dual ball) | ~170k₫ each (VIP lower) | The whole point |
| 12V ~2A wall adapter | ~51k₫ | External power; don't feed new fans from the SD-68 board |
| DC 5.5×2.1 female barrel / pigtail bits | ~15k₫ | Screw terminals or prewired female |
| Lever connectors (WAGO 221-413 or PCT 3-port clones) | ~27k–57k₫ for a small pack of clones; real WAGOs way more | Parallel the two fans; red=+ / black=−; tape off yellow/blue |
| Inline on/off switch | cheap | Skipped PWM drama |
| **Ballpark total** | **under ~500k₫** | Plus the dryer you already own and the Barricades you already murdered |

Prices move. Vouchers lie. Your cart will have 90 unrelated things in it. That's fine.

## Chapter 6: First power-on (loud, wet, confusing)

Wired the new blowers in parallel off the external supply. Red to +, black to −, yellow/blue insulated and ignored. WAGO levers. Bench test first so I didn't invent a fire inside the plastic tomb.

![Bench setup — blower, wires, the whole crime scene](/blog/assets/shoe-dryer/26-bench-test-setup.jpg)

Dude, it's so much louder which is awesome. But honestly it didn't *feel* that much more air in my hand at first. Gemini had to explain: centrifugal blowers are a narrow high-pressure jet, not an 18-inch floor fan. Paper test. Aim matters.

Installed them. Ran both for about an hour. Shoes still soaked.

So the problem wasn't only "fans too weak." It was also geometry and humidity. Shoes sitting wrong. Air dispersing around them instead of flushing the cavities. Balcony RH hanging at 80–90%. Fan-only drying in Saigon is a character-building exercise.

I reconnected one heater.

Gemini's pitch: warm the 85% RH air by ~8–10°C and the effective humidity drops; the strong blowers keep it from becoming the old stagnant hot spots. Target feel: roughly 35–42°C air, not "melt the Barricades again" air.

Twelve minutes later: shoes surprisingly not hot. Air inside was warm. That was the first moment it felt like the machine and I were on the same team.

## Chapter 7: Ozone, regret, and going back outside

I moved the unit indoors once because I'm an optimist.

It smelled like ass. Heated shoe bacteria. Isovaleric acid. Warm synthetic/EVA off-gassing. Gemini said put it back outside. Correct.

Then I tried the ozone function, because the button exists and buttons demand to be pressed. Room smelled like ozone mixed with shoe. I asked Gemini if I was going to die. Gemini said ventilate and don't hang out in ozone soup. Ozone helped the insole smell a bit. It did not dry anything. Ozone is not airflow. Learned that with my nose.

## Chapter 8: The timer epiphany

Here's the part the product almost understood and then fumbled.

The SD-68 has a 12-hour intermittent mode: about 5 minutes on, 5 minutes off, for up to 12 hours. Or you can run continuous, but continuous maxes out around 6 hours.

With the weak stock fans, 6 hours of continuous did nothing useful. The intermittent mode was even more nothing — brief wheezes of warm disappointment.

What I actually needed was **long air**. Like 12 hours of pure blow. Continuous fans. And *then* a little heat that doesn't cook the glue.

Now the fans are on separate power, so they can run forever. The heater stays on the stock 5-on / 5-off cycle.

And the surprise: the stronger airflow doesn't cook the shoes as much. The intermittent heat just lightly warms them. That bit of warmth is enough to help shit evaporate. It's glorious.

Same cabinet. Same intermittent firmware / bimetal nonsense. Different air. Suddenly the mode that was useless becomes the whole point.

![Full guts — final layout](/blog/assets/shoe-dryer/27-internals-full-view.jpg)

![The shoes. Finally not a crime scene.](/blog/assets/shoe-dryer/25-shoes-before-after.jpg)

## Chapter 9: What I didn't do (and might still)

Gemini kept offering boss-fight upgrades:

- Swap the thermal snap disc for a 40–45°C normally-closed KSD301-style switch
- Inline SCR / dimmer games with PTC heaters (nonlinear, cursed)
- ESP32 + humidity sensor + MOSFET cutout when dry enough
- Tuya / Sonoff smart relay subplot

I didn't do those. Yet. The separate continuous fans + one intermittent heater is already a win. If I touch the mains thermostat path again, I'll do it sober, outdoors, and with less trust in chatbot door advice.

## Epilogue

I started by cutting two wires so my shoes wouldn't melt. I ended with a louder machine, a Shopee cart full of blowers and lever nuts, a balcony that smells less like eldritch brunch, and a weird respect for airflow.

God this is the coolest and fucking craziest thing I've ever done.

Also: do not trust a chatbot about opening the door on a bottom-to-top exhaust path. Ask me how I know.
