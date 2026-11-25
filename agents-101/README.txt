Agents 101 in eleven lines of Python
Charles Lee · November 2026

Unzip this folder. Run these commands from the folder containing replay-loop.py
and recorded-excerpts.json. Python 3.8 or newer is sufficient.

    python3 replay-loop.py

To choose a single recording, use one of these commands.

    python3 replay-loop.py --run sum
    python3 replay-loop.py --run read-only

The eleven lines in run_loop are the loop you build in the browser lesson.
The inputs, model replies, tool arguments, returned values, and final file
states come from two executions recorded on 16 November 2026. Event headings
and explanations were written for the lesson.

The replay supplies the saved model replies. Python runs the tool functions
and keeps the teaching files in memory. Each tool result must match the
recording, and each new model turn must contain the result for the preceding
request. No network connection, account, or API key is needed.

The sum takes four model turns and three tool calls. The output is 5 followed
by a newline (hex 35 0a). The read-only task takes two turns and one tool
call. It reads morning.txt, leaves both inputs intact, and creates no file.

Interactive lesson  https://clpanic.com/agents-101/
Article             https://clpanic.com/blog/2026-11-25-agents-101/
