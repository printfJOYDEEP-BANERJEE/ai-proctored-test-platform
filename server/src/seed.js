const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

/**
 * Auto-seeds the initial Super Admin account if none exists in MongoDB.
 */
const seedSuperAdmin = async () => {
  try {
    const existing = await Admin.findOne({ email: 'superadmin@globussoft.in' });
    if (!existing) {
      const passwordHash = await bcrypt.hash('GlobusAdmin2026!', 12);
      await Admin.create({
        name: 'Super Admin',
        email: 'superadmin@globussoft.in',
        passwordHash,
        role: 'SUPER_ADMIN',
        createdBy: null,
        isActive: true,
      });
      console.log('[Seed] Super Admin initialized (superadmin@globussoft.in / GlobusAdmin2026!)');
    }
  } catch (err) {
    console.error('[Seed] Error initializing Super Admin:', err.message);
  }
};

module.exports = { seedSuperAdmin };
