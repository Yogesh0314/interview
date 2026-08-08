import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from '../models/User.js';

export const createOrder = async (req, res) => {
  try {
    const { amount, plan } = req.body;
    
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    if (key_id === 'rzp_test_dummy') {
      // Mock order creation for local testing without real keys
      return res.json({ 
        order: { id: `order_mock_${Date.now()}`, amount: amount * 100, currency: "INR" }, 
        plan 
      });
    }

    const rzp = new Razorpay({ key_id, key_secret });

    const options = {
      amount: amount * 100, // Razorpay works in paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const order = await rzp.orders.create(options);
    res.json({ order, plan });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    if (key_id !== 'rzp_test_dummy') {
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed: Invalid signature' });
      }
    }

    // Credits logic based on plan
    let addedCredits = 0;
    if (plan === 'Pro') addedCredits = 10;
    else if (plan === 'Enterprise') addedCredits = 50;
    else addedCredits = 5;

    const user = await User.findById(req.user._id);
    user.credits += addedCredits;
    await user.save();

    res.json({ message: 'Payment verified successfully', credits: user.credits });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};
