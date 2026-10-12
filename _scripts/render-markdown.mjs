#!/usr/bin/env node
// JSON bridge for Python. Packages are already included in the committed bundle.
import { articleTemplate, renderMarkdown, renderExcerpt, renderPost } from "../assets/markdown.mjs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const render = value => {
  switch (value.mode) {
    case "template": return articleTemplate;
    case "markdown": return renderMarkdown(value.body);
    case "excerpt": return renderExcerpt(value.body);
    case "post": return renderPost(value.post);
    default: throw new Error(`Unknown render mode: ${value.mode}`);
  }
};
process.stdout.write(JSON.stringify(Array.isArray(request) ? request.map(render) : render(request)));
