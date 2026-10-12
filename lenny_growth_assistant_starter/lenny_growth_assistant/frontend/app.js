/**
 * The Lenny Growth Assistant — Frontend Application Script
 * Preserves all backend integrations:
 * - /api/health
 * - /api/sessions (POST)
 * - /api/sessions/{session_id} (GET)
 * - /api/chat (POST)
 */

(function () {
  'use strict';

  // --- State Variables ---
  let sessionId = null;
  let isRequestInProgress = false;
  let activeSources = [];

  // --- DOM Elements ---
  const appLayout = document.getElementById('appLayout');
  const messages = document.getElementById('messages');
  const form = document.getElementById('chatForm');
  const promptBox = document.getElementById('prompt');
  const sendButton = document.getElementById('send');
  const sourceList = document.getElementById('sourceList');
  const modelPill = document.getElementById('modelPill');
  const conversationTitle = document.getElementById('conversationTitle');
  const sourceBadge = document.getElementById('sourceBadge');
  const sourceCount = document.getElementById('sourceCount');
  const sessionList = document.getElementById('sessionList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const systemStatusDot = document.getElementById('systemStatusDot');
  const sidebarStatus = document.getElementById('sidebarStatus');
  const sidebarStats = document.getElementById('sidebarStats');

  // Sidebar & Research Panel Drawers
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const artifactPane = document.getElementById('artifactPane');
  const panelToggle = document.getElementById('panelToggle');
  const panelBackdrop = document.getElementById('panelBackdrop');
  const closePanelBtn = document.getElementById('closePanelBtn');

  // Tabs
  const tabSources = document.getElementById('tabSources');
  const tabArtifacts = document.getElementById('tabArtifacts');
  const sourcesPanelSection = document.getElementById('sourcesPanelSection');
  const artifactsPanelSection = document.getElementById('artifactsPanelSection');
  const artifactDocument = document.getElementById('artifactDocument');
  const artifactDocBody = document.getElementById('artifactDocBody');
  const copyArtifactBtn = document.getElementById('copyArtifactBtn');

  // --- Session History Management (LocalStorage) ---
  const STORAGE_KEY = 'lenny_growth_sessions';

  function getStoredSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const list = data ? JSON.parse(data) : [];
      // Filter out empty placeholder sessions
      return list.filter(s => s && s.id && s.title && s.title.trim() !== 'New research session' && s.title.trim() !== 'New chat');
    } catch {
      return [];
    }
  }

  function saveStoredSessions(sessions) {
    try {
      const filtered = (sessions || []).filter(s => s && s.id && s.title && s.title.trim() !== 'New research session' && s.title.trim() !== 'New chat');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore storage errors in private browsing
    }
  }

  function recordSession(id, title) {
    if (!id) return;
    const cleanTitle = (title || '').trim();
    // Do not record empty placeholder sessions
    if (!cleanTitle || cleanTitle === 'New research session' || cleanTitle === 'New chat') {
      return;
    }

    const sessions = getStoredSessions();
    const index = sessions.findIndex(s => s.id === id);

    if (index >= 0) {
      sessions[index].title = cleanTitle;
      sessions[index].updatedAt = Date.now();
    } else {
      sessions.unshift({
        id: id,
        title: cleanTitle,
        updatedAt: Date.now()
      });
    }

    // Keep up to 25 sessions
    saveStoredSessions(sessions.slice(0, 25));
    renderSessionList();
  }

  function renderSessionList() {
    const sessions = getStoredSessions();
    if (!sessionList) return;

    if (!sessions || sessions.length === 0) {
      sessionList.innerHTML = '<div class="session-empty-state">No saved sessions yet.</div>';
      return;
    }

    sessionList.innerHTML = '';
    sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = `session-item ${sess.id === sessionId ? 'active' : ''}`;
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'session-item-title';
      titleSpan.textContent = sess.title || 'Research session';
      titleSpan.title = sess.title || 'Research session';

      const delBtn = document.createElement('button');
      delBtn.className = 'session-item-delete';
      delBtn.title = 'Remove from recent';
      delBtn.setAttribute('aria-label', 'Delete session');
      delBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="3" x2="13" y2="13"></line>
          <line x1="13" y1="3" x2="3" y2="13"></line>
        </svg>
      `;

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSessionFromHistory(sess.id);
      });

      item.appendChild(titleSpan);
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        if (sess.id !== sessionId) {
          loadSession(sess.id);
        }
        closeDrawers();
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadSession(sess.id);
          closeDrawers();
        }
      });

      sessionList.appendChild(item);
    });
  }

  function deleteSessionFromHistory(id) {
    let sessions = getStoredSessions();
    sessions = sessions.filter(s => s.id !== id);
    saveStoredSessions(sessions);
    renderSessionList();
    if (id === sessionId) {
      newChat().catch(() => {});
    }
  }

  // --- Safe Markdown Parser ---
  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMarkdownSafe(rawText) {
    if (!rawText) return '';

    // Step 1: Extract code blocks before HTML escaping
    const codeBlocks = [];
    let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang || '', code: code.trim() });
      return id;
    });

    // Step 2: HTML Escape remaining text
    text = escapeHtml(text);

    // Step 3: Parse inline code `code`
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Step 4: Format Citation Tags [Source: filename, chunk N]
    text = text.replace(/\[Source:\s*([^,\]]+),\s*chunk\s*(\d+)\]/gi, (match, src, chunk) => {
      const cleanSrc = src.trim();
      const cleanChunk = chunk.trim();
      return `<button class="citation-badge" type="button" data-source="${cleanSrc}" data-chunk="${cleanChunk}" title="Inspect source excerpt">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-1px;margin-right:2px"><path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 2v10h6V3H5z"/></svg>
        [Source: ${cleanSrc}, chunk ${cleanChunk}]
      </button>`;
    });

    // Step 5: Parse Blockquotes
    text = text.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // Step 6: Parse Headings
    text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Step 7: Parse Bold and Italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Step 8: Parse Lists
    // Unordered
    text = text.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
      return `<ul>${match}</ul>`;
    });
    // Consolidate consecutive <ul> tags
    text = text.replace(/<\/ul>\s*<ul>/g, '');

    // Step 9: Parse Paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    text = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Don't wrap if already header, blockquote, list, or code placeholder
      if (/^<(h[1-4]|blockquote|ul|ol|pre)/i.test(trimmed) || trimmed.startsWith('__CODE_BLOCK_')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // Step 10: Re-inject code blocks
    codeBlocks.forEach((block, idx) => {
      const placeholder = `__CODE_BLOCK_${idx}__`;
      const escaped = escapeHtml(block.code);
      const htmlBlock = `<pre><code>${escaped}</code></pre>`;
      text = text.replace(placeholder, htmlBlock);
    });

    return text;
  }

  // Helper to format guest name cleanly from transcript path
  function formatGuestName(sourcePath) {
    if (!sourcePath) return 'Transcript Source';
    const parts = sourcePath.split(/[/\\]/);
    const guestFolder = parts[0] || sourcePath;
    return guestFolder
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // --- Message UI Rendering ---
  function addMessage(role, content, extraClass = '', isMarkdown = true) {
    const welcome = messages.querySelector('.welcome');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role} ${extraClass}`.trim();

    const header = document.createElement('div');
    header.className = 'message-header';

    const box = document.createElement('div');
    box.className = 'message-box';

    if (role === 'user') {
      header.textContent = 'You';
      box.textContent = content;
      wrapper.append(header, box);
    } else {
      // Assistant message header
      const identity = document.createElement('div');
      identity.className = 'assistant-identity';
      identity.innerHTML = `
        <span class="assistant-badge" aria-hidden="true">L</span>
        <span>Lenny Growth Assistant</span>
        <span class="assistant-model-tag" id="assistantModelTag">qwen3:4b </span>
      `;
      header.appendChild(identity);

      box.className = 'message-box editorial-prose';
      if (extraClass.includes('busy')) {
        box.innerHTML = `
          <div class="thinking-indicator">
            <div class="pulse-dots"><span></span><span></span><span></span></div>
            <span>${escapeHtml(content)}</span>
          </div>
        `;
      } else if (isMarkdown) {
        box.innerHTML = renderMarkdownSafe(content);
        attachCitationHandlers(box);
      } else {
        box.textContent = content;
      }

      // Action footer for assistant responses
      if (!extraClass.includes('busy') && !extraClass.includes('error')) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-msg-action';
        copyBtn.type = 'button';
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="5" y="5" width="9" height="9" rx="1.5"></rect>
            <path d="M5 2H3a1 1 0 0 0-1 1v8"></path>
          </svg>
          <span>Copy</span>
        `;
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(content).then(() => {
            copyBtn.querySelector('span').textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.querySelector('span').textContent = 'Copy';
            }, 2000);
          }).catch(() => {});
        });

        actions.appendChild(copyBtn);
        wrapper.append(header, box, actions);
      } else {
        wrapper.append(header, box);
      }
    }

    messages.appendChild(wrapper);
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
    return wrapper;
  }

  function attachCitationHandlers(container) {
    container.querySelectorAll('.citation-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        const sourceFile = badge.getAttribute('data-source');
        const chunkNum = badge.getAttribute('data-chunk');
        highlightSourceCard(sourceFile, chunkNum);
      });
    });
  }

  function highlightSourceCard(sourceFile, chunkNum) {
    // Switch to sources tab
    switchTab('sources');
    openResearchPanel();

    const cards = sourceList.querySelectorAll('.source-card');
    let matched = null;

    cards.forEach(card => {
      card.classList.remove('highlighted');
      const cardSrc = card.getAttribute('data-source');
      const cardChunk = card.getAttribute('data-chunk');
      if (cardSrc === sourceFile && cardChunk === chunkNum) {
        matched = card;
      }
    });

    if (matched) {
      matched.classList.add('highlighted');
      matched.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        matched.classList.remove('highlighted');
      }, 3500);
    }
  }

  // --- Reset to Welcome State ---
  function showWelcomeState() {
    messages.innerHTML = `
      <div class="welcome" id="emptyState">
        <div class="welcome-badge">Lenny's Podcast Knowledge Base</div>
        <h2 class="welcome-title">What are you working through?</h2>
        <p class="welcome-desc">
          Explore product management, growth loops, startup strategy, and career inflection points. Every answer is grounded directly in indexed podcast transcripts.
        </p>

        <div class="suggestions-section">
          <span class="suggestions-label">Explore research questions:</span>
          <div class="suggestions-grid">
            <button class="suggestion-item suggestion" type="button">
              <span class="suggestion-icon" aria-hidden="true">↗</span>
              <span class="suggestion-text">How do great product teams decide what to build?</span>
            </button>
            <button class="suggestion-item suggestion" type="button">
              <span class="suggestion-icon" aria-hidden="true">↗</span>
              <span class="suggestion-text">What makes a growth loop effective?</span>
            </button>
            <button class="suggestion-item suggestion" type="button">
              <span class="suggestion-icon" aria-hidden="true">↗</span>
              <span class="suggestion-text">How should I evaluate a career move?</span>
            </button>
            <button class="suggestion-item suggestion" type="button">
              <span class="suggestion-icon" aria-hidden="true">↗</span>
              <span class="suggestion-text">Summarize the strongest ideas on product-market fit.</span>
            </button>
          </div>
        </div>

        <div class="dataset-notice">
          <span class="dataset-icon" aria-hidden="true">ℹ</span>
          <span>Grounding dataset: indexed episodes featuring Ada Chen Rekhi, Adam Fishman, and top operators.</span>
        </div>
      </div>
    `;
    attachSuggestionHandlers();
  }

  function attachSuggestionHandlers() {
    document.querySelectorAll('.suggestion').forEach(button => {
      button.addEventListener('click', () => {
        const text = button.querySelector('.suggestion-text')?.textContent || button.textContent;
        sendMessage(text.trim());
      });
    });
  }

  // --- Session Switching & Creation ---
  async function newChat() {
    try {
      // If already on an empty welcome screen with no messages sent, avoid duplicate empty sessions
      const welcome = messages.querySelector('.welcome');
      if (welcome && sessionId) {
        if (promptBox) {
          promptBox.value = '';
          promptBox.style.height = 'auto';
          promptBox.focus();
        }
        closeDrawers();
        return;
      }

      const response = await fetch('/api/sessions', { method: 'POST' });
      if (!response.ok) throw new Error('Could not create a new chat session.');
      const data = await response.json();
      sessionId = data.session_id;

      // DO NOT record empty session in history list.
      // It will only be added to history once a message is actually sent.
      if (conversationTitle) conversationTitle.textContent = 'New research session';

      showWelcomeState();
      renderSources([]);
      resetArtifactPreview();
      renderSessionList(); // Re-render to ensure active state is updated

      if (promptBox) {
        promptBox.value = '';
        promptBox.style.height = 'auto';
        promptBox.focus();
      }
      closeDrawers();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }

  async function loadSession(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/sessions/${id}`);
      if (!response.ok) throw new Error('Could not load chat session.');
      const data = await response.json();

      sessionId = data.session_id;
      const cleanTitle = data.title && data.title !== 'New chat' ? data.title : 'Research Session';
      if (conversationTitle) {
        conversationTitle.textContent = cleanTitle;
      }

      messages.innerHTML = '';
      if (!data.messages || data.messages.length === 0) {
        showWelcomeState();
        // Remove empty session from saved history
        deleteSessionFromHistory(id);
      } else {
        data.messages.forEach(m => {
          addMessage(m.role, m.content, '', true);
        });
        if (data.title && data.title !== 'New chat' && data.title !== 'New research session') {
          recordSession(sessionId, data.title);
        }
      }

      renderSources([]);
      resetArtifactPreview();
      renderSessionList();
      closeDrawers();
    } catch (err) {
      console.error('Error loading session:', err);
    }
  }

  // --- System Health Check ---
  async function checkHealth() {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Health check error');
      const data = await response.json();

      const isOnline = data.ollama === 'available';
      if (modelPill) {
        modelPill.className = `model-pill ${isOnline ? 'online' : ''}`;
        modelPill.querySelector('.model-pill-label').textContent = `${data.model} · ${data.ollama}`;
      }

      if (systemStatusDot) {
        systemStatusDot.className = `status-dot ${isOnline ? 'online' : ''}`;
      }
      if (sidebarStatus) {
        sidebarStatus.textContent = isOnline ? `Local Ollama · ${data.model}` : 'Ollama unavailable';
      }
      if (sidebarStats) {
        const count = data.transcript_chunks || 0;
        sidebarStats.textContent = `${count} transcript passages indexed`;
      }
    } catch {
      if (modelPill) {
        modelPill.className = 'model-pill';
        modelPill.querySelector('.model-pill-label').textContent = 'API offline';
      }
      if (sidebarStatus) sidebarStatus.textContent = 'Backend offline';
    }
  }

  // --- Sources & Artifacts Rendering ---
  function renderSources(sources) {
    activeSources = sources || [];
    const count = activeSources.length;

    if (sourceBadge) sourceBadge.textContent = count;
    if (sourceCount) sourceCount.textContent = count;

    if (!count) {
      sourceList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">▤</div>
          <p>Sources will appear here when relevant transcript passages are found.</p>
        </div>
      `;
      return;
    }

    sourceList.innerHTML = '';
    activeSources.forEach(s => {
      const card = document.createElement('div');
      card.className = 'source-card';
      card.setAttribute('data-source', s.source);
      card.setAttribute('data-chunk', s.chunk);

      const guest = formatGuestName(s.source);

      card.innerHTML = `
        <div class="source-card-header">
          <span class="source-guest-title">${escapeHtml(guest)}</span>
          <span class="source-chunk-badge">Chunk ${escapeHtml(String(s.chunk))}</span>
        </div>
        <div class="source-file-path" title="${escapeHtml(s.source)}">${escapeHtml(s.source)}</div>
        <div class="source-excerpt">${escapeHtml(s.preview)}</div>
        <div class="source-card-footer">
          <button class="btn-copy-excerpt" type="button">Copy passage</button>
        </div>
      `;

      card.querySelector('.btn-copy-excerpt').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(s.preview).then(() => {
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Copy passage'; }, 2000);
        }).catch(() => {});
      });

      sourceList.appendChild(card);
    });
  }

  function resetArtifactPreview() {
    if (artifactDocument) artifactDocument.classList.add('hidden');
    const placeholder = document.querySelector('.artifact-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  }

  function checkAndRenderArtifact(answerText, userPrompt) {
    if (!answerText) return;
    const isEssayRequest = /(essay|memo|framework|teardown|guide|document|brief)/i.test(userPrompt || '');
    const hasStructure = answerText.includes('# ') || answerText.includes('## ') || answerText.split('\n\n').length >= 4;

    if (isEssayRequest && hasStructure) {
      const placeholder = document.querySelector('.artifact-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      if (artifactDocument && artifactDocBody) {
        artifactDocument.classList.remove('hidden');
        artifactDocBody.innerHTML = renderMarkdownSafe(answerText);
        // Switch to artifacts tab to highlight the new document
        switchTab('artifacts');
      }
    }
  }

  // --- Send Message Flow ---
  async function sendMessage(text) {
    const query = (text || '').trim();
    if (!query || isRequestInProgress) return;

    if (!sessionId) {
      await newChat();
    }

    addMessage('user', query);
    promptBox.value = '';
    promptBox.style.height = 'auto';

    isRequestInProgress = true;
    sendButton.disabled = true;
    sendButton.querySelector('.send-text').textContent = 'Thinking…';

    const pending = addMessage(
      'assistant',
      'Searching transcript passages and asking the local model…',
      'busy'
    );

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: query })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'The request failed.');
      }

      // Format response cleanly
      pending.classList.remove('busy');
      const box = pending.querySelector('.message-box');
      box.className = 'message-box editorial-prose';
      box.innerHTML = renderMarkdownSafe(data.answer);
      attachCitationHandlers(box);

      // Add copy action button
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-msg-action';
      copyBtn.type = 'button';
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="5" y="5" width="9" height="9" rx="1.5"></rect>
          <path d="M5 2H3a1 1 0 0 0-1 1v8"></path>
        </svg>
        <span>Copy</span>
      `;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.answer).then(() => {
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => { copyBtn.querySelector('span').textContent = 'Copy'; }, 2000);
        }).catch(() => {});
      });
      actions.appendChild(copyBtn);
      pending.appendChild(actions);

      // Render sources and update model pill
      renderSources(data.sources);
      if (modelPill) {
        modelPill.querySelector('.model-pill-label').textContent = `${data.model} · ${data.provider}`;
      }

      // Update session title and ensure session is saved in history
      const currentTitle = conversationTitle ? conversationTitle.textContent : '';
      if (currentTitle === 'New research session' || currentTitle === 'New chat' || !currentTitle) {
        const newTitle = query.length > 55 ? query.slice(0, 55) + '…' : query;
        if (conversationTitle) conversationTitle.textContent = newTitle;
        recordSession(sessionId, newTitle);
      } else {
        recordSession(sessionId, currentTitle);
      }

      // Check if user requested an artifact / document
      checkAndRenderArtifact(data.answer, query);

    } catch (error) {
      pending.classList.remove('busy');
      pending.classList.add('error');
      const box = pending.querySelector('.message-box');
      box.className = 'message-box';
      box.innerHTML = `
        <div class="error-banner">
          <div class="error-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="8" cy="8" r="7"></circle>
              <line x1="8" y1="4" x2="8" y2="9"></line>
              <line x1="8" y1="12" x2="8.01" y2="12"></line>
            </svg>
            <span>Model Request Error</span>
          </div>
          <p class="error-desc">${escapeHtml(error.message)}</p>
          <div class="error-actions">
            <button class="btn-error-retry" type="button">Retry Question</button>
            <button class="btn-error-restore" type="button">Edit in Input</button>
          </div>
        </div>
      `;

      box.querySelector('.btn-error-retry').addEventListener('click', () => {
        pending.remove();
        sendMessage(query);
      });

      box.querySelector('.btn-error-restore').addEventListener('click', () => {
        promptBox.value = query;
        promptBox.focus();
        adjustPromptHeight();
      });

    } finally {
      isRequestInProgress = false;
      sendButton.disabled = false;
      sendButton.querySelector('.send-text').textContent = 'Send';
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
      promptBox.focus();
    }
  }

  // --- Auto-resize Composer Textarea ---
  function adjustPromptHeight() {
    if (!promptBox) return;
    promptBox.style.height = 'auto';
    promptBox.style.height = Math.min(promptBox.scrollHeight, 180) + 'px';
  }

  // --- Panel & Tab Controls ---
  function switchTab(tabName) {
    if (tabName === 'sources') {
      tabSources.classList.add('active');
      tabSources.setAttribute('aria-selected', 'true');
      tabArtifacts.classList.remove('active');
      tabArtifacts.setAttribute('aria-selected', 'false');
      sourcesPanelSection.classList.remove('hidden');
      artifactsPanelSection.classList.add('hidden');
    } else {
      tabArtifacts.classList.add('active');
      tabArtifacts.setAttribute('aria-selected', 'true');
      tabSources.classList.remove('active');
      tabSources.setAttribute('aria-selected', 'false');
      artifactsPanelSection.classList.remove('hidden');
      sourcesPanelSection.classList.add('hidden');
    }
  }

  function openResearchPanel() {
    if (window.innerWidth <= 1100) {
      artifactPane.classList.add('open');
      if (panelBackdrop) panelBackdrop.classList.add('active');
    } else {
      appLayout.classList.remove('panel-collapsed');
    }
  }

  function toggleResearchPanel() {
    if (window.innerWidth <= 1100) {
      const isOpen = artifactPane.classList.contains('open');
      if (isOpen) {
        artifactPane.classList.remove('open');
        if (panelBackdrop) panelBackdrop.classList.remove('active');
      } else {
        artifactPane.classList.add('open');
        if (panelBackdrop) panelBackdrop.classList.add('active');
      }
    } else {
      appLayout.classList.toggle('panel-collapsed');
    }
  }

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
  }

  function closeDrawers() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    if (artifactPane) artifactPane.classList.remove('open');
    if (panelBackdrop) panelBackdrop.classList.remove('active');
  }

  // --- Event Listeners Initialization ---
  function initListeners() {
    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(promptBox.value);
    });

    // Auto-resizing textarea & keyboard submission
    promptBox.addEventListener('input', adjustPromptHeight);
    promptBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(promptBox.value);
      }
    });

    // New Chat Button
    document.getElementById('newChat').addEventListener('click', () => {
      newChat().catch(err => alert(err.message));
    });

    // Keyboard shortcut Alt+N for new chat
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        newChat();
      }
      if (e.key === 'Escape') {
        closeDrawers();
      }
    });

    // Clear History Button
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        saveStoredSessions([]);
        renderSessionList();
      });
    }

    // Panel tabs
    if (tabSources) tabSources.addEventListener('click', () => switchTab('sources'));
    if (tabArtifacts) tabArtifacts.addEventListener('click', () => switchTab('artifacts'));

    // Drawer and panel toggles
    if (panelToggle) panelToggle.addEventListener('click', toggleResearchPanel);
    if (closePanelBtn) closePanelBtn.addEventListener('click', closeDrawers);
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeDrawers);
    if (panelBackdrop) panelBackdrop.addEventListener('click', closeDrawers);

    // Artifact suggestion prompt buttons
    document.querySelectorAll('.artifact-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const promptText = btn.getAttribute('data-prompt');
        if (promptText) sendMessage(promptText);
      });
    });

    // Copy artifact button
    if (copyArtifactBtn && artifactDocBody) {
      copyArtifactBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(artifactDocBody.innerText).then(() => {
          copyArtifactBtn.textContent = 'Copied!';
          setTimeout(() => { copyArtifactBtn.textContent = 'Copy Document'; }, 2000);
        }).catch(() => {});
      });
    }

    // Suggestions in welcome screen
    attachSuggestionHandlers();
  }

  // --- Initial Boot Sequence ---
  renderSessionList();
  checkHealth();
  initListeners();

  // Try to load most recent session, or create fresh
  const stored = getStoredSessions();
  if (stored.length > 0) {
    loadSession(stored[0].id).catch(() => newChat());
  } else {
    newChat().catch(() => {});
  }

})();
