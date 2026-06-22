#!/bin/bash
# Generate the Bert & Erne comic strips for the guide. Black-ink zine style.
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen

S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework like a photocopied zine. Two recurring fox characters drawn simply with pointy snouts, big triangle ears and bushy tails: BERT is a calm fox wearing a small flat visor cap with sleepy half-closed content eyes and a relaxed posture; ERNE is a frantic fox with wild spiky electrified fur sticking out in all directions and huge round bulging panicked eyes."

"$BIN" "Comic book cover illustration. BERT the calm visor fox stands relaxed holding a pickleball paddle and a holey plastic pickleball; ERNE the frantic spiky fox leaps into the air mid-swing in a wild panic beside him. A pickleball net between them with simple court lines. Leave generous empty space at the top for a title. No text or letters in the image. $S" cover-foxes.png --size 1024x1536 &

"$BIN" "ERNE the frantic spiky fox is standing inside a literal cartoon kitchen drawn on the pickleball court (a stove, a frying pan, pots on a little shelf) while volleying a ball, looking panicked, with heat and flame squiggle lines rising around his feet as if he is getting burned. BERT the calm visor fox stands just outside a drawn boundary line, paddle relaxed, unbothered. No text or letters in the image. $S" kitchen.png --size 1024x1024 &

"$BIN" "ERNE the frantic spiky fox is sprinting toward the net leaving a dust cloud trail right after serving, while a pickleball screams toward his feet with motion lines and he panics. BERT the calm visor fox stands perfectly still and serene on his own side like a calm lake, paddle down. A small speech bubble points to BERT and says 'stay'. $S" serve-and-stay.png --size 1536x1024 &

"$BIN" "ERNE the frantic spiky fox has dizzy spiral eyes and is surrounded by floating numbers and question marks, his head spinning, totally confused. The numbers '0 0 2' float in the air. BERT the calm visor fox stands beside him calmly holding up a pickleball, unbothered. $S" scoring.png --size 1024x1024 &

"$BIN" "BERT the calm visor fox gently taps a soft little arcing ball that floats over the net like a tiny moon, his eyes sleepy and content. Beside him ERNE the frantic spiky fox strains and sweats, paddle cocked way back, visibly fighting the overwhelming urge to smash the ball. No text or letters in the image. $S" dink.png --size 1024x1024 &

"$BIN" "ERNE the frantic spiky fox swings with all his might and a pickleball blasts way out past the far corner line of the court with big motion lines, clearly missing badly. BERT the calm visor fox stands nearby with a paw on his face, facepalming. A speech bubble points to ERNE and says 'MINE'. $S" drive-corner.png --size 1536x1024 &

"$BIN" "A big muscular buff athletic fox with huge arms is flailing and tripping over himself in completely the wrong spot on the court, falling down. Meanwhile small calm BERT the visor fox stands perfectly positioned at the kitchen line, paddle up in ready position, totally unbothered and winning. No text or letters in the image. $S" secret.png --size 1024x1024 &

"$BIN" "ERNE the frantic spiky fox fires a fast hard pickleball with sharp speed lines straight at BERT. BERT the calm visor fox, totally relaxed with a loose floppy limp wrist, absorbs and catches the ball softly on his paddle like a pillow or a catcher's mitt, the ball going soft and squishy. No text or letters in the image. $S" pillow-reset.png --size 1024x1024 &

"$BIN" "A quiet small panel with lots of empty white space. ERNE the fox, for once NOT spiky or frantic, sits slumped and small and deflated on the ground, ears drooping, having a tiny sad quiet realization. A small speech bubble points to him and says '...oh'. $S" erne-oh.png --size 1024x1024 &

wait
echo "ALL STRIPS DONE"
ls -la
