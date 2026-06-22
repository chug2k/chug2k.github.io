#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework, simple clear hand-lettered speech bubbles. ERNE is a frantic fox with wild spiky electrified fur and huge bulging eyes; BERT is a calm fox in a small flat visor cap with sleepy content eyes."
gen(){ "$BIN" "$2 $S" "$1" --size 1536x1024; }

# wave 1
gen strip-which-dot.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: ERNE the spiky fox squints hard at a clipboard showing a little court diagram of dots, confused, speech bubble 'WHICH ONE IS ME?'. PANEL 2: BERT the calm visor fox calmly points at one tiny dot on the diagram, speech bubble 'the one in the wrong place', while Erne deflates." &
gen strip-bad-example.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: ERNE the spiky fox throws both arms out gesturing at himself, wounded and indignant, speech bubble 'WHY AM I ALWAYS THE BAD EXAMPLE?'. PANEL 2: BERT the calm visor fox puts a paw to his chin and looks up thinking, speech bubble 'still thinking', while Erne looks crushed." &
wait; echo W1
# wave 2
gen strip-call-the-ball.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: a stray pickleball rolls onto the court and ERNE the spiky fox eyes it, torn and conflicted, speech bubble 'but i WANTED that point'. PANEL 2: BERT the calm visor fox points firmly, speech bubble 'you call the ball, Erne', and Erne reluctantly cups a paw to his mouth to yell." &
gen strip-inner-bert.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: ERNE the spiky fox looks earnestly and hopefully at BERT, speech bubble 'should i be more like you?'. PANEL 2: BERT the calm visor fox gives a small kind smile, speech bubble 'no. you just talk too much', and Erne looks sheepish." &
wait; echo W2
