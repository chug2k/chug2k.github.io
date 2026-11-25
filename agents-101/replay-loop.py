"""Replay the two Agents 101 recordings with Python's standard library."""

import argparse
import json
from pathlib import Path
from types import SimpleNamespace


def user(request):
    return {"role": "user", "content": request}


def tool_result(call, value):
    return {"role": "tool", "reply_to": call.key, "value": value}


def run_loop(request, ask_model, read_file, write_file, run_tool):
    messages = [user(request)]
    tools = [read_file, write_file]
    for turn in range(8):
        reply = ask_model(messages, tools)
        messages.append(reply)
        if not reply.tool_calls:
            print(reply.text)
            break
        for call in reply.tool_calls:
            result = run_tool(call, tools)
            messages.append(tool_result(call, result))


def check(condition, explanation):
    if not condition:
        raise ValueError(explanation)


def replay(run):
    # Each replay has a fresh workspace. The tools below access only this dictionary.
    initial = {"morning.txt": "2\n", "afternoon.txt": "3\n"}
    files = initial.copy()
    frames = run["frames"]
    check(frames[0]["files"] == initial, "The recorded starting files do not match.")
    replies = [frame for frame in frames if frame["kind"] in {"Model request", "Final reply"}]
    expected = [json.loads(frame["packet"]) for frame in frames if frame["kind"] == "Tool result"]
    turns = 0
    actual_results = []

    def saved_model(messages, tools):
        nonlocal turns
        check(tools == [read_file, write_file], "The model must be offered both teaching tools.")
        check(turns < len(replies), "The loop asked for another reply after the recording ended.")
        check(messages[0] == user(run["prompt"]), "The original user prompt is missing.")
        check(len(messages) == 1 + 2 * turns, "An earlier reply or tool result is missing.")
        if turns:
            # Give the recorded requests short local IDs to match replies in this replay.
            expected_message = {"role": "tool", "reply_to": turns, "value": expected[turns - 1]}
            check(messages[-1] == expected_message, "The outstanding request needs its matching result.")
        frame = replies[turns]
        turns += 1
        calls = []
        if frame["kind"] == "Model request":
            calls.append(SimpleNamespace(key=turns, **frame["tool"]))
            print(f'  Model: {frame["detail"]}  →  {frame["packet"]}')
        return SimpleNamespace(text=frame["detail"], tool_calls=calls)

    def read_file(name):
        if name not in initial:
            raise ValueError("Only morning.txt and afternoon.txt can be read.")
        return files[name]

    def write_file(name, content):
        if name != "total.txt" or len(content.encode("utf-8")) > 32:
            raise ValueError("Only total.txt can be written, up to 32 bytes.")
        files[name] = content
        return f"Saved {name} ({len(content.encode('utf-8'))} bytes)."

    def dispatch(call, tools):
        offered = {function.__name__: function for function in tools}
        check(call.name in offered, f"Unknown tool {call.name!r}.")
        value = offered[call.name](**call.arguments)
        index = len(actual_results)
        check(index < len(expected) and value == expected[index], "The tool result differs from the recording.")
        actual_results.append(value)
        print(f"  Program returned {value!r} on request {call.key}.")
        return value

    print(f'\n{run["id"]} · {run["prompt"]}')
    run_loop(run["prompt"], saved_model, read_file, write_file, dispatch)
    check(turns == len(replies) == run["turns"], "The model turn count differs.")
    check(len(actual_results) == len(expected) == run["tools"], "The tool count differs.")
    check(files == run["finalFiles"], "The final in-memory files differ from the recording.")
    if run["id"] == "sum":
        total = str(sum(int(value) for value in initial.values())) + "\n"
        check(files == dict(initial, **{"total.txt": total}), "The saved sum or newline is incorrect.")
        print(f'  total.txt = {files["total.txt"]!r} (hex {files["total.txt"].encode().hex(" ")})')
    else:
        check(run["id"] == "read-only" and files == initial, "The read-only task changed a file.")
        print("  Both original files are unchanged. No output file was created.")
    print(f"  Verified {turns} model turns and {len(actual_results)} tool call(s).")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", choices=["sum", "read-only", "both"], default="both")
    scenario = parser.parse_args().run
    data_file = Path(__file__).with_name("recorded-excerpts.json")
    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        check([run["id"] for run in data["runs"]] == ["sum", "read-only"], "Expected both November recordings.")
        for run in data["runs"]:
            if scenario in ("both", run["id"]):
                replay(run)
    except (OSError, ValueError, KeyError, IndexError, TypeError) as error:
        parser.exit(1, f"Replay could not finish. {error}\n")


if __name__ == "__main__":
    main()
