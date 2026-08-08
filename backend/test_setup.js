

async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("Logged in!");

    const formData = new FormData();
    formData.append('rawText', 'I am a software engineer with 5 years of React and Node.js experience.');
    formData.append('length', '15');

    const setupRes = await fetch('http://localhost:5000/api/interview/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    
    const setupData = await setupRes.json();
    console.log("Setup Success:", setupData);
  } catch (err) {
    console.error("Setup Error:", err);
  }
}
test();
