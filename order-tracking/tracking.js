(() => {
  const els = {
    orderInput: document.getElementById('order-number-input'),
    trackingInput: document.getElementById('tracking-number-input'),
    searchButton: document.getElementById('search-button'),
    feedback: document.getElementById('feedback'),
    loader: document.getElementById('loader'),
    resultSection: document.getElementById('result-section'),
    contactSection: document.getElementById('contact-section'),
    lastUpdate: document.getElementById('result-last-update'),
    summary: {
      orderNumber: document.getElementById('summary-order-number'),
      status: document.getElementById('summary-status'),
      created: document.getElementById('summary-created'),
      provider: document.getElementById('summary-provider'),
      customerName: document.getElementById('summary-customer-name'),
      customerEmail: document.getElementById('summary-customer-email'),
      customerPhone: document.getElementById('summary-customer-phone'),
      carrier: document.getElementById('summary-carrier'),
      tracking: document.getElementById('summary-tracking'),
      shipped: document.getElementById('summary-shipped'),
      estimated: document.getElementById('summary-estimated')
    },
    itemsBlock: document.getElementById('items-block'),
    itemsList: document.getElementById('items-list'),
    timeline: document.getElementById('timeline'),
    contactForm: document.getElementById('contact-form'),
    contactEmail: document.getElementById('contact-email'),
    contactMessage: document.getElementById('contact-message'),
    contactSubmit: document.getElementById('contact-submit'),
    messageCounter: document.getElementById('message-counter'),
    contactNote: document.getElementById('contact-note')
  };

  // Evénements de suivi pertinents (expédition / livraison)
  const ALLOWED_EVENT_TYPES = new Set(['order_shipped', 'estimated_delivery_set']);
  const EVENT_TITLES = {
    order_shipped: 'Commande expédiée',
    estimated_delivery_set: 'Livraison estimée'
  };
  function formatEventLabel(type) {
    const t = String(type || '').toLowerCase();
    return EVENT_TITLES[t] || 'Mise à jour';
  }

  const state = {
    order: null,
    lastQuery: {
      orderNumber: '',
      trackingNumber: ''
    }
  };

  const STATUS_LABELS = {
    pending_payment: 'En attente de paiement',
    awaiting_transfer: 'En attente de virement',
    paid: 'Payée',
    processing: 'En préparation',
    fulfilled: 'Expédiée',
    partially_fulfilled: 'Partiellement expédiée',
    cancelled: 'Annulée',
    failed: 'Échec de paiement',
    refunded: 'Remboursée',
    disputed: 'Litige en cours'
  };

  function formatDate(value, withTime = true) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      const options = withTime
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleString('fr-FR', options);
    } catch (_) {
      return '—';
    }
  }

  function formatStatus(status) {
    if (!status) return '—';
    return STATUS_LABELS[status] || status;
  }

  function clearFeedback() {
    els.feedback.className = 'feedback';
    els.feedback.textContent = '';
    els.feedback.style.display = 'none';
  }

  function showFeedback(type, message) {
    els.feedback.className = `feedback feedback--${type} visible`;
    els.feedback.innerHTML = `<i class="fas ${type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${message}</span>`;
    els.feedback.style.display = 'flex';
  }

  function setLoading(isLoading) {
    if (isLoading) {
      els.loader.classList.add('visible');
      els.searchButton.disabled = true;
    } else {
      els.loader.classList.remove('visible');
      els.searchButton.disabled = false;
    }
  }

  function sanitize(str) {
    return (str || '').toString().trim();
  }

  function buildItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      els.itemsBlock.classList.add('hidden');
      els.itemsList.innerHTML = '';
      return;
    }

    els.itemsBlock.classList.remove('hidden');
    els.itemsList.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      const name = sanitize(item.name) || 'Référence';
      const sku = sanitize(item.sku);
      const qty = Number.isFinite(item.qty) ? item.qty : 1;
      const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : null;

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.gap = '4px';
      left.innerHTML = `<strong>${name}</strong>${sku ? `<span style="color:var(--text-muted);font-size:0.85rem;">Réf. ${sku}</span>` : ''}`;

      const right = document.createElement('div');
      right.style.textAlign = 'right';
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.gap = '4px';
      right.innerHTML = `<span style="font-weight:600;">${qty} ×</span>${unitPrice !== null ? `<span style="color:var(--text-muted);font-size:0.9rem;">${unitPrice.toFixed(2)} €</span>` : ''}`;

      li.append(left, right);
      els.itemsList.appendChild(li);
    });
  }

  function buildTimeline(events) {
    els.timeline.innerHTML = '';
    // Ne garder que les événements pertinents pour l'utilisateur final
    const filtered = Array.isArray(events)
      ? events.filter(ev => ALLOWED_EVENT_TYPES.has(String(ev.type || '').toLowerCase()))
      : [];
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-entry';
      empty.innerHTML = '<p style="margin:0;color:var(--text-muted);">Aucune étape enregistrée pour le moment. Votre commande est en cours de traitement.</p>';
      els.timeline.appendChild(empty);
      return;
    }

    filtered.forEach(ev => {
      const entry = document.createElement('article');
      entry.className = 'timeline-entry';

      const header = document.createElement('header');
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `<i class="fas fa-flag"></i> ${formatEventLabel(ev.type)}`;

      const date = document.createElement('span');
      date.className = 'date';
      date.innerHTML = `<i class="fas fa-clock"></i> ${formatDate(ev.at)}`;

      header.append(tag, date);
      entry.appendChild(header);

      const message = document.createElement('p');
      message.style.margin = '12px 0 0';
      message.style.lineHeight = '1.55';
      message.textContent = sanitize(ev.message) || formatEventLabel(ev.type);
      entry.appendChild(message);

      if (ev.payload && typeof ev.payload === 'object') {
        // Ne montrer que des données utiles (transporteur, tracking, ETA)
        const ALLOWED_KEYS = new Set(['carrier', 'trackingNumber', 'eta', 'estimatedDeliveryAt']);
        const payloadEntries = Object.entries(ev.payload)
          .filter(([key, value]) => ALLOWED_KEYS.has(String(key)) && value !== undefined && value !== null && value !== '');
        if (payloadEntries.length > 0) {
          const metaList = document.createElement('dl');
          metaList.style.margin = '12px 0 0';
          metaList.style.display = 'grid';
          metaList.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
          metaList.style.gap = '4px 12px';

          payloadEntries.forEach(([key, value]) => {
            const dt = document.createElement('dt');
            dt.style.fontWeight = '600';
            dt.style.color = 'var(--secondary)';
            dt.textContent = key;
            const dd = document.createElement('dd');
            dd.style.margin = '0';
            dd.style.color = 'var(--text-muted)';
            dd.textContent = typeof value === 'string' ? value : JSON.stringify(value);
            metaList.append(dt, dd);
          });

          entry.appendChild(metaList);
        }
      }

      els.timeline.appendChild(entry);
    });
  }

  function renderOrder(order, events) {
    els.resultSection.classList.remove('hidden');
    els.contactSection.classList.remove('hidden');

    state.order = order;

    els.lastUpdate.textContent = order.updatedAt ? `Dernière mise à jour : ${formatDate(order.updatedAt)}` : '';
    els.summary.orderNumber.textContent = sanitize(order.number) || `Commande ${String(order._id).slice(-6)}`;
    els.summary.status.textContent = formatStatus(order.status);
    els.summary.created.textContent = formatDate(order.createdAt);
    els.summary.provider.textContent = sanitize(order.provider) || 'Interne';

    const customerName = sanitize(order?.customer?.name);
    els.summary.customerName.textContent = customerName || '—';
    els.summary.customerEmail.textContent = sanitize(order?.customer?.email) || '—';
    els.summary.customerPhone.textContent = sanitize(order?.customer?.phone) || '—';

    els.summary.carrier.textContent = sanitize(order?.shipping?.carrier) || '—';
    const trackingNumber = sanitize(order?.shipping?.trackingNumber);
    if (trackingNumber) {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = trackingNumber;
      link.style.color = 'var(--primary)';
      link.style.textDecoration = 'underline';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard?.writeText(trackingNumber).then(() => {
          showFeedback('success', 'Numéro de suivi copié dans votre presse-papiers.');
          setTimeout(clearFeedback, 3000);
        }).catch(() => {
          showFeedback('info', `Numéro de suivi : ${trackingNumber}`);
        });
      });
      els.summary.tracking.innerHTML = '';
      els.summary.tracking.appendChild(link);
    } else {
      els.summary.tracking.textContent = '—';
    }

    els.summary.shipped.textContent = formatDate(order?.shipping?.shippedAt);
    els.summary.estimated.textContent = formatDate(order?.shipping?.estimatedDeliveryAt, false);

    buildItems(order.items);
    buildTimeline(events);
  }

  async function fetchOrder(orderNumber, trackingNumber) {
    const params = new URLSearchParams();
    if (orderNumber) params.set('orderNumber', orderNumber);
    if (trackingNumber) params.set('trackingNumber', trackingNumber);

    const response = await fetch(`/api/track/order?${params.toString()}`);
    const data = await response.json().catch(() => ({ success: false, message: 'Réponse invalide.' }));
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Commande introuvable.');
    }
    return data;
  }

  function resetResults() {
    state.order = null;
    els.resultSection.classList.add('hidden');
    els.contactSection.classList.add('hidden');
    els.lastUpdate.textContent = '';
    els.itemsList.innerHTML = '';
    els.timeline.innerHTML = '';
  }

  async function handleSearch() {
    clearFeedback();
    const orderNumber = sanitize(els.orderInput.value);
    const trackingNumber = sanitize(els.trackingInput.value);

    if (!orderNumber && !trackingNumber) {
      showFeedback('error', 'Merci de saisir au moins un numéro de commande ou un numéro de suivi.');
      return;
    }

    setLoading(true);
    resetResults();
    state.lastQuery = { orderNumber, trackingNumber };

    try {
      // Mettre à jour l'URL pour permettre le partage du lien
      const paramsNew = new URLSearchParams();
      if (orderNumber) paramsNew.set('order', orderNumber);
      if (trackingNumber) paramsNew.set('tracking', trackingNumber);
      const newUrl = `${window.location.pathname}${paramsNew.toString() ? '?' + paramsNew.toString() : ''}`;
      try { window.history.replaceState(null, '', newUrl); } catch(_) {}

      const data = await fetchOrder(orderNumber, trackingNumber);
      renderOrder(data.order, data.events || []);
      showFeedback('success', 'Commande trouvée. Informations mises à jour.');
      setTimeout(clearFeedback, 4000);
    } catch (err) {
      showFeedback('error', err.message || 'Commande introuvable. Vérifiez les informations saisies.');
    } finally {
      setLoading(false);
    }
  }

  async function handleContactSubmit(event) {
    event.preventDefault();
    clearFeedback();

    if (!state.order) {
      showFeedback('error', "Veuillez d'abord rechercher votre commande.");
      return;
    }

    const message = sanitize(els.contactMessage.value);
    const email = sanitize(els.contactEmail.value);

    if (!message) {
      showFeedback('error', 'Merci de détailler votre message avant de l’envoyer.');
      return;
    }

    els.contactSubmit.disabled = true;
    els.contactSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi…';

    try {
      const body = {
        orderNumber: state.order.number || state.lastQuery.orderNumber || '',
        trackingNumber: state.order?.shipping?.trackingNumber || state.lastQuery.trackingNumber || '',
        message,
        email
      };

      const resp = await fetch('/api/track/order/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await resp.json().catch(() => ({ success: false, message: 'Réponse invalide du serveur.' }));

      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Impossible d’envoyer votre message pour le moment.');
      }

      els.contactMessage.value = '';
      els.messageCounter.textContent = '0 / 1000 caractères';
      showFeedback('success', data.message || 'Votre message a bien été transmis. Merci !');
      setTimeout(clearFeedback, 4000);
    } catch (err) {
      showFeedback('error', err.message || 'Une erreur est survenue lors de l’envoi.');
    } finally {
      els.contactSubmit.disabled = false;
      els.contactSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer mon message';
    }
  }

  function updateCounter() {
    const value = els.contactMessage.value || '';
    els.messageCounter.textContent = `${value.length} / 1000 caractères`;
  }

  // Event listeners
  els.searchButton.addEventListener('click', handleSearch);
  els.orderInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  });
  els.trackingInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  });

  els.contactForm.addEventListener('submit', handleContactSubmit);
  els.contactMessage.addEventListener('input', updateCounter);
  updateCounter();

  // Pré-remplissage via paramètres d'URL et auto-recherche
  (function initFromQuery() {
    try {
      const sp = new URLSearchParams(window.location.search);
      const orderQ = sanitize(sp.get('order') || sp.get('orderNumber'));
      const trackingQ = sanitize(sp.get('tracking') || sp.get('trackingNumber'));
      if (orderQ) els.orderInput.value = orderQ;
      if (trackingQ) els.trackingInput.value = trackingQ;
      if (orderQ || trackingQ) {
        // Déclencher une recherche automatique si au moins un paramètre est présent
        handleSearch();
      }
    } catch(_) {}
  })();
})();
