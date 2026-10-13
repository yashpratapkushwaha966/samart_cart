// npm run seed            -> admin account, one cart, settings (+ sample menu when not in production)
// npm run seed -- --with-sample-menu   -> force the sample menu even in production
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env, assertEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User, Outlet, Category, Product, Offer, Setting } from '../src/models/index.js';

const log = (m) => console.log(`  - ${m}`);
const rupees = (n) => n * 100;

async function main() {
  assertEnv();
  if (!env.admin.email || env.admin.password.length < 10) throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of 10+ characters in .env');
  if (env.isProd && env.admin.password === 'change-this-strong-password') throw new Error('Change ADMIN_PASSWORD before seeding production');

  await connectDb();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  console.log('Seeding...');

  await Setting.updateOne({ key: 'business' }, { $setOnInsert: { key: 'business' } }, { upsert: true });
  log('business settings ready');

  if (!(await User.exists({ email: env.admin.email }))) {
    await User.create({ name: env.admin.name, email: env.admin.email, role: 'admin', passwordHash: await bcrypt.hash(env.admin.password, 12) });
    log(`admin created: ${env.admin.email}`);
  } else log('admin already exists (password unchanged)');

  let outlet = await Outlet.findOne({ slug: 'main-cart' });
  if (!outlet) {
    outlet = await Outlet.create({ name: 'Smart Momos - Main Cart', code: 'SMC', slug: 'main-cart', address: 'Set your cart address in Admin > Carts' });
    log('cart created (open Admin > Carts to set UPI id, hours and print the QR)');
  } else log('cart already exists');

  if (env.seedStaff.email && env.seedStaff.password.length >= 10 && !(await User.exists({ email: env.seedStaff.email }))) {
    await User.create({ name: 'Cart Staff', email: env.seedStaff.email, role: 'staff', outletIds: [outlet._id], passwordHash: await bcrypt.hash(env.seedStaff.password, 12) });
    log(`staff created: ${env.seedStaff.email}`);
  }

  if (!env.isProd || process.argv.includes('--with-sample-menu')) {
    if ((await Product.countDocuments()) === 0) {
      const cats = {};
      for (const [i, [name, slug]] of [['Steamed', 'steamed'], ['Fried', 'fried'], ['Kurkure & Specials', 'specials']].entries()) {
        cats[slug] = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { name, slug, sortOrder: i } }, { upsert: true, new: true });
      }
      await Product.insertMany([
        { name: 'Veg Momos', description: 'Classic steamed momos stuffed with cabbage, carrot and herbs. Served with spicy red chutney.', pricePaise: rupees(60), category: cats.steamed._id, isFeatured: true, sortOrder: 1 },
        { name: 'Paneer Momos', description: 'Soft steamed momos filled with seasoned paneer and onions.', pricePaise: rupees(80), category: cats.steamed._id, isFeatured: true, sortOrder: 2 },
        { name: 'Cheese Corn Momos', description: 'Steamed momos with a gooey cheese and sweet corn filling.', pricePaise: rupees(90), category: cats.steamed._id, sortOrder: 3 },
        { name: 'Fried Momos', description: 'Golden, crispy fried veg momos with schezwan dip.', pricePaise: rupees(70), category: cats.fried._id, isFeatured: true, sortOrder: 1 },
        { name: 'Kurkure Momos', description: 'Crunchy kurkure-coated momos, crispy outside and juicy inside.', pricePaise: rupees(90), category: cats.specials._id, isFeatured: true, sortOrder: 1 },
        { name: 'Peri Peri Momos', description: 'Tossed in smoky peri-peri masala for a spicy kick.', pricePaise: rupees(85), category: cats.specials._id, sortOrder: 2 },
      ]);
      log('sample menu created (replace with your real items and photos in Admin > Menu)');
    } else log('products already exist, sample menu skipped');
    await Offer.updateOne({ code: 'WELCOME10' }, { $setOnInsert: { code: 'WELCOME10', title: '10% off your first order', description: 'Valid on orders above ₹100. Max discount ₹50.', type: 'percent', value: 10, minOrderPaise: rupees(100), maxDiscountPaise: rupees(50), perUserLimit: 1 } }, { upsert: true });
    log('sample offer WELCOME10 ready');
  }

  await disconnectDb();
  console.log('Done.');
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
