// client/js/chat.js
// Owns all chat-related UI state: the active chat, the sidebar history list,
// rendering messages, and sending/streaming new ones.

const Chat = (() => {
  const messagesEl = document.getElementById('messages');
  const emptyStateEl = document.getElementById('empty-state');
  const chatListEl = document.getElementById('chat-list');
  const chatTitleEl = document.getElementById('chat-title');
  const composerForm = document.getElementById('composer-form');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  let activeChatId = null;
  let isStreaming = false;
  let abortStream = null;

  // ---------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------

  function formatTime(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom(smooth = true) {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  function showEmptyState(show) {
    emptyStateEl.classList.toggle('hidden', !show);
  }

  function userInitial() {
    const user = Auth.getUser();
    return (user?.name || 'U').trim().charAt(0).toUpperCase();
  }

  /**
   * Appends a message row to the DOM and returns a handle for updating it
   * (used for the streaming assistant message).
   */
  function appendMessageRow(role, content, timestamp) {
    showEmptyState(false);

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('span');
    avatar.className = `avatar ${role === 'user' ? 'avatar-user' : 'avatar-ai'}`;
    avatar.textContent = role === 'user' ? userInitial() : '✦';

    const wrap = document.createElement('div');
    wrap.className = 'message-bubble-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'assistant') {
      MarkdownRenderer.renderInto(bubble, content);
    } else {
      bubble.textContent = content;
    }

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const time = document.createElement('span');
    time.textContent = formatTime(timestamp);
    meta.appendChild(time);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = 'Copied';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
    });
    meta.appendChild(copyBtn);

    wrap.appendChild(bubble);
    wrap.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesEl.appendChild(row);

    scrollToBottom();

    return { row, bubble, copyBtn };
  }

  function appendTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = 'typing-row';

    const avatar = document.createElement('span');
    avatar.className = 'avatar avatar-ai';
    avatar.textContent = '✦';

    const wrap = document.createElement('div');
    wrap.className = 'message-bubble-wrap';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    wrap.appendChild(bubble);

    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  function removeTypingIndicator() {
    document.getElementById('typing-row')?.remove();
  }

  function renderMessages(messages) {
    messagesEl.innerHTML = '';
    if (!messages || messages.length === 0) {
      showEmptyState(true);
      return;
    }
    showEmptyState(false);
    for (const m of messages) {
      appendMessageRow(m.role, m.content, m.createdAt);
    }
    scrollToBottom(false);
  }

  // ---------------------------------------------------------------------
  // Sidebar history
  // ---------------------------------------------------------------------

  async function refreshHistory() {
    try {
      const res = await Api.getHistory();
      renderChatList(res.data.chats);
    } catch (err) {
      Toast.show(err.message || 'Failed to load chat history', 'error');
    }
  }

  function renderChatList(chats) {
    chatListEl.innerHTML = '';

    if (!chats || chats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-history';
      empty.textContent = 'No conversations yet. Start a new chat!';
      chatListEl.appendChild(empty);
      return;
    }

    for (const chat of chats) {
      chatListEl.appendChild(buildChatListItem(chat));
    }
  }

  function buildChatListItem(chat) {
    const item = document.createElement('div');
    item.className = `chat-item ${chat._id === activeChatId ? 'active' : ''}`;
    item.dataset.id = chat._id;

    const title = document.createElement('span');
    title.className = 'chat-item-title';
    title.textContent = chat.title || 'New Chat';
    item.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'chat-item-actions';

    const renameBtn = document.createElement('button');
    renameBtn.title = 'Rename';
    renameBtn.textContent = '✎';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(item, chat);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.title = 'Delete';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(chat._id);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);

    item.addEventListener('click', () => loadChat(chat._id));

    return item;
  }

  function startRename(item, chat) {
    const titleEl = item.querySelector('.chat-item-title');
    const input = document.createElement('input');
    input.className = 'chat-item-rename-input';
    input.value = chat.title || '';
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    async function commit() {
      if (finished) return;
      finished = true;
      const newTitle = input.value.trim() || 'Untitled chat';
      try {
        await Api.renameChat(chat._id, newTitle);
        chat.title = newTitle;
        if (chat._id === activeChatId) chatTitleEl.textContent = newTitle;
      } catch (err) {
        Toast.show(err.message || 'Rename failed', 'error');
      }
      refreshHistory();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { finished = true; refreshHistory(); }
    });
  }

  async function handleDelete(chatId) {
    if (!confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await Api.deleteChat(chatId);
      if (chatId === activeChatId) startNewChat();
      refreshHistory();
      Toast.show('Chat deleted', 'success');
    } catch (err) {
      Toast.show(err.message || 'Failed to delete chat', 'error');
    }
  }

  // ---------------------------------------------------------------------
  // Chat loading / creation
  // ---------------------------------------------------------------------

  function startNewChat() {
    activeChatId = null;
    chatTitleEl.textContent = 'New chat';
    messagesEl.innerHTML = '';
    showEmptyState(true);
    highlightActiveInList();
    messageInput.focus();
  }

  async function loadChat(chatId) {
    if (isStreaming) return; // avoid switching mid-stream
    try {
      const res = await Api.getChat(chatId);
      activeChatId = chatId;
      chatTitleEl.textContent = res.data.chat.title || 'Chat';
      renderMessages(res.data.chat.messages);
      highlightActiveInList();
      closeMobileSidebar();
    } catch (err) {
      Toast.show(err.message || 'Failed to load chat', 'error');
    }
  }

  function highlightActiveInList() {
    document.querySelectorAll('.chat-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === activeChatId);
    });
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
  }

  // ---------------------------------------------------------------------
  // Sending messages
  // ---------------------------------------------------------------------

  function setSending(sending) {
    isStreaming = sending;
    sendBtn.disabled = sending || messageInput.value.trim().length === 0;
    messageInput.disabled = sending;
  }

  async function handleSend(text) {
    if (!text.trim() || isStreaming) return;

    appendMessageRow('user', text.trim());
    messageInput.value = '';
    autoResizeInput();
    setSending(true);

    const typingRow = appendTypingIndicator();
    let assistantHandle = null;
    let firstChunkReceived = false;
    let fullText = '';

    const payload = { message: text.trim() };
    if (activeChatId) payload.chatId = activeChatId;

    abortStream = Api.streamMessage(payload, {
      onMeta: (meta) => {
        if (!activeChatId && meta.chatId) {
          activeChatId = meta.chatId;
          chatTitleEl.textContent = meta.title || 'New chat';
        }
      },
      onChunk: (delta) => {
        if (!firstChunkReceived) {
          removeTypingIndicator();
          assistantHandle = appendMessageRow('assistant', '');
          firstChunkReceived = true;
        }
        fullText += delta;
        MarkdownRenderer.renderInto(assistantHandle.bubble, fullText);
        scrollToBottom();
      },
      onDone: () => {
        removeTypingIndicator();
        setSending(false);
        refreshHistory();
        messageInput.focus();
      },
      onError: (err) => {
        removeTypingIndicator();
        if (!firstChunkReceived) {
          appendMessageRow('assistant', `⚠️ ${err.message || 'Something went wrong. Please try again.'}`);
        } else {
          Toast.show(err.message || 'Streaming interrupted', 'error');
        }
        setSending(false);
        refreshHistory();
      },
    });
  }

  function autoResizeInput() {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
    sendBtn.disabled = isStreaming || messageInput.value.trim().length === 0;
  }

  function initComposer() {
    composerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSend(messageInput.value);
    });

    messageInput.addEventListener('input', autoResizeInput);

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(messageInput.value);
      }
    });

    document.querySelectorAll('.suggestion-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        handleSend(chip.dataset.prompt);
      });
    });

    sendBtn.disabled = true;
  }

  function init() {
    initComposer();
    document.getElementById('new-chat-btn').addEventListener('click', startNewChat);
    refreshHistory();
    startNewChat();
  }

  return { init, refreshHistory, startNewChat, loadChat };
})();
