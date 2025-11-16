const mongoose = require('mongoose');

const orderEventSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  type: { type: String, required: true },
  message: { type: String },
  payloadSnippet: { type: Object }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  sku: String,
  name: String,
  qty: Number,
  unitPrice: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['woocommerce', 'mollie', 'bank_transfer', 'manual'] },
  providerOrderId: { type: String },
  number: { type: String },
  status: { type: String, required: true, enum: [
    'pending_payment', 'awaiting_transfer', 'paid', 'processing', 'fulfilled',
    'partially_fulfilled', 'delivered', 'delivered_awaiting_deposit', 'deposit_received', 'refund_pending',
    'cancelled', 'failed', 'refunded', 'disputed'
  ], default: 'pending_payment' },
  customer: {
    name: String,
    email: String,
    phone: String
  },
  totals: {
    currency: { type: String, default: 'EUR' },
    amount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 }
  },
  items: [orderItemSchema],
  payment: {
    method: String,
    paidAt: Date,
    txId: String,
    // Mollie specifics
    molliePaymentId: { type: String, index: true, unique: false },
    mollieMode: String,
    mollieStatus: String
  },
  billing: {
    address: Object
  },
  shipping: {
    address: Object,
    carrier: String,
    trackingNumber: String,
    shippedAt: Date,
    estimatedDeliveryAt: Date
  },
  meta: {
    sourcePayloadHash: String,
    sourceCreatedAt: Date,
    sourceUpdatedAt: Date,
    // VIN / Plaque d'immatriculation saisi côté Woo (ou côté outil)
    vinOrPlate: String,
    // Clé et identifiant meta Woo correspondants si détectés
    wooVinMetaKey: String,
    wooVinMetaId: String,
    notes: [String],
    // Références techniques internes (mécatronique/TCU)
    engineDisplacement: String, // ex: "1.4"
    tcuReference: String,       // ex: "0AM927769D"
    technicalRefRequired: { type: Boolean, default: false },
    // Type de produit (pour filtrer et trier la liste des commandes)
    // Valeurs possibles: mecatronique_tcu, pont, boite_transfert, moteur, autres
    productType: { type: String, enum: ['mecatronique_tcu','pont','boite_transfert','moteur','autres'], default: 'autres', index: true },
    // Version de synchronisation pour protéger les champs saisis manuellement
    syncVersion: { type: Number, default: 0 }
  },
  events: [orderEventSchema]
}, { timestamps: true });

orderSchema.index({ provider: 1, providerOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ 'payment.molliePaymentId': 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, updatedAt: -1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ 'shipping.trackingNumber': 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
