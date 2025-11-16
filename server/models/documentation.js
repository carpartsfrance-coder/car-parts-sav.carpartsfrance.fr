const mongoose = require('mongoose');

const documentationSchema = new mongoose.Schema({
  // Chemin logique (ex: guides/mecatroniques.md)
  path: { type: String, required: true, unique: true, index: true },
  // Nom de fichier (ex: mecatroniques.md)
  name: { type: String, required: true },
  // Contenu Markdown
  content: { type: String, default: '' },
  // Taille en octets (facilite l'affichage sans recalcul)
  size: { type: Number, default: 0 },
}, { timestamps: true });

const Documentation = mongoose.model('Documentation', documentationSchema);
module.exports = Documentation;
