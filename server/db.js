const mongoose = require('mongoose');
require('dotenv').config();

// URI de connexion MongoDB
// Production: utilisez MONGODB_URI (ex: MongoDB Atlas)
// Développement: fallback sur MONGODB_LOCAL_URI puis localhost
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/carparts_sav';

// Options de connexion
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Timeout de 5 secondes pour la sélection du serveur
};

// Connexion à MongoDB (production ou local selon variables d'environnement)
const connectDB = async () => {
  try {
    const safeUri = MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
    console.log('Tentative de connexion à MongoDB...', { uri: safeUri });
    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ Connexion à MongoDB établie avec succès');
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
