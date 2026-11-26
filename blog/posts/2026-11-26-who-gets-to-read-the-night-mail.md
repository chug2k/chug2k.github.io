---
title: How to evaluate a synthetic voice
description: How natural does the reading sound? Does it sound like the reference speaker? Try the listening test from Voice Clone WER Eval, then check how accurately Whisper transcribed the script.
date: 2026-11-26
draft: false
---

I like to hide the captions the first time I listen to a voice demo. Once I’ve seen the sentence, my ear has a remarkably cooperative proofreader. It puts the missing word back in.

<!--more-->

At The Moon Post, you’re choosing a relief voice for the night clerk. Play the clerk’s short message. Then listen to two readings of a dispatch and give each reading two scores. Naturalness is about how the words travel together. Voice similarity is about whether you’d recognize the clerk on the other end of the line.

Try this with a line from an imaginary parcel slip. Say “on the bottom shelf” out loud, leaving a long pause between “bottom” and “shelf.” You still sound like yourself. If the clerk did that, I could give the reading a **5 for similarity and a 2 for naturalness**. A different speaker could say the same four words in one easy breath and earn a 4 for naturalness and a 2 for similarity. Which one would you put on the announcement system?

Once you’ve listened, open the dispatch. You can trace a word from the written order to the script the voice was given, then to the transcript Whisper produced from the recording. Compare the script with Whisper to measure transcription accuracy. If a word was already wrong in the script, trace it back to the written order. A recognizer can put a strange spelling on a perfectly good instruction. It can also transcribe a bad instruction perfectly. Those call for different fixes.

This little post office grew out of a listening dashboard I was working on in May 2026. You get three dispatches, six readings, and a worksheet you can take away. File one sentence about each choice. I’d much rather read “the pause split those two words” than another decimal point.

[Open The Moon Post](/moon-post/) · [Download the offline edition](/moon-post/moon-post.zip?v=7bab4680cb06a8d2)
