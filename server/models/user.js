const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
  isActive: { type: Boolean, default: true },
  // Réinitialisation de mot de passe
  passwordResetTokenHash: { type: String, default: null },
  passwordResetTokenExpires: { type: Date, default: null },
  lastPasswordResetRequestedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: true } });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
