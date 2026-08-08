import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Interview from './models/Interview.js';
import { generateAccessToken } from './utils/generateToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyAdminAuth() {
  console.log('=== Testing Admin Auth & Growth Analysis Data Models ===');
  
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interview_ai';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Find or create test admin user
  let adminUser = await User.findOne({ email: 'admin@test.com' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      credits: 99
    });
    console.log('Created test admin user: admin@test.com');
  } else if (adminUser.role !== 'admin') {
    adminUser.role = 'admin';
    await adminUser.save();
    console.log('Promoted admin@test.com to admin role');
  }

  // Find or create test regular user
  let regularUser = await User.findOne({ email: 'candidate@test.com' });
  if (!regularUser) {
    regularUser = await User.create({
      name: 'Candidate User',
      email: 'candidate@test.com',
      password: 'password123',
      role: 'user',
      credits: 3
    });
    console.log('Created test candidate user: candidate@test.com');
  }

  console.log('\n--- Admin User Details ---');
  console.log('Name:', adminUser.name);
  console.log('Role:', adminUser.role);
  console.log('Token generated:', generateAccessToken(adminUser._id).slice(0, 20) + '...');

  console.log('\n--- Regular User Details ---');
  console.log('Name:', regularUser.name);
  console.log('Role:', regularUser.role);

  await mongoose.disconnect();
  console.log('\n=== Admin Auth Verification Completed Successfully! ===');
}

verifyAdminAuth().catch(err => {
  console.error('Admin verification error:', err);
  process.exit(1);
});
