---
title: What is an agent?
description: Who starts the work? Who decides what happens next? Try the same vending machine three ways. Then give an account manager forty fictional accounts, advance the clock, and watch which ones it leaves alone.
date: 2026-11-25
draft: false
---

<!-- passage: opening-01 -->
What is an agent? · Tasks vs. Agents

<!-- passage: headline -->
You're not asking it\
to do a thing.\
You *hired* it.

<!-- passage: standfirst -->
Most people can't tell an "agent" apart from a clever request to a chatbot. The line is real, and it's not about how many steps something takes. It's about who's holding the steering wheel — and whether anyone's even in the car.

<!-- passage: judgment-01 -->
§ 01 — The confusion worth clearing up

<!-- passage: judgment-02 -->
"Summarize this" is not an agent.

<!-- passage: judgment-03 -->
Ask a chatbot to summarize an email thread and it reads, writes, done. One call. No decisions, no tools, nobody to manage. That's a **task**. It's useful — most of what we do with these models is tasks — but it's a vending machine. Coin in, snack out.

<!-- passage: judgment-04 -->
The word "agent" gets thrown at anything that takes more than one step, which is where the muddle starts. Multi-step isn't the dividing line. A recipe has many steps and isn't an agent. The real axis is **how much judgment lives between the trigger and the action**, and crucially, *who pulls the trigger.*

<!-- passage: judgment-05 -->
Task

<!-- passage: judgment-06 -->
**You prompt → one answer.**

<!-- passage: judgment-07 -->
"Summarize this." Zero decisions. The vending machine.

<!-- passage: judgment-08 -->
Multi-step\
(reactive)

<!-- passage: judgment-09 -->
**You prompt → it loops with tools → it stops and waits.**

<!-- passage: judgment-10 -->
"Research the best pickleball shoes under $120." It searches, reads, searches again, decides when it has enough. Genuinely agentic *behavior* — but it's asleep until you poke it. Still a vending machine, just a smart one.

<!-- passage: judgment-11 -->
Managed\
agent

<!-- passage: judgment-12 -->
**Something else prompts it → it decides whether to even act.**

<!-- passage: judgment-13 -->
A clock ticks. A webhook fires. A condition changes. It wakes up, looks at the world, and most of the time decides to do *nothing* — and that choice to stay quiet is the agentic part. Now you're not driving. You're supervising.

<!-- passage: judgment-14 -->
That third row is the leap. The thing that makes it *feel* like an agent isn't the loop — it's that no human typed a prompt to start it. It has a job, and it shows up to do it.

<!-- passage: vending-01 -->
§ 01¼ — Feel the difference

<!-- passage: vending-02 -->
The same machine, three ways.

<!-- passage: vending-03 -->
A vending machine is the cleanest picture of the whole spectrum, because you can *watch* the wheel change hands. Climb the levels. At each one, notice how much **you** do versus how much the **machine** does — and who decides to start.

<!-- passage: vending-04 -->
Watch the three vending machines in 22 seconds

<!-- passage: vending-05 -->
First you put in a coin and choose cola. Next you put in a coin and the clock helps the machine choose coffee. Finally the machine watches on its own. It sends water when the day gets warm and waits when the glass is still half full.

<!-- passage: senses-01 -->
§ 01½ — What it can see

<!-- passage: senses-02 -->
An agent is only as smart as its senses.

<!-- passage: senses-03 -->
That clock in the corner of the LCD wasn't decoration — it's the one and only thing the vending machine can *perceive*. The model can be brilliant, the loop can be tight, but at level 3 it's reasoning about a single sensor: the time. That's why even the agent version still feels a little thin. It only knows what hour it is.

<!-- passage: senses-04 -->
Now imagine you bolt on more. Same model. Same loop. Same dispenser. The only thing that changes is what it can look at:

<!-- passage: senses-05 -->
+ Weather

<!-- passage: senses-06 -->
**95°F outside, AC just kicked off.**

<!-- passage: senses-07 -->
Cold drinks float to the top. A hot day reads differently than the calendar saying "3 PM" — neither sensor on its own gets it right.

<!-- passage: senses-08 -->
+ Calendar

<!-- passage: senses-09 -->
**Sales call in 90 seconds.**

<!-- passage: senses-10 -->
Suggests something portable, no foam, nothing it'll spend the next minute pouring. The clock alone says "3 PM, fine." The calendar says "you're about to be on camera."

<!-- passage: senses-11 -->
+ Badge tap

<!-- passage: senses-12 -->
**It's you again — third visit today.**

<!-- passage: senses-13 -->
Recognizes you, remembers the two coffees, doesn't push a third. Personalization isn't a feature, it's a sensor with memory attached.

<!-- passage: senses-14 -->
+ Inventory

<!-- passage: senses-15 -->
**Iced coffee just ran out.**

<!-- passage: senses-16 -->
Doesn't recommend what it can't dispense. Embarrassingly basic — also the kind of thing that distinguishes a working agent from a demo.

<!-- passage: senses-17 -->
The model thinks. The sensors give it something to think about.

<!-- passage: senses-18 -->
This generalizes, and it's the half of agent-building everyone underestimates. The AM you'll meet in a few sections has sensors too: renewal dates, account-health scores, news feeds, a people-signal feed for job moves. Same pattern. *The clock isn't the only sensor — the clock is just the cheapest one everyone starts with.*

<!-- passage: senses-19 -->
So before you ask *what should the agent do*, ask **what does it need to see**. Half the work of a useful agent lives in that question, and most failed agent demos fail there — not in the reasoning, in the perception.

<!-- passage: field-notes-01 -->
§ 01¾ — Field notes from the wild

<!-- passage: field-notes-02 -->
People genuinely can't tell.

<!-- passage: field-notes-03 -->
Ask a room full of enthusiastic users what they do with AI *agents* and almost everyone answers with chatbot use cases — brilliantly used, but chatbots. It's not a dumb mistake. The line is subtle, and people keep catching themselves mid-sentence. Three real ones, lightly edited:

<!-- passage: field-notes-04 -->
"Apparently myself (and many others) misunderstood the difference between a Chatbot and an 'Agent'. A chatbot has access to a data source and responds to prompts whereas an agent takes action on your behalf."

<!-- passage: field-notes-05 -->
— u/Philobus · then described a pure chatbot use case two sentences later

<!-- passage: field-notes-06 -->
"90% of people in these comments don't know what an AI Agent is."

<!-- passage: field-notes-07 -->
— u/wilsonifl · roughly correct

<!-- passage: field-notes-08 -->
"They'll say this model's agentic.. and it's just like a web search tool. So people think normal LLMs are agentic and have no clue otherwise, because it's advertised that way everywhere by major AI companies."

<!-- passage: field-notes-09 -->
— u/Jogdoffondaplg2ce · the actual root cause

<!-- passage: field-notes-10 -->
So before the theory, a gut check. Here are real things real people said they use AI for. For each one, make the call: is it an **agent** — something that takes action on your behalf, on its own — or just a very good **chatbot** you act on yourself?

<!-- passage: field-notes-11 -->
The split you just felt — most of them are chatbots — is the whole point. Genuinely useful, genuinely not agents. An agent is the rare one that *does something in the world without you driving each step*. Now the theory will actually stick.

<!-- passage: hiring-01 -->
§ 02 — The frame that actually works

<!-- passage: hiring-02 -->
Stop thinking "automation." Think "hiring."

<!-- passage: hiring-03 -->
The cleanest mental model isn't in any framework doc. It's this: **what would a person you hired do?** A human employee already *is* a trigger, a loop, tools, memory, and judgment all bundled together — and nobody had to explain any of that to you. So borrow it.

<!-- passage: hiring-04 -->
You don't tell a hire "at 9:00 do X, at 9:05 do Y." You give them a job and they figure out the steps.

<!-- passage: hiring-05 -->
Watch how every piece of the architecture maps onto something obvious about employing a person:

<!-- passage: hiring-06 -->
① They have a job, not a script.

<!-- passage: hiring-07 -->
"Own the renewals." They work out the steps themselves. That's *goal-not-instructions* — the prompt defines a role, not a procedure.

<!-- passage: hiring-08 -->
② They notice things on their own.

<!-- passage: hiring-09 -->
They don't sit frozen waiting to be poked. A request lands, they handle it; a slow afternoon, they get ahead. *You don't cron a person* — they have a calendar and they can see their inbox. The "trigger problem" solves itself when the employee manages their own attention.

<!-- passage: hiring-10 -->
③ They escalate.

<!-- passage: hiring-11 -->
Routine thing, they just handle it. Weird or expensive thing, they walk over and ask. The permission boundary is literally *seniority* — a junior checks more, a senior you trust to act.

<!-- passage: hiring-12 -->
④ They report back.

<!-- passage: hiring-13 -->
End of day: "handled 12, drafted 3 for your review, flagged one." You're not watching them work. You're getting the summary. That's supervision instead of driving.

<!-- passage: hiring-14 -->
So "managed agents" collapses into something you already know how to think about: **you scoped a job, set what they can do solo versus check with you on, and they tell you what they did.** All the cron-vs-webhook-vs-queue stuff is just "how does this employee know it's time to work." For a person the answer is eyes and a clock — boring plumbing we don't notice because it comes standard. For an agent you have to wire it up, but it's the same boring plumbing.

<!-- passage: hiring-15 -->
Where the analogy breaks — say this out loud

<!-- passage: hiring-16 -->
A new human hire is dumb in week one and sharp by month three. An agent is exactly as sharp every time it wakes up — it doesn't learn your accounts unless you *build* memory in. So it's less "hiring someone" and more **"hiring someone with great instincts and total amnesia, who re-reads the same onboarding doc every morning."** Which tells you something load-bearing: the onboarding doc — the prompt, the examples, the guardrails — *is* the employee. With a person that doc decays in relevance as they learn. With an agent, it's the whole job.

<!-- passage: account-manager-01 -->
§ 03 — A worked example, deliberately not customer service

<!-- passage: account-manager-02 -->
Let's hire an Account Manager.

<!-- passage: account-manager-03 -->
Customer service is the easy demo — it's reactive, a ticket comes in and you answer it. Boring. A great **Account Manager** is a far better example because the job isn't reactive at all. An AM *owns a book of business* and works it proactively. They're never surprised and always early. That "always early" is exactly the thing people don't realize is now automatable.

<!-- passage: account-manager-04 -->
The mediocre AM processes renewals. The amazing one is running a quiet intelligence operation on every account. So the real thesis here:

<!-- passage: account-manager-05 -->
The leap isn't automating the AM's tasks. It's automating the AM's *attention.*

<!-- passage: account-manager-06 -->
The tasks — send the renewal email, route the ticket, grant the discount — are the boring 20%. The 80% that makes a great AM great is **deciding what to pay attention to**: across the whole book, against the open world, over time. A chatbot can't do that. An agent with tools, memory, and its own clock can start to. Here's what a world-class AM actually does, and note how little of it is reactive:

<!-- passage: account-manager-07 -->
They know before you do.

<!-- passage: account-manager-08 -->
The client raised a Series B → that's an expansion conversation, not a renewal. New regulation hit their industry → proactive outreach. And the dangerous one: **the champion just changed their LinkedIn headline to a new company.** Your internal advocate is leaving — and you also just got a warm lead wherever they landed. One signal, two plays. None of this is in your CRM. It's out in the world.

<!-- passage: account-manager-09 -->
They connect dots across the book.

<!-- passage: account-manager-10 -->
Three accounts asked about the same missing feature this month → that's not three tickets, it's a product signal. A human juggling 40 accounts struggles to see it. An agent watching all of them at once is *structurally* good at this — a place it could plausibly beat the human, which is a more interesting claim than "it's as good as a person."

<!-- passage: account-manager-11 -->
They maintain relationships, not transactions.

<!-- passage: account-manager-12 -->
They schedule regular catch-ups — per *person*, not per account, because an account doesn't have a LinkedIn but people do. They notice 60 days of silence on a healthy account is *itself* a risk. They remember the client mentioned a Q3 launch and check in on it. This is where memory and proactivity compound into something a chatbot fundamentally cannot do: hold a relationship over time.

<!-- passage: account-manager-13 -->
They triage the whole book every morning.

<!-- passage: account-manager-14 -->
Not "is there a ticket" — but "rank my 40 accounts by risk and opportunity today, and tell me where to spend my attention." They walk in knowing the three accounts that need them *today* and ignore the 37 that are fine. That triage-and-prioritize move is the most senior-employee behavior there is.

<!-- passage: account-manager-15 -->
Two honest flags, because this is where it gets real

<!-- passage: account-manager-16 -->
**Scraping LinkedIn is against their ToS and they block it hard.** In a real build, "check LinkedIn" means consuming a people-intelligence *feed* — a CRM enrichment vendor, Clay, a sales-intel provider — not literally scraping. Which source is a swappable detail; the agent pattern is identical. In a toy, you just hand it a faked table of person-events.

<!-- passage: account-manager-17 -->
**And there's a privacy line.** A great human AM quietly tracking a named person's job moves is normal and nobody blinks. An automated system doing it at scale *reads* differently, even when every fact is public. Naming that shows you've thought about where this goes — not just that it's cool.

<!-- passage: responsibilities-01 -->
§ 04 — Three responsibilities, three lessons

<!-- passage: responsibilities-02 -->
The features aren't features. They're the curriculum.

<!-- passage: responsibilities-03 -->
Give the AM three jobs and each one teaches a distinct, load-bearing concept. That's why this example is worth building: it covers the whole surface without feeling like a checklist.

<!-- passage: responsibilities-04 -->
Teaches → proactive / self-scheduled triggering

<!-- passage: responsibilities-05 -->
Renewals

<!-- passage: responsibilities-06 -->
The showpiece. No human starts it — the agent works backward from renewal dates on its own clock. 90 days out it glances, 60 it checks health, 30 it reaches out. Most accounts on most days, it does nothing. *Choosing who and when* is the agentic move. This is the thing that makes it an agent and not a chatbot.

<!-- passage: responsibilities-07 -->
Teaches → classify, route, hook external systems

<!-- passage: responsibilities-08 -->
Support escalation

<!-- passage: responsibilities-09 -->
A ticket lands and the agent decides: answer it, send to eng, jump on a churn risk, or recognize a renewal conversation in disguise — then hooks the right system (open a Linear issue, ping eng in Slack, reply). The webhook fires identically every time; the *judgment* is the agent. Your event-triggered counterpart to the scheduled renewals.

<!-- passage: responsibilities-10 -->
Teaches → permission ladder / what "managed" means

<!-- passage: responsibilities-11 -->
Discounts

<!-- passage: responsibilities-12 -->
The most important one. You'd never let a new AM hand out unlimited discounts. There's a ladder — and that ladder *is* the permission boundary. Without it, discounts are the scariest thing in the build. With it, they're the whole point.

<!-- passage: responsibilities-13 -->
And catch-ups and people-monitoring aren't two more features bolted on — they're the **people layer** that turns "account manager" into "relationship manager," which is what a great one actually is.

<!-- passage: compliance-01 -->
§ 04½ — Same shape, different job

<!-- passage: compliance-02 -->
Now hire one more — somewhere weirder.

<!-- passage: compliance-03 -->
The AM isn't a special case. The pattern — own a domain, watch your sensors, decide what deserves attention today, act within your authority — runs everywhere. Here's the same shape in a totally different domain, just to prove it isn't AM-flavored.

<!-- passage: compliance-04 -->
The security-checklist person.

<!-- passage: compliance-05 -->
Every company has one — or a team, or a Notion page nobody reads. Their job: make sure every employee follows the security checklist. New hire started Monday? Confirm WARP is installed. Background check submitted but not back yet? Don't grant prod. Annual training due in 7 days? Nudge. Still not done at 0 days? Nudge again, with feeling. Escalating? Loop in their manager.

<!-- passage: compliance-06 -->
Mediocre version of this job: a quarterly spreadsheet someone audits by hand. Great version: a quiet agent watching the whole company, every day, doing nothing on most days. Sound familiar?

<!-- passage: compliance-07 -->
Same three layers from the architecture you're about to see, named for this job:

<!-- passage: compliance-08 -->
Sensors

<!-- passage: compliance-09 -->
**What it can perceive.**

<!-- passage: compliance-10 -->
HR system → new hires, terminations, role changes · MDM → is WARP running, OS up to date, disk encrypted · background-check API → status of each open check · LMS → who's completed training, who's overdue · Slack → did the nudge get an ack · calendar → is this person on PTO (don't bug them).

<!-- passage: compliance-11 -->
Reasoning

<!-- passage: compliance-12 -->
**What it decides.**

<!-- passage: compliance-13 -->
Who's out of compliance, by what, and how overdue. Have I already nudged them today (don't be the annoying agent). Is this routine, or has it crossed into "tell their manager." New-hire week is gentle; day 30 with no WARP isn't gentle.

<!-- passage: compliance-14 -->
Actuators

<!-- passage: compliance-15 -->
**What it can do.**

<!-- passage: compliance-16 -->
Slack DM the employee · email with a how-to link · ping the manager once it crosses the line · open an IT ticket when a check is stuck on someone else · mark complete when the sensor confirms it.

<!-- passage: compliance-17 -->
Two agents now — Account Manager and Security Compliance. Two domains, one shape. Renewal date maps to background-check status. People-signal feed maps to MDM. Discount cap maps to "can DM the employee but can't loop in their manager without my approval." Find the job at your company where someone is the human glue keeping a long-running thing on track, list the sensors it'd need, and you've found an agent-shaped hole.

<!-- passage: compliance-18 -->
Where the permission ladder gets real

<!-- passage: compliance-19 -->
"DM Chu about training" — easy, agent acts solo. "Revoke Chu's prod access for non-compliance" — never without a human approving. Security is the domain where the difference between *act solo* and *draft and escalate* stops being a design exercise and starts mattering. The ladder isn't paranoia — it's how the agent earns the right to keep its job.

<!-- passage: architecture-01 -->
§ 05 — How it actually hangs together

<!-- passage: architecture-02 -->
The architecture.

<!-- passage: architecture-03 -->
Strip the romance off and a proactive agent is a **dumb trigger plus a smart body.** The trigger isn't the agent any more than your alarm clock is you — it just wakes the thing up. Here's the shape:

<!-- passage: architecture-04 -->
dumb triggers wake it · the loop decides · tools act · the gate decides solo-vs-escalate · the human supervises & feeds memory

<!-- passage: architecture-05 -->
The loop, in plain words

<!-- passage: architecture-06 -->
**Something wakes it.** A clock, an event, or its own previously-set reminder. The least cronjobby version lets the agent set its *own* next wake-time — "nothing's happening, check back in 4 hours" vs. "this is hot, recheck in 5 minutes." Deciding when to care is itself an agent decision.

<!-- passage: architecture-07 -->
**It reads its memory.** Per-account and per-person state — last contact, open tickets, sentiment, prior discounts, the relationship history. Without this it has no relationship, and an AM with no memory is just a mail merge.

<!-- passage: architecture-08 -->
**It goes and gets fresh signal.** Web/news search on the company; the people-signal feed for job moves and promotions. This is the part that reaches into the actual world, not the database.

<!-- passage: architecture-09 -->
**It thinks.** Fuse account risk with people events — *champion-left on a renewal-due account = top of the list* — and rank the whole book by where attention should go today.

<!-- passage: architecture-10 -->
**It acts — within the gate.** Clear-cut and within authority: auto-send the renewal, grant the small discount, route the ticket. Past the line: draft it and escalate.

<!-- passage: architecture-11 -->
**It reports back.** End-of-day summary of what it did, drafted, and flagged. (Note: that report is itself just a humble cron job — the reactive work is event-driven, the reporting is scheduled. Both, each doing what it's good at.)

<!-- passage: architecture-12 -->
The permission ladder, concretely

<!-- passage: architecture-13 -->
This is what "managed" means. It's a seniority ladder, and it makes the abstract idea of guardrails completely obvious:

<!-- passage: architecture-14 -->
Discount

<!-- passage: architecture-15 -->
Situation

<!-- passage: architecture-16 -->
Authority

<!-- passage: architecture-17 -->
≤ 10%

<!-- passage: architecture-18 -->
Routine retention, healthy account

<!-- passage: architecture-19 -->
acts solo

<!-- passage: architecture-20 -->
10–20%

<!-- passage: architecture-21 -->
At-risk account, bigger ask

<!-- passage: architecture-22 -->
drafts → you approve

<!-- passage: architecture-23 -->
\> 20%

<!-- passage: architecture-24 -->
Strategic / unusual terms

<!-- passage: architecture-25 -->
deal desk / human only

<!-- passage: architecture-26 -->
The data model is the whole upgrade

<!-- passage: architecture-27 -->
Two tables turn "account bot" into "relationship manager":

<!-- passage: architecture-28 -->
accounts: renewal\_date

<!-- passage: architecture-29 -->
plan · usage\_trend

<!-- passage: architecture-30 -->
health · discount\_history

<!-- passage: architecture-31 -->
people: name · role

<!-- passage: architecture-32 -->
→ account\_id

<!-- passage: architecture-33 -->
relationship\_strength

<!-- passage: architecture-34 -->
last\_real\_contact · cadence

<!-- passage: architecture-35 -->
recent\_signals\[\]

<!-- passage: architecture-36 -->
An account doesn't have a LinkedIn. People do. The moment people are first-class, both "schedule catch-ups" and "watch for job moves" fall out for free — they're the same move, the agent maintaining a relationship *graph* instead of an account row.

<!-- passage: fixtures-01 -->
§ 06 — Build it as a toy first

<!-- passage: fixtures-02 -->
Everything fake, everything inspectable.

<!-- passage: fixtures-03 -->
For a 101, in-process and observable beats deployed every time. The entire pedagogical value is that you can *watch the judgment happen*. So:

<!-- passage: fixtures-04 -->
**A `now()` you control.** Advance the clock one day at a time and watch the renewal logic fire. Simulating a date approaching is trivial.

<!-- passage: fixtures-05 -->
**An accounts table and a people table you can edit by hand.** The memory, in plain JSON or a single DB file.

<!-- passage: fixtures-06 -->
**A stubbed people-signal feed.** A little table of events — `champion_left`, `promoted`, `new_hire` — standing in for the LinkedIn/enrichment layer.

<!-- passage: fixtures-07 -->
**Real web search for company news.** This one you don't fake — let it actually go find that a real, public company raised a round, and watch it change its plan. The bit that reaches into the real world lands hardest.

<!-- passage: fixtures-08 -->
**The LLM does the judgment.** The sweep, the scoring, the per-person catch-up drafting.

<!-- passage: fixtures-09 -->
**Tools are logged stubs.** "send email," "open ticket," "grant discount," "escalate" just *log what they would do.* You read the log and see the decisions.

<!-- passage: fixtures-10 -->
One screen. You press "advance one day" and watch your AM think: account #12 is fine, skip it. Account #7's champion just left and there's a renewal in 90 days — draft a re-engagement play, flag it for you. Account #3 is renewal-due and happy — auto-send the standard renewal. The boring actions become the *output* of the interesting thinking, instead of being the whole thing.

<!-- passage: fixtures-11 -->
Keep it honest

<!-- passage: fixtures-12 -->
Real fund-subscription account management is high-stakes, compliance-heavy, LP/GP relationship work. Frame this explicitly as a **toy that teaches the agent pattern** — not a thing you'd point at real clients. That framing is free and it keeps the whole thing clean.

<!-- passage: simulation-01 -->
§ 06½ — The toy, running

<!-- passage: simulation-02 -->
Press "advance one day." Watch it stay quiet.

<!-- passage: simulation-03 -->
Below is exactly the toy described above, simulated in your browser. Forty accounts, a stubbed people-feed, a fake clock. The "AM" is just deterministic judgment standing in for an LLM — but the *pattern* is real: it wakes up, looks at everything, decides whether anything deserves attention today, and either acts (within its authority), escalates to you, or — most days — does *nothing*.

<!-- passage: simulation-04 -->
Hold "Run 30 days" and watch the action log fill *slowly*. That gap between how often it works and how rarely it acts is the entire point.

<!-- passage: simulation-05 -->
The moment that sells it

<!-- passage: simulation-06 -->
Run 30 days. Notice: 1,200 account-checks, maybe 8 actions, maybe 2 escalations. That gap — between how often it woke up and how rarely it acted — is the entire difference between an agent and a chatbot, made visible. A chatbot does 100% of the work it's asked. An agent decides how much work even needs doing. That's the "oh, *that's* where this goes" beat.

<!-- passage: builder-01 -->
§ 06¾ — Wire it yourself

<!-- passage: builder-02 -->
Same brain. Your wiring.

<!-- passage: builder-03 -->
The toy above showed what a wired-up AM agent *does.* This shows you what the wiring *is.* Click an empty slot, pick something from the palette. Wires draw themselves. Hit **▶ Run a tick** and watch a real event flow through the graph you built.

<!-- passage: builder-04 -->
Most agent tutorials lead with `cron` and `webhook` and the whole thing feels like plumbing. It's not. **A trigger is anything that changes in the world.** A wearable. A door sensor. An energy price. A champion's job title on LinkedIn. The palette below is a buffet — most options have nothing to do with account management, on purpose. Same brain, swap the trigger, completely different employee.

<!-- passage: builder-05 -->
Try this

<!-- passage: builder-06 -->
Hit **↺ Clear**, then build an **Anniversary Agent**: drop "*7 days before anniversary*" in a trigger slot, "*Place an order*" and "*Send email*" in tool slots. Hit ▶. Same brain. Totally different employee — and notice "Place an order" lights up gold because it's a gated tool. Above the spend threshold it'll draft instead of just charging your card.

<!-- passage: builder-07 -->
Or try wiring an **HRV+Sleep Wellness Agent** with just two triggers (*sleep score \< 60*, *HRV spike*) and one tool (*push you a reminder*). Run it five times. Same brain reads the signals differently and writes different reminders — the judgment lives in the brain, not in your wiring.

<!-- passage: builder-08 -->
The leap from this toy to real code is small. Each node maps to a real construct: triggers are functions registered with a scheduler or webhook handler, tools are function definitions handed to the LLM, the gate is a permission check before the tool fires. In a real implementation each card would have a second tab — `Behavior | Code` — showing the actual snippet: `cron('0 9 * * *', () => agent.run())` on the trigger, `tools.sendEmail({to, subject, body})` on the tool. The wiring you just did *is* the architecture. Wrap each node in real code and you have the agent.

<!-- passage: takeaway-01 -->
§ 07 — The one thing to remember

<!-- passage: takeaway-02 -->
It's an employee you onboard with a prompt.

<!-- passage: takeaway-03 -->
A task is a vending machine. An agent is a hire: you scope its job, set what it can do alone versus escalate, give it memory so it holds a relationship over time, let it manage its own attention — and it reports back. The interesting design questions aren't technical (cron? webhook? queue?). They're **management** questions: how much do you trust it unsupervised, where's the line it has to ask, what does the end-of-day report look like, how does your feedback make it better next week.

<!-- passage: takeaway-04 -->
You already know how to think about those. You've managed people.

<!-- passage: takeaway-05 -->
The trigger is plumbing. The agent is the judgment between trigger and action — and the most advanced version decides, on its own, when to care.

<!-- passage: closing-01 -->
MANAGED AGENTS · 101 — a working note

<!-- passage: closing-02 -->
Worked example: an Account Manager. Architecture: dumb triggers, a thinking loop, tools, a permission gate, and a human supervising.

<!-- passage: closing-03 -->
Build the toy. Press "advance one day." Watch it decide to stay quiet.
