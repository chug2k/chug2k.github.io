#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework. Two recurring fox characters with pointy snouts, big triangle ears and bushy tails: BERT is a calm fox wearing a small flat visor cap with sleepy half-closed content eyes and a relaxed posture; ERNE is a frantic fox with wild spiky electrified fur sticking out everywhere and huge round bulging panicked eyes. No text or letters in the image."

run(){ "$BIN" "$2 $S" "$1" --size "${3:-1024x1024}" & }

run hat.png "ERNE the frantic spiky fox stands inside the painted kitchen box near a low net, clutching a small fallen cap to his chest and staring down at it, deeply worried about the cap. BERT the calm visor fox stands just outside the line, completely unbothered."
run drill-volley-reset.png "BERT the calm visor fox at the kitchen line taps a ball toward ERNE the spiky fox, who meets it with a short compact volley and snaps his paddle back to ready position in front of his chest. A low pickleball net." 1536x1024
run drill-electric-fence.png "ERNE the frantic spiky fox tries to charge forward across the baseline and gets comically ZAPPED by a little electric fence of lightning sparks running along the baseline, fur standing on end, while BERT the calm visor fox stays put safely behind the line." 1536x1024
run ready-position.png "BERT the calm visor fox demonstrating a textbook pickleball ready position: feet slightly wider than the shoulders, knees bent, low, up on the balls of the feet, paddle held up in front at waist height, relaxed and perfectly balanced, like a clean how-to diagram."
run drill-freeze.png "ERNE the spiky fox FROZEN mid-swing like a statue, perfectly still and balanced, feet planted wide apart, paddle cocked, holding the pose with a strained face, little freeze sparkle lines around him. BERT calm beside him."
run backhand-friend.png "A pickleball flies straight at ERNE the spiky fox's chest with motion lines; he defends it by taking it as a BACKHAND, paddle held up across the front of his chest, instead of a forehand."
run drill-dink-eval.png "BERT and ERNE foxes at opposite kitchen lines softly dinking a ball cross-court over a low pickleball net; the ball is dropping into the kitchen box, a little star of approval beside it." 1536x1024
run drill-slinky.png "A sequence of BERT the visor fox dinking at the kitchen line, then stepping backward step by step toward the baseline while still making soft little shots, stretching out like a slinky, with a dotted footstep trail behind him." 1536x1024
run drill-serve-catch.png "ERNE the spiky fox serves a pickleball underhand and low cross-court; across a low net BERT the calm visor fox simply CATCHES the ball in his paw instead of hitting it back." 1536x1024
run drill-tug-of-war.png "BERT and ERNE foxes on opposite sides of a low pickleball net playing a playful tug-of-war with a rope stretched over the net, both leaning way back, heels dug into the court." 1536x1024
run drill-357.png "A how-to comic of BERT the visor fox climbing from the baseline up to the net in three poses left to right: first a hard low DRIVE from the back, then a soft floating DROP from the midcourt, then a tiny DINK at the kitchen line, with a dotted path moving forward."  1536x1024
run drill-firefight.png "BERT and ERNE foxes at the kitchen line in a furious fast volley exchange, a blur of paddles, motion lines and a zig-zag ball whipping between them, until BERT calmly cushions one soft."
run poach.png "ERNE the frantic spiky fox lunges ALL the way across into his teammate BERT's half of the court to grab a ball, fully committed and wild-eyed, leaving a huge open gap behind him; BERT calmly steps sideways to cover the space Erne abandoned. They are partners on the same side of the net." 1536x1024
run drill-borrowed-paddle.png "ERNE the spiky fox plays pickleball gripping a comically wrong borrowed paddle that is actually a frying pan, looking betrayed and confused, yet still playing exactly as badly as ever. BERT calm beside him holding a normal paddle."

wait
echo ALL3 DONE
