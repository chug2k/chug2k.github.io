# Reproduce The Moon Post

The packaged WAVs are the inputs to this edition. They use signed 16-bit mono PCM at 16,000 Hz. The desk loads its data as a local script so it also works from a file URL.

From the folder containing `index.html`, check all seven WAV hashes, PCM measurements, text alignments, candidate totals, waveform envelopes and the browser’s data with Python 3. This uses the standard library.

```sh
python3 sources/verify.py
```

## Recreate the sounds

Build unmodified Flite 2.2 at commit `e9e2e37c329dbe98bfeb27a1828ef9a71fa84f88` with its bundled RMS and SLT voices. On the build Mac, the commands in the Flite source directory were `./configure --with-audio=none` and `make -j6`. The archive downloaded by commit had SHA-256 `1eebf476797cea10b4706cfbb9db9ba34f7b8ccb1fe7e0069b0b7528e0b0be46`. [Pinned source](https://github.com/festvox/flite/tree/e9e2e37c329dbe98bfeb27a1828ef9a71fa84f88)

```sh
python3 sources/render.py fresh-audio --flite /path/to/flite/bin/flite
```

The script writes only to an empty destination. It renders the text fragments and duration factors in `dispatches.json`, trims outer silence, inserts the specified pause, pads the ends, and adjusts RMS toward −20 dBFS with a peak cap. A compiler or processor change can affect rounding. Use the distributed WAVs for comparisons against the published hashes. The median pitch estimate in the measurement file uses normalized autocorrelation on voiced frames and is rounded to the nearest hertz. The display waveform uses the RMS energy of 68 equal sections of the actual recording.

## Repeat recognition

Install whisper.cpp 1.9.4 and obtain the pinned English base model. SHA-256 must be `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`. The recognizer reads the final WAVs directly. Each clip gets a fresh process, English, four CPU threads, zero temperature, a beam of five, no temperature fallback, and no text prompt. [Recognition engine](https://github.com/ggml-org/whisper.cpp) · [Pinned base.en weights](https://huggingface.co/ggerganov/whisper.cpp/blob/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin)

```sh
python3 sources/decode.py /path/to/ggml-base.en.bin repeat-recognition.json
```

Compare the resulting clip hashes, segment strings and joined text with `sources/recognition.json`. Leading whitespace at the boundary of a whole transcript is removed. The original segment text, including punctuation, is retained. The two local CPU passes used to verify the release produced identical records.

## Score the readings

`measurements.json` contains one row per file. Each includes the reference-word count, edit count and ordered changes for the written order versus Whisper, the written order versus the synthesis script, and the synthesis script versus Whisper. Each corpus rate divides the sum of edits by the sum of the six candidate denominators. The separate reference clip is excluded.

| Comparison | Edits | Words | Rate |
| --- | ---: | ---: | ---: |
| Written order to Whisper | 5 | 46 | 10.87% |
| Written order to script | 2 | 46 | 4.35% |
| Script to Whisper | 3 | 47 | 6.38% |

`verify.py --build` regenerates the derived data and browser copy from the recorded inputs. The normal check is read-only. The new text and artwork were authored for this edition. The source licenses for the two voices, the engine and the fonts are linked in [the field notes](../sources.html).
