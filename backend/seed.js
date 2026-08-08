import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createDefaultUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const userExists = await User.findOne({ email: 'test@example.com' });
    if (!userExists) {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123' // Password will be automatically hashed by the Mongoose pre-save hook
      });
      console.log('Default user created: test@example.com / password123');
    } else {
      console.log('Default user already exists: test@example.com / password123');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
};

createDefaultUser();
