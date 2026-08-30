// Section 8.2 — Admin collection (exact field names/types as specified)
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN'], required: true },
    // null for the first super admin (Section 8.2)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
