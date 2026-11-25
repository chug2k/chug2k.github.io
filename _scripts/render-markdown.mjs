#!/usr/bin/env node
// JSON bridge for Python. Packages are already included in the committed bundle.
import { articleTemplate, renderMarkdown, renderExcerpt, renderPost } from "../assets/markdown.mjs";
import { readFile } from "node:fs/promises";
import { lessonSlug, renderLesson, templateUrl } from "../assets/lesson-copy.mjs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const render = async value => {
  switch (value.mode) {
    case "template": return articleTemplate;
    case "markdown": return renderMarkdown(value.body);
    case "excerpt": return renderExcerpt(value.body);
    case "post":
      if (value.post.slug === lessonSlug) {
        const template = await readFile(new URL(".." + templateUrl, import.meta.url), "utf8");
        return renderLesson(template, value.post);
      }
      return renderPost(value.post);
    default: throw new Error(`Unknown render mode: ${value.mode}`);
  }
};
process.stdout.write(JSON.stringify(Array.isArray(request) ? await Promise.all(request.map(render)) : await render(request)));
