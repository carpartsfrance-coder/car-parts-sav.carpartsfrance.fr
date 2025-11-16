const mongoose = require('mongoose');

const reviewInviteSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  orderNumber: { type: String },
  decision: { type: String, enum: ['yes', 'no'], default: undefined },
  lockedByNo: { type: Boolean, default: false },
  clickedYesAt: { type: Date },
  clickedNoAt: { type: Date },
  feedbackReason: { type: String },
  feedbackDetails: { type: String },
  feedbackSubmittedAt: { type: Date },
  revoked: { type: Boolean, default: false },
  revokedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('ReviewInvite', reviewInviteSchema);
