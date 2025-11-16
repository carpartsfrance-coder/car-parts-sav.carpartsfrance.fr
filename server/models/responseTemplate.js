const mongoose = require('mongoose');

const ResponseTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, lowercase: true, unique: true },
  label: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: true } });

ResponseTemplateSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('ResponseTemplate', ResponseTemplateSchema);
