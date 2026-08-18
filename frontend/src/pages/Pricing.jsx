import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const navigate = useNavigate();

  const handlePurchase = async (amount, plan) => {
    setLoadingPlan(plan);
    const res = await loadRazorpayScript();
    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setLoadingPlan(null);
      return;
    }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/payments/create-order`, {
        amount, plan
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // If backend returned a mocked order, simulate payment success immediately
      if (data.order.id.startsWith('order_mock_')) {
        const verifyRes = await axios.post(`${API_BASE_URL}/api/payments/verify`, {
          razorpay_order_id: data.order.id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_signature',
          plan
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        alert(`Mock Payment Successful (Test Mode)! You now have ${verifyRes.data.credits} credits.`);
        navigate('/dashboard');
        return;
      }

      const options = {
        key: data.key_id || 'rzp_test_dummy',
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'Interview.ai',
        description: `${plan} Plan Purchase`,
        order_id: data.order.id,
        handler: async function (response) {
          try {
            const verifyRes = await axios.post(`${API_BASE_URL}/api/payments/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan
            }, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            alert(`Payment Successful! You now have ${verifyRes.data.credits} credits.`);
            navigate('/dashboard');
          } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
              localStorage.removeItem('token');
              localStorage.removeItem('userName');
              alert('Session expired. Please log in again.');
              navigate('/login');
            } else {
              alert('Payment verification failed.');
            }
          }
        },
        theme: {
          color: '#4f46e5'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        alert('Session expired. Please log in again.');
        navigate('/login');
      } else {
        alert('Failed to initiate payment.');
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-20 px-4 relative z-10">
      <div className="text-center mb-16 animate-fade-in">
        <h1 className="text-5xl font-black text-white tracking-tight mb-4">Upgrade Your Career.</h1>
        <p className="text-xl text-neutral-400 max-w-2xl mx-auto">Purchase credits to unlock more AI interviews and secure your dream job.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Starter Plan */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden flex flex-col hover:border-neutral-600 transition-colors">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px]"></div>
          <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-black text-emerald-400">₹499</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              5 Interview Credits
            </li>
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Basic ATS Analysis
            </li>
          </ul>
          <button 
            onClick={() => handlePurchase(499, 'Starter')}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-emerald-500/50 text-emerald-400 font-bold hover:bg-emerald-500/10 transition-colors"
          >
            {loadingPlan === 'Starter' ? 'Processing...' : 'Buy Starter'}
          </button>
        </div>

        {/* Pro Plan */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden flex flex-col border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] transform md:-translate-y-4">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-[50px]"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-b-lg uppercase tracking-wider">Most Popular</div>
          <h3 className="text-xl font-bold text-white mb-2 mt-4">Pro</h3>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-black text-indigo-400">₹899</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              10 Interview Credits
            </li>
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Advanced ATS Analysis
            </li>
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Downloadable PDF Reports
            </li>
          </ul>
          <button 
            onClick={() => handlePurchase(899, 'Pro')}
            disabled={loadingPlan !== null}
            className="w-full btn-primary py-3 rounded-xl font-bold flex justify-center items-center"
          >
            {loadingPlan === 'Pro' ? 'Processing...' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden flex flex-col hover:border-neutral-600 transition-colors">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px]"></div>
          <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-black text-purple-400">₹3999</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              50 Interview Credits
            </li>
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Priority Support
            </li>
            <li className="flex gap-3 text-neutral-300 text-sm">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              All Pro Features
            </li>
          </ul>
          <button 
            onClick={() => handlePurchase(3999, 'Enterprise')}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-purple-500/50 text-purple-400 font-bold hover:bg-purple-500/10 transition-colors"
          >
            {loadingPlan === 'Enterprise' ? 'Processing...' : 'Buy Enterprise'}
          </button>
        </div>

      </div>
    </div>
  );
}
