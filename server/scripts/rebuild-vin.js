#!/usr/bin/env node

/**
 * Recalcule le VIN / Plaque pour toutes les commandes en base.
 * Usage : node server/scripts/rebuild-vin.js
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const connectDB = require('../db');
const Order = require('../models/order');
const { rebuildVinOrPlateInternal } = require('../server');

(async () => {
  try {
    await connectDB();
    mongoose.connection.on('error', (err) => {
      console.error('[rebuild-vin] MongoDB error', err);
      process.exit(1);
    });

    console.log('[rebuild-vin] Démarrage du recalcul VIN/plaque…');
    const { scanned, updated } = await rebuildVinOrPlateInternal();
    console.log(`[rebuild-vin] Terminé. ${updated} mise(s) à jour sur ${scanned} commande(s).`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[rebuild-vin] Erreur', error);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
