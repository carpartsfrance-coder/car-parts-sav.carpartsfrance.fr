const mongoose = require('mongoose');

const TaskTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  tags: [{ type: String }]
}, { timestamps: true });

TaskTemplateSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('TaskTemplate', TaskTemplateSchema);
