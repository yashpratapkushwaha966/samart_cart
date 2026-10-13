import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../services/orderStateMachine.js';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    method: { type: String, enum: ['cash', 'upi', 'online'], required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: PAYMENT_STATUS, default: 'Pending', index: true },
    // online (Razorpay)
    provider: String,
    gatewayOrderId: { type: String, unique: true, sparse: true },
    gatewayPaymentId: { type: String, unique: true, sparse: true },
    duplicatePaymentIds: [String], // a second successful charge for the same order: needs a manual refund
    // manual (cash / UPI)
    upiReference: { type: String, trim: true, maxlength: 40 },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedByRole: String,
    confirmedAt: { type: Date, index: true },
    refundedAt: Date,
    refundNote: String,
  },
  { timestamps: true }
);

paymentSchema.index({ status: 1, confirmedAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
