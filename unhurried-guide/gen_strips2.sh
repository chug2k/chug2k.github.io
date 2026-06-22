#!/bin/bash
cd "$(dirname "$0")/images" || exit 1
BIN=~/.claude/skills/image-gen/bin/image-gen
S="Scrappy hand-drawn zine comic, thick black marker ink on plain white background, two-tone black and white only, no grey, no shading, no color, rough wobbly doodle linework. Two recurring fox characters with pointy snouts, big triangle ears and bushy tails: BERT is a calm fox wearing a small flat visor cap with sleepy half-closed content eyes and a relaxed posture; ERNE is a frantic fox with wild spiky electrified fur sticking out everywhere and huge round bulging panicked eyes."

"$BIN" "ERNE the frantic spiky fox lunges way too far for a ball, completely off balance, one leg flailing in the air, about to faceplant onto the court. Right beside him BERT the calm visor fox is in a perfect balanced athletic ready stance, knees bent, paddle up in front, feet set, light on his toes. No text or letters in the image. $S" footwork.png --size 1024x1024 &

"$BIN" "BERT the calm visor fox and ERNE the frantic spiky fox stand as teammates at a pickleball kitchen line, tied together at the waist by a short rope. ERNE lunges hard to one side chasing a ball and the taut rope yanks BERT sideways off his feet. No text or letters in the image. $S" doubles-rope.png --size 1536x1024 &

"$BIN" "ERNE the frantic spiky fox is buried under an enormous teetering pile of pickleball paddles, bags, gadgets and gizmos with little price tags dangling all over, eyes wild, clutching even more gear. Beside him BERT the calm visor fox calmly holds one single simple paddle, content. No text or letters in the image. $S" equipment.png --size 1024x1024 &

"$BIN" "ERNE the frantic spiky fox launches himself sideways through the air around the outside edge of the net post, legs splayed out, attempting a flashy leaping volley and clearly whiffing and missing the ball entirely, wild-eyed. A low pickleball net and a painted kitchen line on the court. No text or letters in the image. $S" erne-shot.png --size 1024x1024 &

wait
echo ALL2 DONE
