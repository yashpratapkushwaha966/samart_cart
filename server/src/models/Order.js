import mongoose from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS } from '../services/orderStateMachine.js';

const { Schema } = mongoose;

// Prices are copied here at checkout, so later price changes never alter old bills.
const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    pricePaise: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalPaise: { type: Number, required: true },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    status: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    role: String,
    at: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    couponCode: { type: String, required: true, unique: true }, // internal reference only. Never shown. Pickup uses the customer's permanent PIN
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, trim: true, maxlength: 80 }, // snapshot, staff only sees this
    outlet: { type: Schema.Types.ObjectId, ref: 'Outlet', required: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    instructions: { type: String, trim: true, maxlength: 200, default: '' },
    subtotalPaise: { type: Number, required: true },
    discountPaise: { type: Number, default: 0 },
    offerCode: String,
    feePaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    taxLabel: String,
    totalPaise: { type: Number, required: true },
    serviceType: { type: String, enum: ['dine_in', 'takeaway'], default: 'takeaway', required: true }, // eat at the cart or carry home
    paymentMethod: { type: String, enum: ['cash', 'upi', 'online'], required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'Pending' }, // mirror of Payment.status
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    status: { type: String, enum: ORDER_STATUS, default: 'Placed', index: true },
    statusHistory: [historySchema],
    cancelledReason: String,
    idempotencyKey: String,
  },
  { timestamps: true }
);

orderSchema.index({ outlet: 1, status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
// The same customer sending the same key twice (double tap, retry) gets the same order back.
orderSchema.index(
  { customer: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export const Order = mongoose.model('Order', orderSchema);
