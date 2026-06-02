/* ── MTG Builder — deck builder page ──────────────────────────
   Requires auth.js to be loaded first (provides getToken / user state)
   ─────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Redirect if not logged in ──────────────────────────────
  const token = localStorage.getItem('mtg_token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // ── DOM refs ───────────────────────────────────────────────
  const usernameEl        = document.getElementById('builder-username');
  const logoutBtn         = document.getElementById('builder-logout');
  const newDeckBtn        = document.getElementById('new-deck-btn');
  const deckListEl        = document.getElementById('deck-list');
  const editorPlaceholder = document.getElementById('editor-placeholder');
  const editorForm        = document.getElementById('editor-form');
  const deckNameInput     = document.getElementById('deck-name');
  const deckFormatSel     = document.getElementById('deck-format');
  const deckNotes         = document.getElementById('deck-notes');
  const saveDeckBtn       = document.getElementById('save-deck-btn');
  const deleteDeckBtn     = document.getElementById('delete-deck-btn');
  const colorPills        = document.querySelectorAll('.color-pill');
  const cardSearchInput   = document.getElementById('card-search-input');
  const cardSearchClear   = document.getElementById('card-search-clear');
  const cardSearchBtn     = document.getElementById('card-search-btn');
  const cardSearchResults = document.getElementById('card-search-results');
  const cardListEl        = document.getElementById('card-list');
  const cardCountBadge    = document.getElementById('card-count');
  const previewBackdrop   = document.getElementById('preview-backdrop');
  const previewModal      = document.getElementById('preview-modal');
  const previewClose      = document.getElementById('preview-close');
  const previewImg        = document.getElementById('preview-img');
  const previewInfo       = document.getElementById('preview-info');
  const previewFooter     = document.getElementById('preview-footer');
  const previewAddBtn     = document.getElementById('preview-add-btn');
  const previewAddSbBtn   = document.getElementById('preview-add-sb-btn');
  const zoomOverlay       = document.getElementById('zoom-overlay');
  const zoomImg           = document.getElementById('zoom-img');

  // ── State ──────────────────────────────────────────────────
  let decks       = [];
  let currentDeck = null;

  usernameEl.textContent = localStorage.getItem('mtg_username') || '';

  // ── Card categories (Moxfield-style order) ─────────────────
  const CATEGORIES = [
    'Commander',
    'Creatures',
    'Instants',
    'Sorceries',
    'Artifacts',
    'Enchantments',
    'Planeswalkers',
    'Battles',
    'Lands',
    'Other',
    'Sideboard'
  ];
  const SIDEBOARD_MAX = 15;

  function getCategory(card) {
    if (card.isCommander)  return 'Commander';
    if (card.isSideboard)  return 'Sideboard';
    const t = (card.type || '').toLowerCase();
    if (t.includes('land'))         return 'Lands';
    if (t.includes('creature'))     return 'Creatures';
    if (t.includes('planeswalker')) return 'Planeswalkers';
    if (t.includes('battle'))       return 'Battles';
    if (t.includes('instant'))      return 'Instants';
    if (t.includes('sorcery'))      return 'Sorceries';
    if (t.includes('artifact'))     return 'Artifacts';
    if (t.includes('enchantment'))  return 'Enchantments';
    return 'Other';
  }

  // ── Auth helpers ───────────────────────────────────────────
  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  // ── Logout ─────────────────────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mtg_token');
    localStorage.removeItem('mtg_username');
    window.location.href = 'index.html';
  });

  // ── Load decks ─────────────────────────────────────────────
  async function loadDecks() {
    try {
      const res = await fetch('/api/decks', { headers: authHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('mtg_token');
        localStorage.removeItem('mtg_username');
        window.location.href = 'index.html';
        return;
      }
      const data = await res.json();
      decks = Array.isArray(data) ? data : [];
      renderDeckList();
    } catch {
      console.error('Failed to load decks');
      decks = [];
    }
  }

  function renderDeckList() {
    deckListEl.innerHTML = '';
    if (!decks.length) {
      deckListEl.innerHTML = '<li class="deck-list-empty">No decks yet. Create your first one!</li>';
      return;
    }
    decks.forEach(deck => {
      const li = document.createElement('li');
      li.className = 'deck-list-item' + (currentDeck?.id === deck.id ? ' active' : '');
      li.dataset.id = deck.id;
      const total = (deck.cards || []).reduce((s, c) => s + (c.qty || 1), 0);
      li.innerHTML = `
        <span class="deck-item-colors">${colorImgs(deck.colors || [])}</span>
        <span class="deck-item-name">${esc(deck.name)}</span>
        <span class="deck-item-format">${esc(deck.format)}</span>
        <span class="deck-item-count">${total}</span>
      `;
      li.addEventListener('click', () => openDeck(deck));
      deckListEl.appendChild(li);
    });
  }

  const COLOR_IMG = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };

  function colorImgs(colors) {
    return (colors || []).map(c =>
      `<img src="img/${COLOR_IMG[c] || c}.png" alt="${c}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;">`
    ).join('');
  }

  // ── Open deck ──────────────────────────────────────────────
  function openDeck(deck) {
    currentDeck = deck;
    showEditor();
    deckNameInput.value = deck.name;
    deckFormatSel.value = deck.format || 'Standard';
    deckNotes.value     = deck.notes || '';
    colorPills.forEach(p => p.classList.toggle('selected', (deck.colors || []).includes(p.dataset.color)));
    renderCardList(deck.cards || []);
    highlightActiveItem();
  }

  function highlightActiveItem() {
    document.querySelectorAll('.deck-list-item').forEach(li =>
      li.classList.toggle('active', li.dataset.id === currentDeck?.id)
    );
  }

  function showEditor() {
    editorPlaceholder.hidden = true;
    editorForm.hidden        = false;
  }

  function hideEditor() {
    editorPlaceholder.hidden = false;
    editorForm.hidden        = true;
    currentDeck = null;
    highlightActiveItem();
  }

  // ── New deck ───────────────────────────────────────────────
  newDeckBtn.addEventListener('click', () => {
    currentDeck = null;
    showEditor();
    deckNameInput.value = '';
    deckFormatSel.value = 'Standard';
    deckNotes.value     = '';
    colorPills.forEach(p => p.classList.remove('selected'));
    renderCardList([]);
    deckNameInput.focus();
    highlightActiveItem();
  });

  // ── Save deck ──────────────────────────────────────────────
  saveDeckBtn.addEventListener('click', async () => {
    const name = deckNameInput.value.trim();
    if (!name) { deckNameInput.focus(); return; }

    const payload = {
      name,
      format: deckFormatSel.value,
      colors: [...document.querySelectorAll('.color-pill.selected')].map(p => p.dataset.color),
      notes:  deckNotes.value.trim(),
      cards:  getCurrentCards()
    };

    saveDeckBtn.disabled = true;
    saveDeckBtn.innerHTML = '<span class="spinner"></span>';

    try {
      let res, saved;
      if (currentDeck?.id) {
        res   = await fetch(`/api/decks/${currentDeck.id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(payload) });
        saved = await res.json();
        if (!res.ok) throw new Error(saved.message || 'Save failed');
        const idx = decks.findIndex(d => d.id === saved.id);
        if (idx >= 0) decks[idx] = saved; else decks.unshift(saved);
      } else {
        res   = await fetch('/api/decks', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
        saved = await res.json();
        if (!res.ok) throw new Error(saved.message || 'Save failed');
        decks.unshift(saved);
      }
      currentDeck = saved;
      renderDeckList();
      highlightActiveItem();
    } catch {
      alert('Failed to save deck. Please try again.');
    } finally {
      saveDeckBtn.disabled = false;
      saveDeckBtn.textContent = 'Save';
    }
  });

  // ── Delete deck ────────────────────────────────────────────
  deleteDeckBtn.addEventListener('click', async () => {
    if (!currentDeck?.id) { hideEditor(); return; }
    if (!confirm(`Delete "${currentDeck.name}"?`)) return;

    try {
      await fetch(`/api/decks/${currentDeck.id}`, { method: 'DELETE', headers: authHeaders() });
      decks = decks.filter(d => d.id !== currentDeck.id);
      hideEditor();
      renderDeckList();
    } catch {
      alert('Failed to delete deck.');
    }
  });

  // ── Color pills ────────────────────────────────────────────
  colorPills.forEach(p => p.addEventListener('click', () => p.classList.toggle('selected')));

  // ── Card data: stored as { name, qty, type, cmc } ──────────
  // We keep an in-memory array that mirrors the DOM
  let deckCards = [];   // [{ name, qty, type, cmc, isCommander }]
  let sortBy    = 'none';   // 'none' | 'name' | 'cmc'

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b === btn));
      rebuildCardDOM();
    });
  });

  function getCurrentCards() {
    return deckCards.map(c => ({ name: c.name, qty: c.qty, type: c.type || '', cmc: c.cmc ?? null, isCommander: c.isCommander || false, isSideboard: c.isSideboard || false }));
  }

  // ── Render card list grouped by category ──────────────────
  function renderCardList(cards) {
    deckCards = cards.map(c => ({ name: c.name, qty: c.qty || 1, type: c.type || '', cmc: c.cmc ?? null, isCommander: c.isCommander || false, isSideboard: c.isSideboard || false }));
    rebuildCardDOM();
  }

  function rebuildCardDOM() {
    cardListEl.innerHTML = '';

    // Group by category
    const groups = {};
    CATEGORIES.forEach(cat => groups[cat] = []);

    deckCards.forEach((card, idx) => {
      const cat = getCategory(card);
      groups[cat].push({ ...card, _idx: idx });
    });

    CATEGORIES.forEach(cat => {
      let cards = groups[cat];
      if (!cards.length) return;

      // Sort within category
      if (sortBy === 'name') {
        cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'cmc') {
        cards = [...cards].sort((a, b) => (a.cmc ?? 999) - (b.cmc ?? 999));
      }

      const catTotal = cards.reduce((s, c) => s + c.qty, 0);

      // Section header
      const header = document.createElement('li');
      header.className = 'card-category-header';
      const countLabel = cat === 'Sideboard'
        ? `<span class="cat-count${catTotal >= SIDEBOARD_MAX ? ' cat-count-full' : ''}">${catTotal} / ${SIDEBOARD_MAX}</span>`
        : `<span class="cat-count">${catTotal}</span>`;
      header.innerHTML = `
        <span class="cat-toggle">▾</span>
        <span class="cat-name">${esc(cat)}</span>
        ${countLabel}
      `;
      header.addEventListener('click', () => {
        const group = header.nextElementSibling;
        const collapsed = group?.classList.toggle('collapsed');
        header.querySelector('.cat-toggle').textContent = collapsed ? '▸' : '▾';
      });
      cardListEl.appendChild(header);

      // Card rows wrapper
      const group = document.createElement('ul');
      group.className = 'card-category-group';
      cards.forEach(card => group.appendChild(makeCardRow(card._idx)));
      cardListEl.appendChild(group);
    });

    updateCardCount();
  }

  function makeCardRow(idx) {
    const card = deckCards[idx];
    const li = document.createElement('li');
    li.className = 'card-list-item';
    li.dataset.idx = idx;
    const t = (card.type || '').toLowerCase();
    const canBeCommander = t.includes('legendary') && t.includes('creature');
    const isLegacy       = !['Commander', 'Draft'].includes(deckFormatSel.value);
    const sbTotal        = deckCards.filter(c => c.isSideboard).reduce((s, c) => s + c.qty, 0);
    const sbFull         = sbTotal >= SIDEBOARD_MAX && !card.isSideboard;
    li.innerHTML = `
      <button class="card-qty-btn" data-action="minus">−</button>
      <span class="card-qty">${card.qty}</span>
      <button class="card-qty-btn" data-action="plus">+</button>
      <span class="card-list-item-name">${esc(card.name)}</span>
      ${canBeCommander && !card.isSideboard ? `<button class="card-commander-btn${card.isCommander ? ' active' : ''}" title="${card.isCommander ? 'Unmark commander' : 'Mark as commander'}">♛</button>` : ''}
      ${isLegacy && !card.isCommander ? `<button class="card-sb-btn${card.isSideboard ? ' active' : ''}${sbFull ? ' disabled' : ''}" title="${card.isSideboard ? 'Move to main deck' : sbFull ? 'Sideboard full (15)' : 'Move to sideboard'}">SB</button>` : ''}
      <button class="card-remove-btn" title="Remove">✕</button>
    `;

    li.querySelector('[data-action="minus"]').addEventListener('click', () => {
      if (deckCards[idx].qty > 1) {
        deckCards[idx].qty--;
        rebuildCardDOM();
      } else {
        deckCards.splice(idx, 1);
        rebuildCardDOM();
      }
    });
    li.querySelector('[data-action="plus"]').addEventListener('click', () => {
      deckCards[idx].qty++;
      rebuildCardDOM();
    });
    li.querySelector('.card-list-item-name').addEventListener('click', () => openPreview(card.name));
    li.querySelector('.card-sb-btn:not(.disabled)')?.addEventListener('click', () => {
      deckCards[idx].isSideboard  = !deckCards[idx].isSideboard;
      if (deckCards[idx].isSideboard) deckCards[idx].isCommander = false;
      rebuildCardDOM();
    });

    li.querySelector('.card-commander-btn')?.addEventListener('click', () => {
      const becoming = !deckCards[idx].isCommander;
      // Unmark any existing commander first
      if (becoming) deckCards.forEach(c => { c.isCommander = false; });
      deckCards[idx].isCommander = becoming;
      rebuildCardDOM();
    });
    li.querySelector('.card-remove-btn').addEventListener('click', () => {
      deckCards.splice(idx, 1);
      rebuildCardDOM();
    });

    return li;
  }

  function addCard(name, type, cmc, isSideboard = false) {
    const existing = deckCards.find(c => c.name === name && c.isSideboard === isSideboard);
    if (existing) {
      existing.qty++;
    } else {
      deckCards.push({ name, qty: 1, type: type || '', cmc: cmc ?? null, isCommander: false, isSideboard: !!isSideboard });
    }
    rebuildCardDOM();
  }

  function updateCardCount() {
    const total = deckCards.filter(c => !c.isSideboard).reduce((s, c) => s + c.qty, 0);
    cardCountBadge.textContent = total;

    // Update category counts in DOM
    document.querySelectorAll('.card-category-header').forEach(header => {
      const group = header.nextElementSibling;
      if (!group) return;
      const groupTotal = [...group.querySelectorAll('.card-qty')]
        .reduce((s, el) => s + parseInt(el.textContent, 10), 0);
      header.querySelector('.cat-count').textContent = groupTotal;
    });
  }

  // ── Scryfall card search ───────────────────────────────────
  cardSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  cardSearchInput.addEventListener('input', () => {
    cardSearchClear.hidden = !cardSearchInput.value;
  });
  cardSearchClear.addEventListener('click', () => {
    cardSearchInput.value = '';
    cardSearchClear.hidden = true;
    cardSearchResults.hidden = true;
    cardSearchResults.innerHTML = '';
    cardSearchInput.focus();
  });
  cardSearchBtn.addEventListener('click', doSearch);

  async function doSearch() {
    const q = cardSearchInput.value.trim();
    if (!q) return;

    cardSearchBtn.disabled = true;
    cardSearchBtn.innerHTML = '<span class="spinner"></span>';
    cardSearchResults.hidden = true;
    cardSearchResults.innerHTML = '';

    try {
      const res  = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`);
      const data = await res.json();

      if (!data.data?.length) {
        cardSearchResults.innerHTML = '<p style="color:#7888b0;padding:0.5rem;font-size:0.85rem">No cards found.</p>';
        cardSearchResults.hidden = false;
        return;
      }

      data.data.slice(0, 12).forEach(card => {
        const img = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small;
        const div = document.createElement('div');
        div.className = 'search-result-card';
        div.innerHTML = img
          ? `<img src="${img}" alt="${esc(card.name)}" loading="lazy"><span class="search-result-name">${esc(card.name)}</span>`
          : `<span class="search-result-name">${esc(card.name)}</span>`;
        div.addEventListener('click', () => {
          openPreview(card.name, card, (c, toSideboard) => {
            addCard(c.name, c.type_line || '', c.cmc ?? null, toSideboard);
            saveCardToLibrary(c);
          });
        });
        cardSearchResults.appendChild(div);
      });

      cardSearchResults.hidden = false;
    } catch {
      cardSearchResults.innerHTML = '<p style="color:#e55;padding:0.5rem;font-size:0.85rem">Search failed — check connection.</p>';
      cardSearchResults.hidden = false;
    } finally {
      cardSearchBtn.disabled = false;
      cardSearchBtn.textContent = 'Search';
    }
  }

  // ── Save card to library (3rd Firestore collection) ────────
  async function saveCardToLibrary(card) {
    try {
      await fetch('/api/cards', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          scryfallId: card.id,
          name:       card.name,
          set:        card.set_name,
          type:       card.type_line,
          imageUrl:   card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '',
          priceUsd:   card.prices?.usd || null
        })
      });
    } catch { /* non-critical */ }
  }

  // ── Card preview modal ─────────────────────────────────────
  // onAdd: optional callback (card) => void — shows Add button if provided
  async function openPreview(name, prefetchedCard = null, onAdd = null) {
    previewImg.src = '';
    previewInfo.innerHTML = '<em style="color:#7888b0">Loading…</em>';
    previewFooter.hidden  = true;
    previewBackdrop.hidden = false;
    previewModal.hidden    = false;

    try {
      const card = prefetchedCard || await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
      ).then(r => r.json());

      const img      = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';
      const imgLarge = card.image_uris?.large  || card.card_faces?.[0]?.image_uris?.large  || img;

      previewImg.src = img;
      previewImg.style.cursor = 'zoom-in';
      previewImg.onclick = () => {
        zoomImg.src = imgLarge || img;
        zoomOverlay.hidden = false;
      };

      const price = card.prices?.usd
        ? `$${card.prices.usd}`
        : card.prices?.usd_foil ? `$${card.prices.usd_foil} (foil)` : '—';

      previewInfo.innerHTML = `
        <strong>${esc(card.name)}</strong><br>
        ${esc(card.type_line || '')}<br>
        <span style="color:#888;font-size:0.78rem">${esc(card.set_name || '')}</span><br><br>
        <strong>Price:</strong> ${price}<br>
        ${card.oracle_text ? `<br><span style="font-size:0.85rem;color:#aab;line-height:1.8;font-style:italic">${renderMana(card.oracle_text).replace(/\n/g, '<br><br>')}</span>` : ''}
      `;

      // Add buttons — only when coming from search
      if (onAdd) {
        previewFooter.hidden = false;
        previewAddBtn.onclick = () => { onAdd(card, false); closePreview(); };

        const isLegacy = !['Commander', 'Draft'].includes(deckFormatSel.value);
        previewAddSbBtn.hidden = !isLegacy;
        if (isLegacy) {
          previewAddSbBtn.onclick = () => { onAdd(card, true); closePreview(); };
        }
      }
    } catch {
      previewInfo.innerHTML = '<em style="color:#e55">Could not load card data.</em>';
    }
  }

  function closePreview() {
    previewBackdrop.hidden  = true;
    previewModal.hidden     = true;
    previewFooter.hidden    = true;
    previewAddSbBtn.hidden  = true;
  }

  previewClose.addEventListener('click', closePreview);
  previewBackdrop.addEventListener('click', closePreview);

  // ── Zoom overlay ───────────────────────────────────────────
  zoomOverlay.addEventListener('click', () => { zoomOverlay.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zoomOverlay.hidden = true; });

  // ── Mana symbol replacement ────────────────────────────────
  function renderMana(text) {
    if (!text) return '';
    return esc(text).replace(/\{([^}]+)\}/g, (match, symbol) => {
      const code = symbol.replace('/', '').toUpperCase();
      return `<img src="https://svgs.scryfall.io/card-symbols/${code}.svg" alt="{${symbol}}" style="width:14px;height:14px;vertical-align:middle;display:inline-block;margin:0 1px;">`;
    });
  }

  // ── Utility ────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Boot ───────────────────────────────────────────────────
  loadDecks();
})();
