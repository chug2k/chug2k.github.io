#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework, simple clear hand-lettered speech bubbles. Recurring fox characters with pointy snouts, big triangle ears and bushy tails: BERT is a calm fox in a small flat visor cap with sleepy content eyes; ERNE is a frantic fox with wild spiky electrified fur and huge bulging eyes."
gen(){ "$BIN" "$2 $S" "$1" --size "${3:-1536x1024}"; }

# wave 1
gen strip-scoring.png "A 3-panel comic strip, three panels in a row separated by black gutter lines. PANEL 1: ERNE the spiky fox looks baffled holding a little scoreboard that reads '0 0 2', speech bubble 'WHY 0-0-2?!'. PANEL 2: BERT the calm visor fox explains patiently, speech bubble 'GOING FIRST IS AN ADVANTAGE'. PANEL 3: BERT gives a gentle shrug, speech bubble 'SO THE GAME SAYS SORRY', while behind him ERNE is teary-eyed and touched with both paws to his chest." 2048x1024 &
gen strip-hat.png "A 2-panel comic strip, two panels separated by a black gutter line. PANEL 1: ERNE the spiky fox volleys at the net and his little cap tumbles down into the painted kitchen box; Erne looks horrified, speech bubble 'MY HAT—'. PANEL 2: ERNE sits cradling the cap with a single tear, speech bubble 'is the hat ok', while BERT the visor fox rests a paw on his shoulder, speech bubble 'the hat is fine'." &
wait
echo WAVE1
# wave 2
gen strip-poach.png "A 2-panel comic strip, two panels separated by a black gutter line. PANEL 1: ERNE the spiky fox lunges all the way across the court into his partner's half chasing a ball, wild-eyed, speech bubble 'I HAVE IT!'. PANEL 2: the ball sails past into the wide-open gap Erne left behind; BERT the visor fox stands deadpan covering that empty space, speech bubble 'you do not have it'." &
gen strip-paddle.png "A 2-panel comic strip, two panels separated by a black gutter line. PANEL 1: ERNE the spiky fox sits buried in a huge pile of pickleball paddles, hopefully holding one more up, speech bubble 'but what if the TWELFTH one—'. PANEL 2: BERT the calm visor fox with a totally flat expression, single speech bubble 'no', as Erne deflates." &
wait
echo WAVE2
