import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropInterviews = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connection.collection('interviews').drop();
    console.log('Dropped interviews collection');
    process.exit(0);
  } catch (err) {
    if (err.code === 26) {
      console.log('Collection does not exist, nothing to drop.');
      process.exit(0);
    } else {
      console.error(err);
      process.exit(1);
    }
  }
};
dropInterviews();
