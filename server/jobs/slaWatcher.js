const Ticket = require('../models/ticket');
const StatusUpdate = require('../models/status');
const { sendSlaReminderEmail } = require('../services/emailService');

// Statuts considérés comme "fermés" (pas de suivi SLA)
const CLOSED_STATUSES = ['clôturé', 'refusé'];

function hoursBetween(fromDate, toDate) {
  try {
    return (toDate.getTime() - fromDate.getTime()) / 36e5; // heures
  } catch (_) {
    return 0;
  }
}

async function runSlaScanOnce() {
  const now = new Date();
  const REMINDER_HOURS = parseInt(process.env.SLA_REMINDER_HOURS_1 || '20', 10);
  const ALERT_HOURS = parseInt(process.env.SLA_ALERT_HOURS_2 || '24', 10);

  // Récupérer les tickets "ouverts"
  const tickets = await Ticket.find({ currentStatus: { $nin: CLOSED_STATUSES } })
    .populate('assignedTo', 'firstName lastName email role isActive')
    .lean(false); // on garde des instances Mongoose pour pouvoir sauvegarder

  if (!tickets || tickets.length === 0) {
    console.log('[slaWatcher] Aucun ticket ouvert à analyser');
    return;
  }

  // Préparer la liste des IDs
  const ticketIds = tickets.map(t => t._id);

  // Agrégation: dernière MAJ côté client et côté agent (admin/agent)
  const stats = await StatusUpdate.aggregate([
    { $match: { ticketId: { $in: ticketIds } } },
    { $group: {
        _id: '$ticketId',
        lastClientAt: {
          $max: { $cond: [{ $eq: ['$updatedBy', 'client'] }, '$updatedAt', null] }
        },
        lastAgentAt: {
          $max: { $cond: [{ $in: ['$updatedBy', ['admin', 'agent']] }, '$updatedAt', null] }
        }
      }
    }
  ]);

  const byId = new Map(stats.map(s => [String(s._id), s]));

  let processed = 0;
  let sent20 = 0;
  let sent24 = 0;

  for (const t of tickets) {
    const s = byId.get(String(t._id)) || {};
    const lastClientAt = s.lastClientAt ? new Date(s.lastClientAt) : null;
    const lastAgentAt = s.lastAgentAt ? new Date(s.lastAgentAt) : null;

    let since = null;

    // Cas 1: aucune réponse agent (admin/agent) -> partir de la création
    if (!lastAgentAt) {
      since = t.createdAt;
    }
    // Cas 2: la dernière réponse client est plus récente que la dernière réponse agent
    else if (lastClientAt && lastClientAt > lastAgentAt) {
      since = lastClientAt;
    } else {
      continue; // pas en attente de réponse agent
    }

    if (!since) continue;

    const hoursLate = hoursBetween(since, now);
    const hoursInt = Math.floor(hoursLate);

    try {
      if (hoursLate >= ALERT_HOURS) {
        // Anti-doublon: si alerte déjà envoyée APRÈS l'événement déclencheur, on saute
        if (!t.slaAlert24At || t.slaAlert24At < since) {
          await sendSlaReminderEmail(t, t.assignedTo, hoursInt);
          t.slaAlert24At = now;
          await t.save();
          sent24++;
        }
      } else if (hoursLate >= REMINDER_HOURS) {
        if (!t.slaReminder20At || t.slaReminder20At < since) {
          await sendSlaReminderEmail(t, t.assignedTo, hoursInt);
          t.slaReminder20At = now;
          await t.save();
          sent20++;
        }
      }

      processed++;
    } catch (e) {
      console.error('[slaWatcher] Erreur lors du traitement du ticket', t.ticketNumber, e);
    }
  }

  console.log(`[slaWatcher] Terminé: candidats=${tickets.length}, traités=${processed}, rappels20=${sent20}, alertes24=${sent24}`);
}

function startSlaWatcher() {
  const intervalMinutes = parseInt(process.env.SLA_WATCHER_INTERVAL_MINUTES || '60', 10);

  let running = false;
  const safeRun = async () => {
    if (running) return;
    running = true;
    try {
      await runSlaScanOnce();
    } catch (e) {
      console.error('[slaWatcher] Exécution échouée:', e);
    } finally {
      running = false;
    }
  };

  // 1ère exécution avec un léger délai pour laisser l'appli démarrer
  setTimeout(safeRun, 30 * 1000);
  // Exécution périodique
  setInterval(safeRun, Math.max(1, intervalMinutes) * 60 * 1000);
  console.log(`[slaWatcher] Démarré. Intervalle=${intervalMinutes} min, seuils=${process.env.SLA_REMINDER_HOURS_1 || '20'}h/${process.env.SLA_ALERT_HOURS_2 || '24'}h`);
}

module.exports = { startSlaWatcher };
