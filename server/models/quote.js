const mongoose = require('mongoose');

const QuoteMessageSchema = new mongoose.Schema({
  direction: { type: String, enum: ['in', 'out'], required: true },
  channel: { type: String, enum: ['email', 'phone', 'system'], default: 'email' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at: { type: Date, default: Date.now }
}, { _id: false });

const QuoteSchema = new mongoose.Schema({
  source: { type: String, default: 'wordpress' },
  plugin: { type: String, default: '' },

  providerReferenceId: { type: String, default: '', index: true },

  customer: {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' }
  },

  vehicle: {
    immatriculation: { type: String, default: '' },
    vin: { type: String, default: '' }
  },

  items: [{
    name: { type: String, default: '' },
    sku: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    productId: { type: String, default: '' }
  }],

  message: { type: String, default: '' },

  attachments: [{
    url: { type: String, default: '' },
    filename: { type: String, default: '' },
    mimeType: { type: String, default: '' }
  }],

  status: { type: String, enum: ['new', 'responded', 'closed'], default: 'new', index: true },

  conversation: [QuoteMessageSchema]
}, { timestamps: true });

QuoteSchema.index({ createdAt: -1 });
QuoteSchema.index({ 'customer.email': 1 });
QuoteSchema.index({ 'customer.name': 'text', 'message': 'text' });

module.exports = mongoose.model('Quote', QuoteSchema);
