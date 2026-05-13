<script setup>
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const props = defineProps({
  content: { type: String, default: "" },
});

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class=\"hljs\"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`;
      } catch {
        // fall through
      }
    }
    return `<pre class=\"hljs\"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});

const rendered = computed(() => md.render(props.content || ""));
</script>

<template>
  <div class="prose max-w-none" v-html="rendered" />
</template>

