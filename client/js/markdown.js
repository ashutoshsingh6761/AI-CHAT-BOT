// client/js/markdown.js
// Renders assistant message Markdown safely:
//   raw text -> marked.js (Markdown -> HTML) -> DOMPurify (sanitize) -> highlight.js (code)

const MarkdownRenderer = (() => {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function render(rawText) {
    const html = marked.parse(rawText || '');
    const clean = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target'],
    });
    return clean;
  }

  /**
   * Renders markdown into a container element, applies syntax highlighting,
   * and wraps each code block with a copy button.
   */
  function renderInto(container, rawText) {
    container.innerHTML = render(rawText);

    container.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);

      const pre = block.parentElement;
      if (pre.parentElement.classList.contains('code-block-wrap')) return;

      const wrap = document.createElement('div');
      wrap.className = 'code-block-wrap';
      pre.parentElement.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(block.textContent);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
      });
      wrap.appendChild(copyBtn);
    });

    // Open links in a new tab safely.
    container.querySelectorAll('a').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  return { render, renderInto };
})();
