const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

let user = {}; // Simulated user storage

// STEP 1: Generate Secret and QR Code
app.get('/generate', (req, res) => {
    const secret = speakeasy.generateSecret({ name: "YourAppName (user@example.com)" });

    user.secret = secret.base32; // Store user's secret

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        res.send({
            secret: secret.base32,
            qr: data_url
        });
    });
});

// STEP 2: Verify OTP from user
app.post('/verify', (req, res) => {
    const { token } = req.body;

    const verified = speakeasy.totp.verify({
        secret: user.secret,
        encoding: 'base32',
        token,
        window: 1 // Time step window (optional, default 0)
    });

    res.send({ verified });
});

// Test endpoint
app.get('/', (req, res) => {
    res.send('2FA API is running!');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
