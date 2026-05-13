import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`;
      } catch {
        // fall through
      }
    }
    try {
      return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
    } catch {
      return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
    }
  },
});

export function MarkdownRenderer({ value }) {
  const html = md.render(String(value || ""));
  return (
    <article
      className="markdown-content"
      // Markdown is rendered locally; do not pass user-provided HTML through.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
