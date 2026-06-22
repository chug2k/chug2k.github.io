#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework, simple clear hand-lettered speech bubbles. ERNE is a frantic fox with wild spiky electrified fur and huge bulging eyes; BERT is a calm fox in a small flat visor cap with sleepy content eyes. Both are foxes with pointy snouts, big triangle ears and bushy tails."
gen(){ "$BIN" "$2 $S" "$1" --size "${3:-1536x1024}"; }

# wave 1
gen strip-zero.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: a wobbly scoreboard on the wall reads 11 to 0; ERNE the spiky fox stares at it completely devastated, slumped, speech bubble 'we are the ZERO'. PANEL 2: BERT the calm visor fox gives a serene little shrug, totally at peace, speech bubble 'good. now we cannot fall', while Erne lies face-down on the court behind him." &
gen strip-die.png "A 2-panel comic strip separated by a black gutter line. PANEL 1: ERNE the spiky fox winds up enormously for a giant overhead smash at the net, wild-eyed and snarling, speech bubble 'GO FOR THE WINNER'. PANEL 2: on the very same ball, BERT the calm visor fox instead taps a tiny soft gentle dink just over the net, eyes half-closed and content, speech bubble 'or... the next shot', while behind him Erne is aghast with both paws on his head." &
wait; echo WAVE1
# wave 2
gen strip-pemberton.png "A 3-panel comic strip, three panels in a row separated by black gutter lines. PANEL 1: ERNE and BERT the two foxes stand alone on an empty pickleball court, looking around baffled, ERNE's speech bubble 'wait — were we even IN that chapter?'. PANEL 2: BERT the calm visor fox scratches under his visor and squints up at the sky, speech bubble 'who is Pemberton?'. PANEL 3: both foxes tip their heads back and squint suspiciously straight up at the reader, ERNE's speech bubble 'and why does that VOICE keep saying it'." 2048x1024 &
wait; echo WAVE2
