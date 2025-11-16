const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  type: { type: String, enum: ['assignment', 'assistance', 'escalation', 'task_reminder', 'task_digest'], required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', index: true },
  ticketNumber: { type: String },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  title: { type: String, required: true },
  message: { type: String },
  isRead: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: true, updatedAt: true } });

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
