#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework. Recurring fox characters with pointy snouts, big triangle ears and bushy tails: BERT is a calm fox in a small flat visor cap with sleepy content eyes; ERNE is a frantic fox with wild spiky electrified fur and huge bulging eyes. No text or letters in the image."
gen(){ "$BIN" "$2 $S" "$1" --size "${3:-1024x1024}"; }

# wave 1
gen history.png "A whimsical 1960s suburban backyard: BERT the calm visor fox and ERNE the spiky fox improvise a brand-new game over a saggy old badminton net, swinging homemade wooden plywood paddles at a holey plastic wiffle ball; a small confused dog sits nearby watching them." 1536x1024 &
gen paddle-tap.png "Four cartoon foxes (including BERT the calm visor fox and ERNE the spiky fox) lean in and tap their paddle faces together over a low pickleball net in a friendly post-game ritual, all of them content and smiling, a warm good-game moment." 1536x1024 &
wait
echo WAVE1-DONE
# wave 2
gen send-off.png "Seen from behind, BERT the calm visor fox and ERNE the spiky fox walk side by side onto an empty pickleball court at dawn, paddles in hand, ready to play, a hopeful fresh-morning feeling, long shadows." 1536x1024 &
gen erne-earns-it.png "ERNE the spiky fox, calm and still for once, has just made a soft gentle reset shot; beside him BERT the visor fox quietly slides a glowing haloed Chunky Pickle (a cartoon pickle with a little halo) across toward Erne, approving. A tender little moment." &
wait
echo WAVE2-DONE
