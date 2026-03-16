(function() {
    function createTicketDetailsController(dependencies) {
        const deps = dependencies || {};
        const formatDate = deps.formatDate || window.formatDate || function(dateString) { return String(dateString || ''); };
        const partTypeTranslations = deps.partTypeTranslations || window.partTypeTranslations || {};
        const statusTranslations = deps.statusTranslations || window.statusTranslations || {};
        const applyRoleBasedUIForTicket = deps.applyRoleBasedUIForTicket || function() {};
        const updateCurrentStatusIndicator = deps.updateCurrentStatusIndicator || function() {};
        const refreshActiveTemplatesCache = deps.refreshActiveTemplatesCache || function() { return Promise.resolve(); };
        const populateResponseTemplateSelect = deps.populateResponseTemplateSelect || function() {};
        const documentTypeIcons = deps.documentTypeIcons || {};
        const documentTypeTranslations = deps.documentTypeTranslations || {};
        const documentTypeOrder = deps.documentTypeOrder || [];
        const statusIcons = deps.statusIcons || {};

        function renderTicketIdentity(ticket) {
            console.log('Mise à jour du fil d\'Ariane avec le numéro de ticket:', ticket.ticketNumber);
            const breadcrumbElement = document.getElementById('breadcrumb-ticket-number');
            if (!breadcrumbElement) {
                console.error('Element breadcrumb-ticket-number introuvable');
            } else {
                breadcrumbElement.textContent = ticket.ticketNumber;
            }

            console.log('Mise à jour des informations générales');
            const detailTicketNumberElement = document.getElementById('detail-ticket-number');
            if (!detailTicketNumberElement) {
                console.error('Element detail-ticket-number introuvable');
            } else {
                detailTicketNumberElement.textContent = ticket.ticketNumber;
            }
        }

        function renderTicketPriority(ticket) {
            console.log('Mise à jour de la priorité');
            const priorityElement = document.getElementById('detail-ticket-priority');
            const priorityLabelMap = {
                'eleve': 'Élevée',
                'moyen': 'Moyenne',
                'faible': 'Faible',
                'élevé': 'Élevée',
                'urgent': 'Urgente'
            };
            const ticketPriority = ticket.priority || 'moyen';
            console.log('Priorité du ticket:', ticketPriority);

            const visiblePriorityElement = document.getElementById('visible-current-priority');
            if (visiblePriorityElement) {
                const priorityText = priorityLabelMap[ticketPriority] || ticketPriority;
                visiblePriorityElement.textContent = priorityText;
                visiblePriorityElement.className = `priority-badge priority-${ticketPriority}`;
                console.log('Indicateur de priorité mis à jour avec:', priorityText);
            } else {
                console.error('Element visible-current-priority introuvable');
            }

            if (!priorityElement) {
                console.error('Element detail-ticket-priority introuvable');
            } else if (ticket.priority) {
                const priorityText = priorityLabelMap[ticket.priority] || ticket.priority;
                priorityElement.textContent = `Priorité: ${priorityText}`;
                priorityElement.className = `priority-badge priority-${ticket.priority}`;
                priorityElement.style.display = 'inline-block';
            } else {
                priorityElement.textContent = 'Priorité: Moyenne';
                priorityElement.className = 'priority-badge priority-moyen';
                priorityElement.style.display = 'inline-block';
            }

            try {
                const currentPriorityElement = document.getElementById('detail-ticket-current-priority');
                if (currentPriorityElement) {
                    currentPriorityElement.textContent = ticketPriority;
                    currentPriorityElement.setAttribute('data-priority', ticketPriority);
                }
            } catch(_) {}
        }

        function renderTicketAssignment(ticket) {
            try {
                const assignedEl = document.getElementById('detail-assigned-to');
                if (assignedEl) {
                    const user = ticket.assignedTo;
                    if (user && (user.firstName || user.lastName || user.email)) {
                        const name = `${(user.firstName || '').trim()} ${(user.lastName || '').trim()}`.trim();
                        assignedEl.textContent = name || user.email || 'Non assigné';
                    } else {
                        assignedEl.textContent = 'Non assigné';
                    }
                }
                const escBadge = document.getElementById('detail-escalation-badge');
                if (escBadge) escBadge.style.display = ticket.isEscalated ? 'inline-block' : 'none';
                applyRoleBasedUIForTicket(ticket);
            } catch(_) {}
        }

        function renderTicketClientInfo(ticket) {
            console.log('Mise à jour des informations client');
            try {
                const clientNameElement = document.getElementById('detail-client-name');
                if (!clientNameElement) {
                    console.error('Element detail-client-name introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.firstName && ticket.clientInfo.lastName) {
                    clientNameElement.textContent = `${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}`;
                }

                const clientEmailElement = document.getElementById('detail-client-email');
                if (!clientEmailElement) {
                    console.error('Element detail-client-email introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.email) {
                    clientEmailElement.textContent = ticket.clientInfo.email;
                }

                const clientPhoneElement = document.getElementById('detail-client-phone');
                if (!clientPhoneElement) {
                    console.error('Element detail-client-phone introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.phone) {
                    clientPhoneElement.textContent = ticket.clientInfo.phone;
                }

                const orderNumberElement = document.getElementById('detail-order-number');
                if (!orderNumberElement) {
                    console.error('Element detail-order-number introuvable');
                } else if (ticket.orderInfo && ticket.orderInfo.orderNumber) {
                    orderNumberElement.textContent = ticket.orderInfo.orderNumber;
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations client:', error);
            }
        }

        function renderTicketVehicleInfo(ticket) {
            console.log('Mise à jour des informations véhicule');
            try {
                const vehicleVinElement = document.getElementById('detail-vehicle-vin');
                if (!vehicleVinElement) {
                    console.error('Element detail-vehicle-vin introuvable');
                } else {
                    vehicleVinElement.textContent = (ticket.vehicleInfo && ticket.vehicleInfo.vin) ? ticket.vehicleInfo.vin : 'Non spécifié';
                }

                const installationDateElement = document.getElementById('detail-installation-date');
                if (!installationDateElement) {
                    console.error('Element detail-installation-date introuvable');
                } else {
                    installationDateElement.textContent = (ticket.vehicleInfo && ticket.vehicleInfo.installationDate) ? formatDate(ticket.vehicleInfo.installationDate) : 'Non spécifié';
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations véhicule:', error);
            }
        }

        function buildClaimSpecificDataHTML(ticket) {
            if (!ticket.claimTypeData || !ticket.claimType) return '';
            let specificDataHTML = '<div class="claim-specific-data"><h4>Détails spécifiques</h4><div class="info-grid">';
            switch(ticket.claimType) {
                case 'piece_defectueuse':
                    break;
                case 'probleme_livraison':
                    if (ticket.claimTypeData.deliveryDate) specificDataHTML += `<div class="info-item"><label>Date de livraison</label><p>${formatDate(ticket.claimTypeData.deliveryDate)}</p></div>`;
                    if (ticket.claimTypeData.deliveryProblemType) specificDataHTML += `<div class="info-item"><label>Type de problème</label><p>${ticket.claimTypeData.deliveryProblemType}</p></div>`;
                    if (ticket.claimTypeData.deliveryProblemDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.deliveryProblemDescription}</p></div>`;
                    if (ticket.claimTypeData.trackingNumber) specificDataHTML += `<div class="info-item"><label>N° de suivi (ancien)</label><p>${ticket.claimTypeData.trackingNumber}</p></div>`;
                    if (ticket.claimTypeData.carrier) specificDataHTML += `<div class="info-item"><label>Transporteur (ancien)</label><p>${ticket.claimTypeData.carrier}</p></div>`;
                    break;
                case 'erreur_reference':
                    if (ticket.claimTypeData.receivedReference) specificDataHTML += `<div class="info-item"><label>Référence reçue</label><p>${ticket.claimTypeData.receivedReference}</p></div>`;
                    if (ticket.claimTypeData.expectedReference) specificDataHTML += `<div class="info-item"><label>Référence attendue</label><p>${ticket.claimTypeData.expectedReference}</p></div>`;
                    if (ticket.claimTypeData.compatibilityIssue) specificDataHTML += `<div class="info-item"><label>Problème de compatibilité</label><p>${ticket.claimTypeData.compatibilityIssue}</p></div>`;
                    if (ticket.claimTypeData.referenceErrorDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.referenceErrorDescription}</p></div>`;
                    break;
                case 'autre':
                    if (ticket.claimTypeData.otherProblemType) specificDataHTML += `<div class="info-item"><label>Type de problème</label><p>${ticket.claimTypeData.otherProblemType}</p></div>`;
                    if (ticket.claimTypeData.otherProblemDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.otherProblemDescription}</p></div>`;
                    break;
            }
            specificDataHTML += '</div></div>';
            return specificDataHTML.includes('<div class="info-item">') ? specificDataHTML : '';
        }

        function renderTicketPartInfo(ticket) {
            console.log('Mise à jour des informations pièce et problème');
            try {
                const claimTypeElement = document.getElementById('detail-claim-type');
                if (!claimTypeElement) {
                    console.error('Element detail-claim-type introuvable');
                } else {
                    const claimTypeTranslations = {
                        'piece_defectueuse': 'Pièce défectueuse',
                        'probleme_livraison': 'Problème de livraison',
                        'erreur_reference': 'Erreur de référence',
                        'autre': 'Autre type de réclamation'
                    };
                    const claimType = ticket.claimType || 'Non spécifié';
                    claimTypeElement.textContent = claimTypeTranslations[claimType] || claimType;

                    const specificDataHTML = buildClaimSpecificDataHTML(ticket);
                    const partTabContent = document.getElementById('tab-part');
                    const existingSection = document.querySelector('.claim-specific-data');
                    if (existingSection) {
                        existingSection.outerHTML = specificDataHTML || '';
                    } else if (partTabContent && specificDataHTML) {
                        const ticketSection = partTabContent.querySelector('.ticket-section');
                        if (ticketSection) {
                            ticketSection.insertAdjacentHTML('beforeend', specificDataHTML);
                        }
                    }
                }

                const elementsToUpdate = [
                    { id: 'detail-part-type', value: () => (ticket.partInfo && ticket.partInfo.partType) ? (partTypeTranslations[ticket.partInfo.partType] || ticket.partInfo.partType) : 'Non spécifié' },
                    { id: 'detail-symptom', value: () => (ticket.partInfo && ticket.partInfo.symptom) ? ticket.partInfo.symptom : 'Non spécifié' },
                    { id: 'detail-failure-time', value: () => (ticket.partInfo && ticket.partInfo.failureTime) ? ticket.partInfo.failureTime : 'Non spécifié' },
                    { id: 'detail-error-codes', value: () => (ticket.partInfo && ticket.partInfo.errorCodes) ? ticket.partInfo.errorCodes : 'Non spécifié' },
                    { id: 'detail-pro-installation', value: () => (ticket.partInfo && ticket.partInfo.professionalInstallation !== undefined) ? (ticket.partInfo.professionalInstallation ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-oil-filled', value: () => (ticket.partInfo && ticket.partInfo.oilFilled !== undefined) ? (ticket.partInfo.oilFilled ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-oil-quantity', value: () => (ticket.partInfo && ticket.partInfo.oilQuantity) ? `${ticket.partInfo.oilQuantity} L` : 'Non spécifié' },
                    { id: 'detail-oil-reference', value: () => (ticket.partInfo && ticket.partInfo.oilReference) ? ticket.partInfo.oilReference : 'Non spécifié' },
                    { id: 'detail-new-parts', value: () => (ticket.partInfo && ticket.partInfo.newParts !== undefined) ? (ticket.partInfo.newParts ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-parts-details', value: () => (ticket.partInfo && ticket.partInfo.newPartsDetails) ? ticket.partInfo.newPartsDetails : 'Non spécifié' }
                ];

                elementsToUpdate.forEach(item => {
                    const element = document.getElementById(item.id);
                    if (!element) {
                        console.error(`Element ${item.id} introuvable`);
                    } else {
                        try {
                            element.textContent = item.value();
                        } catch (error) {
                            console.error(`Erreur lors de la mise à jour de ${item.id}:`, error);
                            element.textContent = 'Erreur';
                        }
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations pièce et problème:', error);
            }
        }

        function renderTicketInternalNotes(ticket) {
            console.log('Mise à jour des notes internes');
            try {
                const notesElement = document.getElementById('internal-notes');
                if (!notesElement) {
                    console.error('Element internal-notes introuvable');
                } else {
                    notesElement.value = ticket.internalNotes || '';
                }
                updateCurrentStatusIndicator(ticket.currentStatus);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des notes internes:', error);
            }
        }

        function normalizeTicketUploadsPath(pathValue) {
            if (!pathValue) return '';
            return pathValue.includes('uploads/') ? '/uploads/' + pathValue.split('uploads/')[1] : '/uploads/' + pathValue.split('/').pop();
        }

        function normalizeTicketMultilineText(value) {
            return String(value ?? '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/\r\n?/g, '\n');
        }

        function getTicketStatusRole(statusEntry) {
            if (statusEntry && statusEntry.updatedBy === 'client') return 'client';
            if (statusEntry && (statusEntry.updatedBy === 'admin' || statusEntry.updatedBy === 'agent')) return 'admin';
            return 'system';
        }

        function getTicketStatusBadgeClass(status) {
            switch (status) {
                case 'validé':
                case 'clôturé':
                    return 'badge--success';
                case 'refusé':
                    return 'badge--danger';
                case 'info_complementaire':
                    return 'badge--warning';
                case 'expédié':
                case 'en_cours_traitement':
                    return 'badge--primary';
                case 'en_analyse':
                case 'nouveau':
                default:
                    return 'badge--secondary';
            }
        }

        function createTicketAttachmentPreview(item) {
            const fileName = item && item.fileName ? item.fileName : 'Fichier';
            const filePath = item && item.filePath ? item.filePath : '';
            const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
            const isPDF = ext === 'pdf';
            const preview = filePath ? document.createElement('a') : document.createElement('div');
            if (filePath) {
                preview.href = filePath;
                preview.target = '_blank';
                preview.rel = 'noopener';
            }
            preview.className = 'attachment-preview';
            if (filePath && isImage) {
                const image = document.createElement('img');
                image.src = filePath;
                image.alt = fileName;
                image.className = 'document-thumbnail';
                preview.appendChild(image);
            } else if (filePath && isPDF) {
                const pdfPreview = document.createElement('div');
                pdfPreview.className = 'pdf-preview';
                const pdfIcon = document.createElement('i');
                pdfIcon.className = 'fas fa-file-pdf';
                const pdfLabel = document.createElement('span');
                pdfLabel.textContent = 'PDF';
                pdfPreview.appendChild(pdfIcon);
                pdfPreview.appendChild(pdfLabel);
                preview.appendChild(pdfPreview);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-file attachment-icon';
                preview.appendChild(icon);
            }
            return preview;
        }

        function createTicketAttachmentList(items, listClass, itemClass) {
            const list = document.createElement('div');
            list.className = listClass;
            items.forEach(item => {
                const attachmentItem = document.createElement('div');
                attachmentItem.className = itemClass;
                attachmentItem.appendChild(createTicketAttachmentPreview(item));
                list.appendChild(attachmentItem);
            });
            return list;
        }

        function buildTicketStatusDocumentsContext(documents, statuses) {
            const normalizedDocs = (Array.isArray(documents) ? documents : [])
                .map(doc => ({
                    ...doc,
                    __normPath: doc.filePath ? normalizeTicketUploadsPath(doc.filePath) : (doc.fileId ? `/uploads/${doc.fileId}` : ''),
                    __uploadAt: doc.uploadDate ? new Date(doc.uploadDate) : null
                }))
                .filter(doc => doc.__normPath);
            const statusesAsc = Array.isArray(statuses) ? [...statuses].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)) : [];
            const statusMeta = statusesAsc.map(statusEntry => {
                const author = getTicketStatusRole(statusEntry) === 'client' ? 'client' : 'cpf';
                const timeMs = statusEntry && statusEntry.updatedAt ? new Date(statusEntry.updatedAt).getTime() : 0;
                const comment = normalizeTicketMultilineText(statusEntry && typeof statusEntry.comment === 'string' ? statusEntry.comment : '');
                const isClientMessage = author === 'client' && (
                    (typeof statusEntry.clientResponse === 'boolean' && statusEntry.clientResponse === true) ||
                    /informations?\s+compl[ée]mentaires?\s+re[cç]ues?\s+du\s+client/i.test(comment)
                );
                return { id: String(statusEntry && statusEntry._id ? statusEntry._id : ''), timeMs, author, isClientMessage };
            });
            const docsByStatusId = new Map();
            normalizedDocs.forEach(doc => {
                const docTimeMs = doc.__uploadAt ? doc.__uploadAt.getTime() : null;
                const uploader = ['admin', 'agent'].includes(String(doc.uploadedBy || '').toLowerCase()) ? 'cpf' : 'client';
                const clientMessageStats = uploader === 'client' ? statusMeta.filter(meta => meta.isClientMessage) : [];
                const sameAuthorStats = statusMeta.filter(meta => meta.author === uploader);
                const tiers = [clientMessageStats, sameAuthorStats, statusMeta];
                let best = null;
                for (const tier of tiers) {
                    if (!tier || tier.length === 0) continue;
                    if (typeof docTimeMs === 'number') {
                        let localBest = null;
                        let localDelta = Infinity;
                        tier.forEach(meta => {
                            const delta = meta.timeMs - docTimeMs;
                            if (delta >= 0 && delta < localDelta) {
                                localDelta = delta;
                                localBest = meta;
                            }
                        });
                        if (!localBest) {
                            tier.forEach(meta => {
                                const delta = docTimeMs - meta.timeMs;
                                if (delta >= 0 && delta < localDelta) {
                                    localDelta = delta;
                                    localBest = meta;
                                }
                            });
                        }
                        if (localBest) {
                            best = localBest;
                            break;
                        }
                    } else if (tier.length > 0) {
                        best = tier[tier.length - 1];
                        break;
                    }
                }
                if (best && best.id) {
                    const existing = docsByStatusId.get(best.id) || [];
                    existing.push(doc);
                    docsByStatusId.set(best.id, existing);
                }
            });
            return { normalizedDocs, statusesAsc, docsByStatusId };
        }

        function collectTicketStatusAttachmentItems(statusEntry, docsByStatusId, renderedAttachmentPaths, usedDocPaths) {
            const items = [];
            if (Array.isArray(statusEntry && statusEntry.attachments)) {
                statusEntry.attachments.forEach(att => {
                    const filePath = att && att.filePath ? normalizeTicketUploadsPath(att.filePath) : '';
                    if (filePath && renderedAttachmentPaths) {
                        try { renderedAttachmentPaths.add(filePath); } catch (_) {}
                    }
                    items.push({ filePath, fileName: (att && att.fileName) || 'Fichier' });
                });
            }
            const statusId = String(statusEntry && statusEntry._id ? statusEntry._id : '');
            const docsForStatus = docsByStatusId.get(statusId) || [];
            docsForStatus.forEach(doc => {
                if (doc.__normPath && usedDocPaths) {
                    try { usedDocPaths.add(doc.__normPath); } catch (_) {}
                }
                items.push({ filePath: doc.__normPath || '', fileName: doc.fileName || 'Fichier' });
            });
            const seenKeys = new Set();
            return items.filter(item => {
                const key = (item.filePath && item.filePath.toLowerCase()) || (`name:${String(item.fileName || '').toLowerCase()}`);
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });
        }

        function createTicketConversationContent(role, statusText, commentText) {
            const content = document.createElement('div');
            content.className = 'bubble-content';
            const parts = [];
            if (role === 'system' && statusText) {
                parts.push({ text: normalizeTicketMultilineText(statusText), emphasis: true });
            }
            if (commentText) {
                parts.push({ text: normalizeTicketMultilineText(commentText), emphasis: false });
            }
            if (parts.length === 0) {
                parts.push({ text: 'Mise à jour', emphasis: false });
            }
            parts.forEach(part => {
                const paragraph = document.createElement('p');
                if (part.emphasis) {
                    const emphasized = document.createElement('em');
                    emphasized.textContent = part.text;
                    paragraph.appendChild(emphasized);
                } else {
                    paragraph.textContent = part.text;
                }
                content.appendChild(paragraph);
            });
            return content;
        }

        function renderConversationThread(statusesAsc, statusLabels, docsByStatusId) {
            try {
                const conversation = document.getElementById('conversation-thread');
                if (!conversation) {
                    console.error('Element conversation-thread introuvable');
                    return;
                }

                conversation.innerHTML = '';

                statusesAsc.forEach(statusEntry => {
                    const role = getTicketStatusRole(statusEntry);
                    const bubble = document.createElement('div');
                    bubble.className = `conversation-bubble ${role === 'client' ? 'from-client' : (role === 'admin' ? 'from-admin' : 'from-system')}`;
                    bubble.setAttribute('role', 'article');

                    const when = statusEntry.updatedAt ? new Date(statusEntry.updatedAt) : null;
                    const timeText = when ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(when) : '';
                    bubble.setAttribute('aria-label', `${role === 'client' ? 'Message client' : (role === 'admin' ? 'Message administrateur' : 'Mise à jour de statut')} ${timeText}`);

                    const header = document.createElement('div');
                    header.className = 'bubble-header';
                    const who = role === 'client' ? 'Client' : (role === 'admin' ? 'Admin' : 'Système');
                    header.innerHTML = `<span class="bubble-author">${who}</span><span class="bubble-time">${timeText}</span>`;

                    const statusText = statusLabels[statusEntry.status] || statusEntry.status || '';
                    const statusBadge = document.createElement('span');
                    statusBadge.className = `bubble-status-badge ${getTicketStatusBadgeClass(statusEntry.status)}`;
                    statusBadge.textContent = statusText;
                    const timeEl = header.querySelector('.bubble-time');
                    if (timeEl && timeEl.parentNode) {
                        header.insertBefore(statusBadge, timeEl);
                    } else {
                        header.appendChild(statusBadge);
                    }

                    const content = createTicketConversationContent(role, statusText, statusEntry.comment);
                    const attachmentItems = collectTicketStatusAttachmentItems(statusEntry, docsByStatusId);
                    const attachmentsList = attachmentItems.length > 0
                        ? createTicketAttachmentList(attachmentItems, 'bubble-attachments', 'bubble-attachment-item')
                        : null;

                    bubble.appendChild(header);
                    bubble.appendChild(content);
                    if (attachmentsList) {
                        bubble.appendChild(attachmentsList);
                    }
                    conversation.appendChild(bubble);
                });

                try { conversation.scrollTop = conversation.scrollHeight; } catch(_) {}
            } catch (error) {
                console.error('Erreur lors du rendu du fil de conversation:', error);
            }
        }

        function getTicketDocumentFilePath(doc) {
            if (doc.filePath) return normalizeTicketUploadsPath(doc.filePath);
            if (doc.fileId) return `/uploads/${doc.fileId}`;
            return '';
        }

        function createTicketDocumentGroupHeader(type, count) {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'document-group-header';
            groupHeader.innerHTML = `
                <h4>
                    <i class="fas ${documentTypeIcons[type] || 'fa-file'}"></i>
                    ${documentTypeTranslations[type] || type}
                    <span class="document-count">(${count})</span>
                </h4>
            `;
            return groupHeader;
        }

        function createTicketDocumentPreview(doc, filePath) {
            const docPreview = document.createElement('div');
            docPreview.className = 'document-preview';
            const fileExtension = doc.fileName ? doc.fileName.split('.').pop().toLowerCase() : '';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
            const isPDF = fileExtension === 'pdf';
            if (filePath && isImage) {
                docPreview.innerHTML = `<img src="${filePath}" alt="${doc.fileName}" class="document-thumbnail">`;
            } else if (filePath && isPDF) {
                docPreview.innerHTML = `
                    <div class="pdf-preview">
                        <i class="fas fa-file-pdf"></i>
                        <span>PDF</span>
                    </div>
                `;
            } else {
                docPreview.innerHTML = `<i class="fas ${documentTypeIcons[doc.type] || 'fa-file'} document-icon-large"></i>`;
            }
            return docPreview;
        }

        function createTicketDocumentItem(doc) {
            const docItem = document.createElement('div');
            docItem.className = 'document-item';

            const docIcon = document.createElement('div');
            docIcon.className = 'document-icon';
            docIcon.innerHTML = `<i class="fas ${documentTypeIcons[doc.type] || 'fa-file'}"></i>`;

            const docName = document.createElement('div');
            docName.className = 'document-name';
            docName.textContent = doc.fileName;

            const docActions = document.createElement('div');
            docActions.className = 'document-actions';

            const filePath = getTicketDocumentFilePath(doc);
            const docPreview = createTicketDocumentPreview(doc, filePath);

            if (filePath) {
                docActions.innerHTML = `<a href="${filePath}" target="_blank" class="btn-view-doc">Voir</a>`;
            } else {
                docActions.innerHTML = `<span class="disabled-link" title="Fichier non disponible">Voir</span>`;
            }

            docItem.appendChild(docPreview);
            docItem.appendChild(docName);
            docItem.appendChild(docActions);
            return docItem;
        }

        function createTicketStatusAttachmentsContainer(items, headerText) {
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'status-attachments';
            const attachmentsHeader = document.createElement('div');
            attachmentsHeader.className = 'status-attachments-header';
            attachmentsHeader.innerHTML = headerText;
            attachmentsContainer.appendChild(attachmentsHeader);
            const attachmentsList = createTicketAttachmentList(items, 'status-attachments-list', 'status-attachment-item');
            attachmentsContainer.appendChild(attachmentsList);
            return attachmentsContainer;
        }

        function createTicketStatusItem(status, index, docsByStatusId, renderedAttachmentPaths, usedDocPaths) {
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            if (index === 0) statusItem.classList.add('active');

            const statusDot = document.createElement('div');
            statusDot.className = 'status-dot';
            const icon = document.createElement('i');
            icon.className = `fas ${statusIcons[status.status] || 'fa-circle-info'}`;
            statusDot.appendChild(icon);

            const statusContent = document.createElement('div');
            statusContent.className = 'status-content';

            const statusDate = document.createElement('div');
            statusDate.className = 'status-date';
            statusDate.textContent = formatDate(status.updatedAt);

            const statusTitle = document.createElement('div');
            statusTitle.className = 'status-title';
            statusTitle.textContent = statusTranslations[status.status] || status.status;

            const statusDescription = document.createElement('div');
            statusDescription.className = 'status-description';
            statusDescription.textContent = normalizeTicketMultilineText(status.comment) || 'Mise à jour du statut';

            statusContent.appendChild(statusDate);
            statusContent.appendChild(statusTitle);
            statusContent.appendChild(statusDescription);

            if (status.additionalInfoRequested) {
                const additionalInfo = document.createElement('div');
                additionalInfo.className = 'additional-info';
                const additionalInfoLabel = document.createElement('strong');
                additionalInfoLabel.textContent = 'Informations demandées: ';
                const additionalInfoText = document.createElement('span');
                additionalInfoText.textContent = normalizeTicketMultilineText(status.additionalInfoRequested);
                additionalInfo.appendChild(additionalInfoLabel);
                additionalInfo.appendChild(additionalInfoText);
                statusContent.insertBefore(additionalInfo, statusDate);
            }

            const itemsToRender = collectTicketStatusAttachmentItems(status, docsByStatusId, renderedAttachmentPaths, usedDocPaths);
            if (itemsToRender.length > 0) {
                statusContent.appendChild(
                    createTicketStatusAttachmentsContainer(
                        itemsToRender,
                        `<i class="fas fa-paperclip"></i> Pièces jointes (${itemsToRender.length})`
                    )
                );
            }

            statusItem.appendChild(statusDot);
            statusItem.appendChild(statusContent);
            return statusItem;
        }

        function createTicketUnlinkedDocumentsItem(uniqueLeftovers) {
            const item = document.createElement('div');
            item.className = 'status-item';

            const dot = document.createElement('div');
            dot.className = 'status-dot';
            const icon = document.createElement('i');
            icon.className = 'fas fa-paperclip';
            dot.appendChild(icon);

            const content = document.createElement('div');
            content.className = 'status-content';

            const date = document.createElement('div');
            date.className = 'status-date';
            date.textContent = 'Documents non liés';

            const title = document.createElement('div');
            title.className = 'status-title';
            title.textContent = `Pièces jointes (${uniqueLeftovers.length})`;

            const container = createTicketStatusAttachmentsContainer(
                uniqueLeftovers.map(doc => ({ filePath: doc.__normPath || '', fileName: doc.fileName || 'Fichier' })),
                `<i class="fas fa-paperclip"></i> Documents du ticket (non liés)`
            );

            content.appendChild(date);
            content.appendChild(title);
            content.appendChild(container);
            item.appendChild(dot);
            item.appendChild(content);
            return item;
        }

        function resetTicketStatusFormAfterRender() {
            const form = document.getElementById('update-status-form');
            if (form) {
                form.reset();
                console.log('Formulaire de mise à jour du statut réinitialisé');
            } else {
                console.error('Formulaire de mise à jour du statut non trouvé lors de la réinitialisation');
            }
        }

        function stylizeTicketStatusForm() {
            try {
                const statusForm = document.getElementById('update-status-form');
                if (statusForm) {
                    statusForm.classList.add('panel', 'panel--status');
                    if (!statusForm.querySelector('.panel-header')) {
                        const stHeader = document.createElement('div');
                        stHeader.className = 'panel-header';
                        stHeader.innerHTML = '<i class="fas fa-flag-checkered"></i><h3>Mettre à jour le statut</h3>';
                        statusForm.insertBefore(stHeader, statusForm.firstChild);
                    }
                } else {
                    console.warn('Formulaire #update-status-form introuvable pour stylisation en carte');
                }
            } catch(err) {
                console.warn('Impossible de styliser le formulaire de statut en carte', err);
            }
        }

        function renderDocumentsPanel(ticket) {
            console.log('Mise à jour des documents');
            try {
                const documentsList = document.getElementById('documents-list');
                if (!documentsList) {
                    console.error('Element documents-list introuvable');
                    return;
                }

                documentsList.innerHTML = '';

                if (!(ticket.documents && ticket.documents.length > 0)) {
                    documentsList.innerHTML = '<p>Aucun document joint</p>';
                    return;
                }

                const documentsByType = {};
                documentTypeOrder.forEach(type => {
                    documentsByType[type] = [];
                });

                ticket.documents.forEach(doc => {
                    const docType = doc.type || 'documents_autres';
                    if (!documentsByType[docType]) {
                        documentsByType[docType] = [];
                    }
                    documentsByType[docType].push(doc);
                });

                documentTypeOrder.forEach(type => {
                    const docs = documentsByType[type];
                    if (!docs || docs.length === 0) return;

                    documentsList.appendChild(createTicketDocumentGroupHeader(type, docs.length));

                    const groupContainer = document.createElement('div');
                    groupContainer.className = 'document-group';

                    docs.forEach(doc => {
                        groupContainer.appendChild(createTicketDocumentItem(doc));
                    });

                    documentsList.appendChild(groupContainer);
                });
            } catch (error) {
                console.error('Erreur lors de la mise à jour des documents:', error);
            }
        }

        function renderStatusTimeline(statusHistory, statusesAsc, normalizedDocs, docsByStatusId) {
            console.log('Mise à jour de l\'historique des statuts');
            try {
                const statusTimeline = document.getElementById('detail-status-timeline');
                if (!statusTimeline) {
                    console.error('Element detail-status-timeline introuvable');
                    return;
                }

                statusTimeline.innerHTML = '';

                if (!(statusHistory && statusHistory.length > 0)) {
                    statusTimeline.innerHTML = '<p>Aucun historique de statut disponible</p>';
                    resetTicketStatusFormAfterRender();
                    console.log('Affichage des détails du ticket terminé');
                    return;
                }

                const renderedAttachmentPaths = new Set();
                const usedDocPaths = new Set();

                statusesAsc.forEach((status, index) => {
                    statusTimeline.appendChild(
                        createTicketStatusItem(status, index, docsByStatusId, renderedAttachmentPaths, usedDocPaths)
                    );
                });

                try {
                    const leftovers = normalizedDocs.filter(doc => doc.__normPath && !renderedAttachmentPaths.has(doc.__normPath) && !usedDocPaths.has(doc.__normPath));
                    const leftoversMap = new Map();
                    leftovers.forEach(doc => {
                        if (!leftoversMap.has(doc.__normPath)) leftoversMap.set(doc.__normPath, doc);
                    });
                    const uniqueLeftovers = Array.from(leftoversMap.values());
                    if (uniqueLeftovers.length > 0) {
                        statusTimeline.appendChild(createTicketUnlinkedDocumentsItem(uniqueLeftovers));
                    }
                } catch (e) {
                    console.warn('Impossible d\'ajouter le bloc documents dans la timeline:', e);
                }

                resetTicketStatusFormAfterRender();
                console.log('Affichage des détails du ticket terminé');
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'historique des statuts:', error);
            }
        }

        function displayTicketDetails(ticket, statusHistory) {
            console.log('Début de displayTicketDetails', { ticket, statusHistory });
            try { window.currentTicketData = ticket; } catch (_) {}
            Promise.resolve(refreshActiveTemplatesCache())
                .then(() => populateResponseTemplateSelect())
                .catch(error => console.warn('Impossible de recharger les modèles de réponse:', error));

            try {
                renderTicketIdentity(ticket);
                renderTicketPriority(ticket);
                renderTicketAssignment(ticket);
                renderTicketClientInfo(ticket);
                renderTicketVehicleInfo(ticket);
                renderTicketPartInfo(ticket);
                renderTicketInternalNotes(ticket);

                const statusLabelMap = statusTranslations || window.statusTranslations || {};
                const { normalizedDocs, statusesAsc, docsByStatusId } = buildTicketStatusDocumentsContext(ticket.documents, statusHistory);

                renderConversationThread(statusesAsc, statusLabelMap, docsByStatusId);
                stylizeTicketStatusForm();
                renderDocumentsPanel(ticket);
                renderStatusTimeline(statusHistory, statusesAsc, normalizedDocs, docsByStatusId);
            } catch (error) {
                console.error('Erreur globale dans displayTicketDetails:', error);
                alert('Erreur lors de l\'affichage des détails du ticket. Veuillez consulter la console pour plus d\'informations.');
            }
        }

        return {
            displayTicketDetails
        };
    }

    window.createTicketDetailsController = createTicketDetailsController;
})();
