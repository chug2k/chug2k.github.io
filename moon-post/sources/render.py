"""Render seven new files to an empty directory using the stock Flite 2.2 build."""
import argparse
import array
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

SOURCE = Path(__file__).resolve().parent
RATE = 16000


def read_pcm(path):
    with wave.open(str(path)) as reader:
        assert (reader.getframerate(), reader.getnchannels(), reader.getsampwidth()) == (RATE, 1, 2)
        samples = array.array("h")
        samples.frombytes(reader.readframes(reader.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def trim(samples):
    # Keep 12 ms around activity, including soft initial and final consonants.
    left = next(i for i, value in enumerate(samples) if abs(value) > 40)
    right = next(i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > 40)
    margin = round(RATE * 0.012)
    return samples[max(0, left - margin):right + margin + 1]


def render(clip, binary, temp, output):
    samples = array.array("h", [0]) * round(0.08 * RATE)
    for i, text in enumerate(clip["parts"]):
        part = temp / "part.wav"
        subprocess.run([binary, "-voice", clip["voice"], "--setf",
                        "duration_stretch=" + str(clip["stretch"]), "-t", text, "-o", str(part)], check=True)
        if i:
            samples.extend([0] * round(clip["gap_ms"] * RATE / 1000))
        samples.extend(trim(read_pcm(part)))
    samples.extend([0] * round(0.14 * RATE))
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    gain = min(32768 * 0.1 / rms, 30000 / max(map(abs, samples)))
    scaled = array.array("h", (round(v * gain) for v in samples))
    if sys.byteorder != "little":
        scaled.byteswap()
    with wave.open(str(output / (clip["id"] + ".wav")), "wb") as writer:
        writer.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        writer.writeframes(scaled.tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--flite", default="flite")
    args = parser.parse_args()
    args.destination.mkdir(exist_ok=True, parents=True)
    if any(args.destination.iterdir()):
        parser.error("Choose an empty output directory.")
    spec = json.loads((SOURCE / "dispatches.json").read_text())
    clips = [spec["reference"]] + [c for r in spec["rounds"] for c in r["readings"]]
    with tempfile.TemporaryDirectory() as temp:
        for clip in clips:
            render(clip, args.flite, Path(temp), args.destination)


if __name__ == "__main__":
    main()
