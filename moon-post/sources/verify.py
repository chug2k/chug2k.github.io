"""Verify WAVs, independent word counts and the exact data shown in the browser."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import sys
import wave

SOURCE = Path(__file__).resolve().parent
SITE = SOURCE.parent


def tokens(text):
    return re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()


def compare(intended, observed):
    left, right = tokens(intended), tokens(observed)
    grid = [list(range(len(right) + 1))]
    for i, a in enumerate(left, 1):
        row = [i]
        for j, b in enumerate(right, 1):
            row.append(min(grid[-1][j - 1] + (a != b), grid[-1][j] + 1, row[-1] + 1))
        grid.append(row)
    i, j = len(left), len(right)
    changes = []
    while i or j:
        if i and j and left[i - 1] == right[j - 1]:
            i, j = i - 1, j - 1
        elif i and j and grid[i][j] == grid[i - 1][j - 1] + 1:
            changes.append(["substitution", left[i - 1], right[j - 1]])
            i, j = i - 1, j - 1
        elif i and grid[i][j] == grid[i - 1][j] + 1:
            changes.append(["deletion", left[i - 1], ""])
            i -= 1
        else:
            changes.append(["insertion", "", right[j - 1]])
            j -= 1
    return {"errors": len(changes), "words": len(left), "changes": list(reversed(changes))}


def pcm_details(path):
    with wave.open(str(path)) as wav:
        rate, frames = wav.getframerate(), wav.getnframes()
        assert (wav.getnchannels(), wav.getsampwidth(), rate, wav.getcomptype()) == (1, 2, 16000, "NONE")
        samples = array.array("h")
        samples.frombytes(wav.readframes(frames))
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max(map(abs, samples))
    rms = math.sqrt(sum(x * x for x in samples) / frames)
    bars = []
    for i in range(68):
        block = samples[i * frames // 68:(i + 1) * frames // 68]
        bars.append(math.sqrt(sum(x * x for x in block) / len(block)))
    peaks = [round(100 * value / max(bars)) for value in bars]
    # Voiced 40 ms frames only. Pick the earliest strong correlation peak at 65–320 Hz.
    pitches = []
    for start in range(0, frames - 640, 320):
        frame = samples[start:start + 640:4]
        if sum(v * v for v in frame) / len(frame) < 550 ** 2:
            continue
        def correlation(lag):
            a, b = frame[60:], frame[60 - lag:len(frame) - lag]
            norm = math.sqrt(sum(v * v for v in a) * sum(v * v for v in b))
            return sum(x * y for x, y in zip(a, b)) / norm if norm else 0
        values = {lag: correlation(lag) for lag in range(11, 61)}
        maxima = [lag for lag in range(12, 60) if values[lag] >= values[lag-1] and values[lag] > values[lag+1]]
        threshold = max(0.78, max(values.values()) * 0.93)
        accepted = [lag for lag in maxima if values[lag] >= threshold]
        if accepted:
            pitches.append(4000 / accepted[0])
    return {"rate_hz": rate, "frames": frames, "seconds": round(frames / rate, 6),
            "rms_dbfs": round(20 * math.log10(rms / 32768), 2),
            "peak_dbfs": round(20 * math.log10(peak / 32768), 2),
            "estimated_median_voiced_hz": round(statistics.median(pitches)), "waveform": peaks}


def calculate():
    plan = json.loads((SOURCE / "dispatches.json").read_text())
    asr = json.loads((SOURCE / "recognition.json").read_text())
    measurements = {}
    reports = []
    expected = {plan["reference"]["id"]} | {s["id"] for r in plan["rounds"] for s in r["readings"]}
    assert expected == set(asr["clips"]) == {f.stem for f in (SITE / "audio").glob("*.wav")}

    def examine(clip, target):
        ident = clip["id"]
        wav = SITE / "audio" / (ident + ".wav")
        sha = hashlib.sha256(wav.read_bytes()).hexdigest()
        decoded = asr["clips"][ident]
        assert sha == decoded["audio_sha256"]
        script = " ".join(clip["parts"])
        text = "".join(decoded["segments"]).strip()
        assert text == decoded["text"]
        stats = pcm_details(wav)
        bars = stats.pop("waveform")
        comparisons = {"order_to_whisper": compare(target, text), "order_to_script": compare(target, script),
                       "script_to_whisper": compare(script, text)}
        measurements[ident] = {"sha256": sha, "script": script, "whisper": text, **stats, **comparisons}
        return {"id": ident, "script": script, "whisper": text, "seconds": stats["seconds"],
                "waveform": bars, **comparisons}

    reference = examine(plan["reference"], " ".join(plan["reference"]["parts"]))
    for r in plan["rounds"]:
        reports.append({"title": r["title"], "target": r["target"], "question": r["question"],
                        "readings": [examine(s, r["target"]) for s in r["readings"]]})
    totals = {}
    for kind in ("order_to_whisper", "order_to_script", "script_to_whisper"):
        scores = [s[kind] for r in reports for s in r["readings"]]
        totals[kind] = {key: sum(s[key] for s in scores) for key in ("errors", "words")}
    evidence = {"edition": plan["edition"], "recognizer": asr["engine"], "clips": measurements,
                "candidate_totals": totals}
    browser = {"edition": plan["edition"], "reference": reference, "rounds": reports, "totals": totals}
    return evidence, browser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="write the derived JSON and browser data")
    args = parser.parse_args()
    evidence, browser = calculate()
    files = {
        SOURCE / "measurements.json": json.dumps(evidence, indent=2, ensure_ascii=False) + "\n",
        SITE / "edition.js": "const MOON = " + json.dumps(browser, ensure_ascii=False, indent=2) + ";\n"
    }
    for path, body in files.items():
        if args.build:
            path.write_text(body, encoding="utf-8")
        elif path.read_text(encoding="utf-8") != body:
            raise SystemExit("Mismatch: " + path.name)
    for kind, result in evidence["candidate_totals"].items():
        errors, words = result["errors"], result["words"]
        print(f"{kind}: {errors}/{words} word edits ({100 * errors / words:.2f}%)")
    print("Matched seven PCM recordings, frozen transcriptions and browser data.")


if __name__ == "__main__":
    main()
