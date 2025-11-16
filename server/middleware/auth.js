// Middleware d'authentification admin/agent (Basic Auth)
// Accepte:
//  - ADMIN_USERNAME / ADMIN_PASSWORD (variables d'environnement)
//  - Compte "directeur" si DIRECTOR_ACCOUNT_ENABLED=true (directeur / CarParts2025)
//  - Utilisateur SAV (email) existant en base et actif (isActive: true)
const bcrypt = require('bcryptjs');
const User = require('../models/user');

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      // Optionnel: forcer la popup navigateur
      res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
    const DIRECTOR_ACCOUNT_ENABLED = process.env.DIRECTOR_ACCOUNT_ENABLED === 'true';

    // Décodage de l'authentification Basic
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const sepIdx = credentials.indexOf(':');
    const username = sepIdx >= 0 ? credentials.slice(0, sepIdx) : credentials;
    const password = sepIdx >= 0 ? credentials.slice(sepIdx + 1) : '';

    // 1) Identifiants ENV admin
    if (ADMIN_USERNAME && ADMIN_PASSWORD && username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.auth = { type: 'env', role: 'admin', username };
      return next();
    }

    // 2) Compte directeur (optionnel)
    if (DIRECTOR_ACCOUNT_ENABLED && username.toLowerCase() === 'directeur' && password === 'CarParts2025') {
      req.auth = { type: 'env', role: 'admin', username: 'directeur' };
      return next();
    }

    // 3) Utilisateur SAV en base
    try {
      const user = await User.findOne({ email: (username || '').toLowerCase(), isActive: true });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
      }
      const ok = await bcrypt.compare(password || '', user.passwordHash || '');
      if (!ok) {
        return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
      }
      // Auth OK (rôle: admin ou agent selon la base)
      req.auth = { type: 'user', role: user.role, id: user._id.toString(), email: user.email };
      return next();
    } catch (dbErr) {
      console.error('[auth] Erreur lookup user:', dbErr);
      return res.status(500).json({ success: false, message: 'Erreur serveur auth' });
    }
  } catch (e) {
    console.error('[auth] Erreur auth:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur auth' });
  }
};

module.exports = { authenticateAdmin };
