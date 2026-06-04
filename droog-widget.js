/**
 * droog-widget.js — Droog AI Chatbot Widget
 * Served at: https://droog-widget-assets.s3.ap-south-1.amazonaws.com/droog-widget.js
 *
 * Embed:
 *   <script src="..." data-bot-id="…" data-tenant-id="…" data-bot-name="…"
 *           data-primary-color="#6366f1" data-header-bg="#6366f1"
 *           data-header-text="#ffffff" data-footer-bg="#f9fafb"
 *           data-position="bottom-right|bottom-left|google-centered"
 *           data-prompts='["Question one?","Question two?"]'
 *           async></script>
 *
 * Session flow:
 *   1. POST /sessions  { tenant_id, bot_id }  → { session_id, ... }
 *   2. POST /chat      { session_id, tenant_id, bot_id, query } → { answer, session_end, ... }
 */
(function (doc) {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────

  var tag = doc.currentScript ||
    (function () {
      var tags = doc.querySelectorAll('script[src*="droog-widget"]');
      return tags[tags.length - 1] || null;
    }());

  if (!tag) return;

  var BOT_ID      = (tag.getAttribute('data-bot-id')        || '').trim();
  var TENANT_ID   = (tag.getAttribute('data-tenant-id')     || '').trim();
  var BOT_NAME    = (tag.getAttribute('data-bot-name')      || 'Droog Agent').trim();
  var COLOR       = (tag.getAttribute('data-primary-color') || '#6366f1').trim();
  var HEADER_BG   = (tag.getAttribute('data-header-bg')     || COLOR).trim();
  var HEADER_TXT  = (tag.getAttribute('data-header-text')   || '#ffffff').trim();
  var FOOTER_BG   = (tag.getAttribute('data-footer-bg')     || '#f9fafb').trim();
  var POSITION    = (tag.getAttribute('data-position')      || 'bottom-right').trim();
  var IS_CENTERED = POSITION === 'google-centered';
  var PANEL_SIDE  = IS_CENTERED ? 'right' : (POSITION === 'bottom-left' ? 'left' : 'right');
  var PROMPTS     = (function () {
    try { return JSON.parse(tag.getAttribute('data-prompts') || '[]'); } catch (e) { return []; }
  }());
  var API_BASE    = 'https://api.droog.io';

  if (!BOT_ID || !TENANT_ID) return;

  // ─── Session state ────────────────────────────────────────────────────────

  var SESSION_KEY      = 'droog_sid_' + BOT_ID;
  var sessionId        = sessionStorage.getItem(SESSION_KEY) || null;
  var sessionState     = sessionId ? 'ready' : 'idle';
  var minutesRemaining = null;  // from session_info.minutes_remaining in /chat responses
  var lastChatTime     = null;  // Date.now() snapshot when minutesRemaining was recorded

  var countdownSecondsLeft = 0;
  var countdownTimer       = null;  // setInterval — ticks every second
  var statusPollTimer      = null;  // setInterval — polls GET /sessions/:id/status every 5 s

  // ─── Utilities ────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function md(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>')
      .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
  }

  // Returns true when elapsed time since last response exceeds the server's remaining window.
  function isSessionLikelyExpired() {
    if (minutesRemaining === null || lastChatTime === null) return false;
    var elapsed = (Date.now() - lastChatTime) / 60000;
    return (minutesRemaining - elapsed) <= 0.5;
  }

  var CONV_END_RE = /\b(bye|goodbye|good\s+bye|thanks|thank\s+you|thank-you|cheers|exit|quit|done|see\s+you|farewell|ttyl|that['']?s\s+all|all\s+set|no\s+more|i[''']m\s+good)\b/i;
  function isConversationEnd(text) { return CONV_END_RE.test(text.trim()); }

  function clearSessionState() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionId        = null;
    sessionState     = 'idle';
    minutesRemaining = null;
    lastChatTime     = null;
    pendingRating    = false;
    if (statusEl) statusEl.textContent = 'Online';
    var rc = doc.getElementById('droog-rating-card');
    if (rc) rc.remove();
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────

  var OFFSET = '24px';

  var css = [
    // Launcher bubble (not used in google-centered mode)
    '#droog-launcher{',
      'position:fixed;bottom:' + OFFSET + ';' + PANEL_SIDE + ':' + OFFSET + ';',
      'width:56px;height:56px;border-radius:50%;',
      'background:' + COLOR + ';border:none;cursor:pointer;',
      'box-shadow:0 4px 16px rgba(0,0,0,.25);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:2147483640;transition:transform .2s,box-shadow .2s;padding:0;outline:none;',
    '}',
    '#droog-launcher:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,.3)}',
    '#droog-launcher:focus-visible{outline:3px solid ' + COLOR + ';outline-offset:3px}',
    '#droog-launcher svg{pointer-events:none}',
    '#droog-launcher .droog-chat-icon{}',
    '#droog-launcher .droog-x-icon{display:none}',
    '#droog-launcher .droog-badge{',
      'position:absolute;top:1px;right:1px;',
      'width:14px;height:14px;border-radius:50%;',
      'background:#ef4444;border:2px solid #fff;display:none;',
    '}',
    '#droog-launcher .droog-badge.on{display:block}',

    // Inline search bar — rendered inside [droog_search_bar] shortcode anchor
    '.droog-search-bar-wrap{width:100%}',
    '#droog-search-bar-inline{',
      'display:flex;align-items:center;gap:12px;',
      'width:100%;box-sizing:border-box;',
      'background:#fff;',
      'border:1.5px solid ' + COLOR + ';',
      'border-radius:12px;padding:12px 16px;',
      'box-shadow:0 2px 12px rgba(0,0,0,.08);',
      'cursor:text;transition:box-shadow .2s ease;',
    '}',
    '#droog-search-bar-inline:focus-within{box-shadow:0 4px 20px rgba(0,0,0,.12)}',
    '#droog-search-bar-inline .dsb-icon{',
      'font-size:18px;flex-shrink:0;user-select:none;line-height:1;color:' + COLOR + ';',
    '}',
    '#droog-search-bar-inline .dsb-input{',
      'flex:1;background:none;border:none;outline:none;',
      'color:#111827;font-size:15px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'caret-color:' + COLOR + ';',
    '}',
    '#droog-search-bar-inline .dsb-input::placeholder{color:#9ca3af}',
    '#droog-search-bar-inline .dsb-send{',
      'width:36px;height:36px;border-radius:50%;',
      'background:' + COLOR + ';border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;transition:filter .15s,transform .1s;color:#fff;',
    '}',
    '#droog-search-bar-inline .dsb-send:hover{filter:brightness(1.1)}',
    '#droog-search-bar-inline .dsb-send:active{transform:scale(.9)}',

    // Chat panel
    '#droog-panel{',
      'position:fixed;bottom:calc(' + OFFSET + ' + 64px);' + PANEL_SIDE + ':' + OFFSET + ';',
      'width:380px;max-width:calc(100vw - 48px);',
      'height:560px;max-height:calc(100vh - 100px);',
      'background:#fff;border-radius:16px;',
      'box-shadow:0 8px 40px rgba(0,0,0,.18);',
      'display:flex;flex-direction:column;overflow:hidden;',
      'z-index:2147483639;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'font-size:14px;line-height:1.5;',
      'transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;',
      'transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .18s ease;',
    '}',
    '#droog-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:auto}',

    // Minimized — collapses to header bar only
    '#droog-panel.minimized{height:auto;cursor:pointer}',
    '#droog-panel.minimized .dc-msgs{display:none}',
    '#droog-panel.minimized .dc-input-wrap{display:none}',
    '#droog-panel.minimized .dc-footer{display:none}',

    // Header
    '.dc-header{',
      'background:' + HEADER_BG + ';color:' + HEADER_TXT + ';',
      'padding:14px 16px;display:flex;align-items:center;gap:8px;flex-shrink:0;',
    '}',
    '.dc-avatar{width:32px;height:32px;border-radius:50%;background:rgba(128,128,128,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.dc-info{flex:1;min-width:0}',
    '.dc-name{font-weight:600;font-size:15px}',
    '.dc-status{font-size:11px;opacity:.7}',

    // Three-dots menu
    '.dc-menu-wrap{position:relative;flex-shrink:0}',
    '.dc-menu-btn{',
      'background:none;border:none;cursor:pointer;',
      'color:' + HEADER_TXT + ';opacity:.7;',
      'padding:4px 6px;border-radius:6px;display:flex;align-items:center;justify-content:center;',
      'transition:opacity .15s,background .15s;',
    '}',
    '.dc-menu-btn:hover{opacity:1;background:rgba(128,128,128,.2)}',
    '.dc-menu-dropdown{',
      'position:absolute;top:calc(100% + 6px);right:0;',
      'background:#fff;border:1px solid #e5e7eb;border-radius:10px;',
      'box-shadow:0 4px 20px rgba(0,0,0,.14);',
      'min-width:160px;overflow:hidden;z-index:10;display:none;',
    '}',
    '.dc-menu-dropdown.open{display:block}',
    '.dc-menu-item{',
      'display:block;width:100%;padding:10px 16px;text-align:left;',
      'background:none;border:none;cursor:pointer;',
      'font-size:13px;color:#374151;font-family:inherit;',
      'transition:background .1s;',
    '}',
    '.dc-menu-item:hover{background:#f9fafb}',
    '.dc-menu-item.danger{color:#dc2626}',
    '.dc-menu-item.danger:hover{background:#fef2f2}',

    // Minimize button (replaces old close button)
    '.dc-minimize{',
      'background:none;border:none;cursor:pointer;',
      'color:' + HEADER_TXT + ';opacity:.7;',
      'padding:4px;border-radius:6px;display:flex;',
      'transition:opacity .15s,background .15s;flex-shrink:0;',
    '}',
    '.dc-minimize:hover{opacity:1;background:rgba(128,128,128,.2)}',

    // Messages
    '.dc-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}',
    '.dc-msgs::-webkit-scrollbar{width:4px}',
    '.dc-msgs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}',

    '.dc-row{display:flex;align-items:flex-end;gap:8px;max-width:85%;animation:dcFadeUp .2s ease}',
    '@keyframes dcFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
    '.dc-row.bot{align-self:flex-start}',
    '.dc-row.usr{align-self:flex-end;flex-direction:row-reverse}',

    '.dc-row-avatar{width:28px;height:28px;border-radius:50%;background:' + COLOR + ';',
      'color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px}',

    '.dc-bubble{padding:10px 14px;border-radius:16px;word-break:break-word}',
    '.bot .dc-bubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:4px}',
    '.usr .dc-bubble{background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px}',
    '.dc-bubble code{font-family:"Courier New",monospace;font-size:.9em;background:rgba(0,0,0,.08);padding:1px 4px;border-radius:3px}',
    '.usr .dc-bubble code{background:rgba(255,255,255,.2)}',
    '.dc-bubble a{color:inherit;text-decoration:underline}',

    // Typing dots
    '.dc-typing .dc-bubble{padding:14px 16px}',
    '.dc-dots{display:flex;gap:4px;align-items:center}',
    '.dc-dots span{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:dcBounce 1.2s infinite}',
    '.dc-dots span:nth-child(2){animation-delay:.2s}',
    '.dc-dots span:nth-child(3){animation-delay:.4s}',
    '@keyframes dcBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',

    // Per-message feedback thumbs
    '.dc-feedback{display:flex;gap:4px;margin-top:6px;padding-left:2px}',
    '.dc-fb-btn{',
      'background:none;border:1px solid #e5e7eb;border-radius:6px;',
      'padding:2px 7px;font-size:13px;line-height:1.6;cursor:pointer;',
      'transition:background .1s,border-color .1s;',
    '}',
    '.dc-fb-btn:hover:not(:disabled){background:#f3f4f6;border-color:#d1d5db}',
    '.dc-fb-btn.active{background:#f0fdf4;border-color:#86efac}',
    '.dc-fb-btn.active-down{background:#fef2f2;border-color:#fca5a5}',
    '.dc-fb-btn:disabled{cursor:default;opacity:.55}',

    // Session rating card (shown after isConversationEnd)
    '.dc-rating-card{',
      'background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;',
      'padding:16px 20px;align-self:stretch;animation:dcFadeUp .2s ease;',
    '}',
    '.dc-rating-title{font-size:13px;font-weight:600;color:#374151;',
      'margin-bottom:12px;text-align:center}',
    '.dc-stars{display:flex;justify-content:center;gap:4px;margin-bottom:14px}',
    '.dc-star{',
      'background:none;border:none;cursor:pointer;',
      'font-size:26px;color:#d1d5db;',
      'transition:color .1s,transform .1s;line-height:1;padding:0 2px;',
    '}',
    '.dc-star:hover,.dc-star.hover{color:#fbbf24;transform:scale(1.12)}',
    '.dc-star.active{color:#f59e0b}',
    '.dc-rating-actions{display:flex;align-items:center;justify-content:center;gap:14px}',
    '.dc-rating-submit{',
      'background:' + COLOR + ';color:#fff;border:none;border-radius:8px;',
      'padding:8px 22px;font-size:13px;font-family:inherit;cursor:pointer;',
      'transition:filter .15s;',
    '}',
    '.dc-rating-submit:hover:not(:disabled){filter:brightness(1.1)}',
    '.dc-rating-submit:disabled{opacity:.4;cursor:not-allowed}',
    '.dc-rating-skip{',
      'background:none;border:none;cursor:pointer;',
      'font-size:12px;color:#9ca3af;font-family:inherit;text-decoration:underline;',
    '}',
    '.dc-rating-skip:hover{color:#6b7280}',

    // Sources
    '.dc-sources{margin-top:6px;font-size:11px;color:#6b7280}',
    '.dc-sources a{color:' + COLOR + ';text-decoration:none}',
    '.dc-sources a:hover{text-decoration:underline}',

    // Input area
    '.dc-input-wrap{border-top:1px solid #e5e7eb;padding:12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;background:' + FOOTER_BG + '}',
    '.dc-textarea{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:9px 12px;',
      'font-size:14px;font-family:inherit;line-height:1.4;resize:none;',
      'min-height:40px;max-height:120px;outline:none;transition:border-color .15s;',
      'color:#111827;background:#fff}',
    '.dc-textarea:focus{border-color:' + COLOR + '}',
    '.dc-textarea::placeholder{color:#9ca3af}',
    '.dc-send{width:40px;height:40px;border-radius:10px;background:' + COLOR + ';',
      'border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;transition:filter .15s,transform .1s;color:#fff}',
    '.dc-send:hover{filter:brightness(1.1)}',
    '.dc-send:active{transform:scale(.93)}',
    '.dc-send:disabled{opacity:.4;cursor:not-allowed;transform:none}',

    // Powered-by footer
    '.dc-footer{text-align:center;padding:6px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;flex-shrink:0;background:' + FOOTER_BG + '}',
    '.dc-footer a{color:#9ca3af;text-decoration:none}',
    '.dc-footer a:hover{text-decoration:underline}',

    // Mobile
    '@media(max-width:480px){',
      '#droog-panel{bottom:0;left:0!important;right:0!important;',
        'width:100%;max-width:100%;height:85dvh;max-height:85dvh;',
        'border-bottom-left-radius:0;border-bottom-right-radius:0}',
      '#droog-launcher{bottom:16px;' + PANEL_SIDE + ':16px}',
    '}',
  ].join('');

  // ─── SVGs ─────────────────────────────────────────────────────────────────

  var SVG_CHAT     = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var SVG_X_LG     = '<svg class="droog-x-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var SVG_USER     = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>';
  var SVG_SEND     = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var SVG_MINIMIZE = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var SVG_DOTS     = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/></svg>';

  // ─── Inject styles ────────────────────────────────────────────────────────

  var styleEl = doc.createElement('style');
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);

  // ─── Build DOM ────────────────────────────────────────────────────────────

  var launcher    = null;
  var searchBar   = null;
  var searchInput = null;

  if (IS_CENTERED) {
    var anchor = doc.getElementById('droog-search-bar-anchor');
    if (anchor) {
      searchBar = doc.createElement('div');
      searchBar.id = 'droog-search-bar-inline';
      searchBar.setAttribute('role', 'search');
      searchBar.setAttribute('aria-label', 'Ask ' + BOT_NAME);
      searchBar.innerHTML =
        '<span class="dsb-icon">✦</span>' +
        '<input class="dsb-input" id="droog-sb-input" type="text" ' +
          'placeholder="Ask me anything…" autocomplete="off" aria-label="Type your question" />' +
        '<button class="dsb-send" id="droog-sb-send" aria-label="Send">' + SVG_SEND + '</button>';
      anchor.appendChild(searchBar);
      searchInput = doc.getElementById('droog-sb-input');
    } else {
      console.warn('[Droog] google-centered mode requires the [droog_search_bar] shortcode on this page.');
    }
  } else {
    launcher = doc.createElement('button');
    launcher.id = 'droog-launcher';
    launcher.setAttribute('aria-label', 'Open chat');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'droog-panel');
    launcher.innerHTML =
      '<span class="droog-chat-icon">' + SVG_CHAT + '</span>' +
      SVG_X_LG +
      '<span class="droog-badge" aria-hidden="true"></span>';
    doc.body.appendChild(launcher);
  }

  // Chat panel (shared by both modes)
  var panel = doc.createElement('div');
  panel.id = 'droog-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', esc(BOT_NAME) + ' Chat');
  panel.innerHTML =
    '<div class="dc-header">' +
      '<div class="dc-avatar">' + SVG_USER + '</div>' +
      '<div class="dc-info">' +
        '<div class="dc-name">' + esc(BOT_NAME) + '</div>' +
        '<div class="dc-status">Online</div>' +
      '</div>' +
      '<div class="dc-menu-wrap">' +
        '<button class="dc-menu-btn" id="droog-menu-btn" ' +
          'aria-label="More options" aria-haspopup="true" aria-expanded="false">' +
          SVG_DOTS +
        '</button>' +
        '<div class="dc-menu-dropdown" id="droog-menu-dropdown" role="menu">' +
          '<button class="dc-menu-item danger" id="droog-end-session" role="menuitem">End Session</button>' +
        '</div>' +
      '</div>' +
      '<button class="dc-minimize" id="droog-minimize" aria-label="Minimize chat">' + SVG_MINIMIZE + '</button>' +
    '</div>' +
    '<div class="dc-msgs" id="droog-msgs" aria-live="polite" aria-label="Chat messages" role="log"></div>' +
    '<div class="dc-input-wrap">' +
      '<textarea class="dc-textarea" id="droog-ta" placeholder="Ask anything…" rows="1" aria-label="Type a message"></textarea>' +
      '<button class="dc-send" id="droog-send" aria-label="Send" disabled>' + SVG_SEND + '</button>' +
    '</div>' +
    '<div class="dc-footer"><a href="https://droog.io" target="_blank" rel="noopener">Powered by Droog</a></div>';
  doc.body.appendChild(panel);

  // ─── Element refs ─────────────────────────────────────────────────────────

  var msgsEl   = doc.getElementById('droog-msgs');
  var taEl     = doc.getElementById('droog-ta');
  var sendEl   = doc.getElementById('droog-send');
  var menuBtn  = doc.getElementById('droog-menu-btn');
  var menuDrop = doc.getElementById('droog-menu-dropdown');
  var statusEl = panel.querySelector('.dc-status');
  var badge    = launcher ? launcher.querySelector('.droog-badge')    : null;
  var chatIcon = launcher ? launcher.querySelector('.droog-chat-icon'): null;
  var xIcon    = launcher ? launcher.querySelector('.droog-x-icon')   : null;

  // ─── UI state ─────────────────────────────────────────────────────────────

  var isOpen        = false;
  var isBusy        = false;
  var hasGreeted    = false;
  var isMinimized   = false;
  var pendingRating = false;  // true when user's last message matched isConversationEnd

  // ─── Typewriter animation (google-centered only) ──────────────────────────

  var twTimer    = null;
  var twIdx      = 0;
  var twChar     = 0;
  var twDeleting = false;
  var twActive   = false;

  function startTypewriter() {
    if (!searchInput || PROMPTS.length === 0) return;
    twActive = true;
    typeStep();
  }

  function stopTypewriter() {
    twActive = false;
    if (twTimer) { clearTimeout(twTimer); twTimer = null; }
  }

  function typeStep() {
    if (!twActive) return;
    var current = PROMPTS[twIdx % PROMPTS.length];
    if (twDeleting) { twChar--; } else { twChar++; }
    searchInput.placeholder = current.slice(0, twChar);

    var delay = twDeleting ? 35 : 75;
    if (!twDeleting && twChar === current.length) {
      delay = 2200; twDeleting = true;
    } else if (twDeleting && twChar === 0) {
      twDeleting = false; twIdx++; delay = 400;
    }
    twTimer = setTimeout(typeStep, delay);
  }

  // ─── Panel open / close / minimize ───────────────────────────────────────

  function closeMenu() {
    menuDrop.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function openPanel(prefill) {
    isOpen      = true;
    isMinimized = false;
    panel.classList.add('open');
    panel.classList.remove('minimized');
    if (launcher) {
      launcher.setAttribute('aria-expanded', 'true');
      chatIcon.style.display = 'none';
      xIcon.style.display    = '';
      if (badge) badge.classList.remove('on');
    }
    if (searchInput) stopTypewriter();
    if (prefill) {
      taEl.value = prefill;
      taEl.style.height = 'auto';
      taEl.style.height = Math.min(taEl.scrollHeight, 120) + 'px';
      sendEl.disabled = false;
    } else {
      taEl.focus();
    }
    if (sessionState === 'idle') {
      initSession(prefill);
    } else if (sessionState === 'ready') {
      if (!hasGreeted) {
        hasGreeted = true;
        appendBot('Hi! 👋 I\'m ' + BOT_NAME + '. How can I help you today?');
      }
      if (prefill) sendMessage(prefill);
    }
  }

  function closePanel() {
    isOpen      = false;
    isMinimized = false;
    panel.classList.remove('open', 'minimized');
    closeMenu();
    if (launcher) {
      launcher.setAttribute('aria-expanded', 'false');
      chatIcon.style.display = '';
      xIcon.style.display    = 'none';
      launcher.focus();
    }
    if (searchInput) {
      searchInput.value = '';
      startTypewriter();
    }
  }

  function minimizePanel() {
    isMinimized = true;
    panel.classList.add('minimized');
    closeMenu();
  }

  function restorePanel() {
    isMinimized = false;
    panel.classList.remove('minimized');
    taEl.focus();
  }

  // ─── Message rendering ────────────────────────────────────────────────────

  function scrollDown() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function makeAvatarDiv() {
    var d = doc.createElement('div');
    d.className = 'dc-row-avatar';
    d.innerHTML = SVG_USER;
    return d;
  }

  function appendBot(text, sources, showFeedback) {
    var row    = doc.createElement('div'); row.className = 'dc-row bot';
    var inner  = doc.createElement('div');
    var bubble = doc.createElement('div'); bubble.className = 'dc-bubble';
    bubble.innerHTML = md(text);
    inner.appendChild(bubble);
    if (sources && sources.length) inner.appendChild(makeSources(sources));
    if (showFeedback) {
      var capturedSid  = sessionId;
      var capturedText = text;
      var fbRow  = doc.createElement('div'); fbRow.className = 'dc-feedback';
      var thumbUp   = doc.createElement('button');
      var thumbDown = doc.createElement('button');
      thumbUp.className   = 'dc-fb-btn'; thumbUp.textContent   = '👍';
      thumbDown.className = 'dc-fb-btn'; thumbDown.textContent = '👎';
      thumbUp.setAttribute('aria-label', 'Helpful');
      thumbDown.setAttribute('aria-label', 'Not helpful');
      fbRow.appendChild(thumbUp); fbRow.appendChild(thumbDown);
      inner.appendChild(fbRow);
      function sendFeedback(val, selected, other) {
        selected.disabled = true; other.disabled = true;
        selected.classList.add(val === 'up' ? 'active' : 'active-down');
        fetch(API_BASE + '/chat/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: TENANT_ID,
            session_id: capturedSid,
            bot_id:    BOT_ID,
            message:   capturedText,
            feedback:  val,
          }),
        }).catch(function (err) { console.error('[Droog feedback]', err); });
      }
      thumbUp.addEventListener('click',   function () { sendFeedback('up',   thumbUp,   thumbDown); });
      thumbDown.addEventListener('click', function () { sendFeedback('down', thumbDown, thumbUp);   });
    }
    row.appendChild(makeAvatarDiv());
    row.appendChild(inner);
    msgsEl.appendChild(row);
    scrollDown();
    return { row: row, bubble: bubble, inner: inner };
  }

  function appendUser(text) {
    var row    = doc.createElement('div'); row.className = 'dc-row usr';
    var bubble = doc.createElement('div'); bubble.className = 'dc-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    msgsEl.appendChild(row);
    scrollDown();
  }

  function appendTyping() {
    var row = doc.createElement('div');
    row.className = 'dc-row bot dc-typing';
    row.innerHTML = '<div class="dc-bubble"><div class="dc-dots"><span></span><span></span><span></span></div></div>';
    row.insertBefore(makeAvatarDiv(), row.firstChild);
    msgsEl.appendChild(row);
    scrollDown();
    return row;
  }

  function makeSources(sources) {
    var div = doc.createElement('div'); div.className = 'dc-sources';
    var links = sources.map(function (s, i) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">[' +
        (i + 1) + '] ' + esc(s.title || s.url) + '</a>';
    }).join(' &middot; ');
    div.innerHTML = 'Sources: ' + links;
    return div;
  }

  function setDisabled(val) { taEl.disabled = val; sendEl.disabled = val; }

  // ─── Session shutdown helpers ─────────────────────────────────────────────

  // Fire-and-forget — marks session abandoned in DB (timer=0, tab close).
  // Body is camelCase to match EmbedChatUI / abandon endpoint contract.
  function abandonSession() {
    if (!sessionId) return;
    fetch(API_BASE + '/chat/session/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, tenantId: TENANT_ID, botId: BOT_ID }),
    }).catch(function (err) { console.error('[Droog abandon]', err); });
  }

  // Central cleanup called by all expiry paths (except silent 404 recovery).
  function handleSessionExpired(message) {
    stopCountdown();
    stopStatusPoll();
    clearSessionState();
    closeMenu();
    appendBot(message || 'This session has ended. Type a new message to start a fresh conversation.');
    taEl.disabled   = false;
    sendEl.disabled = true;
    if (isOpen && !isMinimized) taEl.focus();
  }

  // ─── Session rating (shown after isConversationEnd) ───────────────────────

  function submitRating(rating, card) {
    var sid = sessionId;
    card.remove();
    setDisabled(false); // re-enable briefly so handleSessionExpired can focus
    if (rating && sid) {
      fetch(API_BASE + '/chat/conversation-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: TENANT_ID, bot_id: BOT_ID, session_id: sid, rating: rating }),
      }).catch(function (err) { console.error('[Droog rating]', err); });
    }
    if (sid) {
      fetch(API_BASE + '/sessions/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, tenant_id: TENANT_ID }),
      }).catch(function (err) { console.error('[Droog terminate]', err); });
    }
    handleSessionExpired('Thanks for chatting! Type a new message to start a fresh conversation.');
  }

  function showRatingCard() {
    setDisabled(true);  // lock input while rating is visible
    var card = doc.createElement('div');
    card.className = 'dc-rating-card'; card.id = 'droog-rating-card';
    card.innerHTML =
      '<div class="dc-rating-title">How was your experience?</div>' +
      '<div class="dc-stars">' +
        '<button class="dc-star" data-v="1">★</button>' +
        '<button class="dc-star" data-v="2">★</button>' +
        '<button class="dc-star" data-v="3">★</button>' +
        '<button class="dc-star" data-v="4">★</button>' +
        '<button class="dc-star" data-v="5">★</button>' +
      '</div>' +
      '<div class="dc-rating-actions">' +
        '<button class="dc-rating-submit" disabled>Submit</button>' +
        '<button class="dc-rating-skip">Skip</button>' +
      '</div>';
    msgsEl.appendChild(card);
    scrollDown();

    var stars    = card.querySelectorAll('.dc-star');
    var submitBtn = card.querySelector('.dc-rating-submit');
    var skipBtn   = card.querySelector('.dc-rating-skip');
    var selected  = 0;

    stars.forEach(function (star, idx) {
      star.addEventListener('click', function () {
        selected = idx + 1;
        stars.forEach(function (s, i) { s.classList.toggle('active', i < selected); });
        submitBtn.disabled = false;
      });
      star.addEventListener('mouseover', function () {
        stars.forEach(function (s, i) { s.classList.toggle('hover', i <= idx); });
      });
      star.addEventListener('mouseout', function () {
        stars.forEach(function (s) { s.classList.remove('hover'); });
      });
    });

    submitBtn.addEventListener('click', function () {
      if (!selected) return;
      submitRating(selected, card);
    });
    skipBtn.addEventListener('click', function () { submitRating(null, card); });
  }

  // ─── Countdown timer ──────────────────────────────────────────────────────

  function updateStatusDisplay(seconds) {
    if (!statusEl) return;
    if (seconds <= 0) { statusEl.textContent = 'Session ended'; return; }
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    statusEl.textContent = m + ':' + (s < 10 ? '0' : '') + s + ' remaining';
  }

  function stopCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function startCountdown(seconds) {
    stopCountdown();
    countdownSecondsLeft = Math.round(seconds);
    updateStatusDisplay(countdownSecondsLeft);
    countdownTimer = setInterval(function () {
      countdownSecondsLeft--;
      updateStatusDisplay(countdownSecondsLeft);
      if (countdownSecondsLeft <= 0) {
        stopCountdown();
        abandonSession();
        handleSessionExpired('Your session timed out. Type a new message to start a fresh one.');
      }
    }, 1000);
  }

  // ─── Server status poll ───────────────────────────────────────────────────

  function stopStatusPoll() {
    if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }
  }

  function startStatusPoll() {
    stopStatusPoll();
    statusPollTimer = setInterval(function () {
      if (!sessionId) { stopStatusPoll(); return; }
      fetch(API_BASE + '/sessions/' + sessionId + '/status')
        .then(function (res) {
          if (res.status === 440 || res.status === 404) {
            handleSessionExpired();
            return null;
          }
          return res.json();
        })
        .then(function (data) {
          if (data && data.reconnect_required) handleSessionExpired();
        })
        .catch(function () { /* network hiccup — retry next tick */ });
    }, 5000);
  }

  // ─── Session init ─────────────────────────────────────────────────────────

  function initSession(pendingMessage) {
    if (sessionState === 'loading') return;
    sessionState = 'loading';
    setDisabled(true);
    var typingRow = appendTyping();

    fetch(API_BASE + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID, bot_id: BOT_ID }),
    })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      typingRow.remove();
      sessionId = data.session_id;
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionState = 'ready';
      startStatusPoll();
      if (!hasGreeted) {
        hasGreeted = true;
        appendBot('Hi! 👋 I\'m ' + BOT_NAME + '. How can I help you today?');
      }
      if (pendingMessage) {
        sendMessage(pendingMessage);
      } else {
        setDisabled(false);
        sendEl.disabled = true;
        taEl.focus();
      }
    })
    .catch(function (err) {
      typingRow.remove();
      sessionState = 'error';
      appendBot('Couldn\'t start a session. Please refresh the page and try again.');
      console.error('[Droog /sessions]', err);
    });
  }

  // ─── End session (via menu) ───────────────────────────────────────────────

  function endSession() {
    if (isBusy || sessionState === 'loading') return;
    var sid = sessionId;  // capture before clearSessionState wipes it
    if (sid) {
      fetch(API_BASE + '/sessions/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, tenant_id: TENANT_ID }),
      }).catch(function (err) { console.error('[Droog terminate]', err); });
    }
    handleSessionExpired('Session ended. Type a new message to start a fresh conversation.');
  }

  // ─── Send message ─────────────────────────────────────────────────────────

  function sendMessage(text) {
    if (isBusy || !text) return;

    // Proactively restart when idle (e.g. after End Session) or when
    // we know the server-side session has almost certainly expired.
    if (sessionState === 'idle' ||
        (sessionState === 'ready' && isSessionLikelyExpired())) {
      clearSessionState();
      initSession(text);
      return;
    }

    if (sessionState !== 'ready') return;

    // Flag if this message sounds like a goodbye so we show the rating card after the response.
    if (isConversationEnd(text)) pendingRating = true;

    isBusy = true;
    setDisabled(true);
    taEl.value        = '';
    taEl.style.height = 'auto';
    sendEl.disabled   = true;
    appendUser(text);
    var typingRow  = appendTyping();
    var recovering = false;

    fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_id:  TENANT_ID,
        bot_id:     BOT_ID,
        query:      text,
      }),
    })
    .then(function (res) {
      // 404 = server-side session gone (restart or 20-min timeout).
      // Clear stale ID and silently rebuild, then replay the message.
      if (res.status === 404) {
        typingRow.remove();
        clearSessionState();
        isBusy     = false;
        recovering = true;
        initSession(text);
        return null;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (recovering || data === null) return;
      typingRow.remove();

      // Record remaining session time and start the visible countdown.
      if (data.session_info && data.session_info.minutes_remaining != null) {
        minutesRemaining = data.session_info.minutes_remaining;
        lastChatTime     = Date.now();
        startCountdown(minutesRemaining * 60);
      }

      appendBot(
        data.answer || 'Sorry, I didn\'t catch that.',
        data.show_sources && data.sources ? data.sources : null,
        true  // always show 👍/👎 on /chat responses
      );

      if (pendingRating) {
        // Rating card handles terminate + cleanup — skip session_end handling here.
        pendingRating = false;
        showRatingCard();
      } else if (data.session_end) {
        handleSessionExpired('This session has ended. Type a new message to start a fresh one.');
      }
    })
    .catch(function (err) {
      if (recovering) return;
      typingRow.remove();
      appendBot('Sorry, something went wrong. Please try again in a moment.');
      console.error('[Droog /chat]', err);
    })
    .then(function () {
      if (recovering) return;
      isBusy = false;
      if (sessionState === 'error') {
        setDisabled(true);
      } else if (sessionState === 'idle') {
        // Session ended (server session_end) — let user type to restart.
        taEl.disabled   = false;
        sendEl.disabled = !taEl.value.trim();
      } else if (doc.getElementById('droog-rating-card')) {
        // Rating card is visible — input stays locked until user submits/skips.
      } else {
        setDisabled(false);
        sendEl.disabled = true;
        taEl.focus();
      }
      if (!isOpen && badge) badge.classList.add('on');
    });
  }

  // ─── Event listeners ──────────────────────────────────────────────────────

  if (launcher) {
    launcher.addEventListener('click', function () {
      isOpen ? closePanel() : openPanel(null);
    });
  }

  if (searchBar) {
    searchBar.addEventListener('click', function () { searchInput.focus(); });
    searchInput.addEventListener('focus', function () { stopTypewriter(); });
    searchInput.addEventListener('blur', function () {
      if (!this.value.trim()) startTypewriter();
    });
    var sbSend = doc.getElementById('droog-sb-send');
    sbSend.addEventListener('click', function () {
      var v = searchInput.value.trim();
      if (v) openPanel(v);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var v = this.value.trim();
        if (v) openPanel(v);
      }
    });
    startTypewriter();
  }

  // Minimize button — collapses panel to header bar
  doc.getElementById('droog-minimize').addEventListener('click', minimizePanel);

  // Clicking the header body (not the buttons) when minimized restores the panel
  panel.querySelector('.dc-header').addEventListener('click', function (e) {
    if (isMinimized &&
        !e.target.closest('.dc-menu-wrap') &&
        !e.target.closest('#droog-minimize')) {
      restorePanel();
    }
  });

  // Three-dots menu toggle
  menuBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var opened = menuDrop.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(opened));
  });

  // Clicking outside the menu closes it
  doc.addEventListener('click', function () {
    if (menuDrop.classList.contains('open')) closeMenu();
  });

  // End Session menu item
  doc.getElementById('droog-end-session').addEventListener('click', function (e) {
    e.stopPropagation();
    endSession();
  });

  sendEl.addEventListener('click', function () {
    var v = taEl.value.trim();
    if (v) sendMessage(v);
  });

  taEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    sendEl.disabled = !this.value.trim();
  });

  taEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var v = this.value.trim();
      if (v && !isBusy) sendMessage(v);
    }
  });

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      if (menuDrop.classList.contains('open')) {
        closeMenu();
      } else {
        closePanel();
      }
    }
  });

  // Abandon session on tab close / navigation — sendBeacon is fire-and-forget
  // and survives page unload where fetch() would be cancelled.
  window.addEventListener('beforeunload', function () {
    if (!sessionId) return;
    var body = JSON.stringify({ sessionId: sessionId, tenantId: TENANT_ID, botId: BOT_ID });
    navigator.sendBeacon(
      API_BASE + '/chat/session/abandon',
      new Blob([body], { type: 'application/json' })
    );
  });

}(document));
