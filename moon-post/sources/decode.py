"""Decode the shipped PCM with whisper.cpp on a CPU and save verbatim segment text."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

MODEL_SHA = "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002"
MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin"
FLAGS = ["-l", "en", "-t", "4", "-ng", "-nf", "-tp", "0", "-bs", "5", "-bo", "5", "-oj"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--audio", type=Path, default=Path(__file__).resolve().parents[1] / "audio")
    parser.add_argument("--whisper", default="whisper-cli")
    args = parser.parse_args()
    if hashlib.sha256(args.model.read_bytes()).hexdigest() != MODEL_SHA:
        parser.error("This edition uses the pinned ggml-base.en.bin.")
    if args.output.exists():
        parser.error("Choose a new output file.")
    version = subprocess.run([args.whisper, "--version"], capture_output=True, text=True, check=True)
    engine = next(line.strip() for line in (version.stdout + version.stderr).splitlines()
                  if line.startswith("whisper.cpp version:"))
    record = {"engine": engine, "model": MODEL_URL, "model_sha256": MODEL_SHA,
              "flags": FLAGS, "clips": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for wav in sorted(args.audio.glob("*.wav")):
            prefix = Path(tmp) / wav.stem
            subprocess.run([args.whisper, "-m", str(args.model), "-f", str(wav), *FLAGS,
                            "-of", str(prefix)], stdout=subprocess.DEVNULL, check=True)
            result = json.loads(prefix.with_suffix(".json").read_text())
            segments = [s["text"] for s in result["transcription"]]
            record["clips"][wav.stem] = {"audio_sha256": hashlib.sha256(wav.read_bytes()).hexdigest(),
                                          "segments": segments, "text": "".join(segments).strip()}
            print(wav.stem, record["clips"][wav.stem]["text"], flush=True)
    args.output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
