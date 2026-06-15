const axios = require("axios");
const config = require("../../config/config");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const WebSocket = require('ws');
let token = '';
let jwt = '';
module.exports.jwt = jwt;
const socket = require("../../config/socketIO")

async function t4bLogin(){
    const endpoint = '/auth/login';
  
    try {
      const response = await axios.post(`https://flexymarkets.tp.t4b.com:8081/api${endpoint}`, {
        username: "Felexywebmobile",
        password: "mobile#0011"
      });
  
      console.log('Login Successful', response.data);
      token = response.data.refresh;
    } catch (error) {
      console.error('Login failed:', error.response ? error.response.data : error.message);
    }
}
t4bLogin()

async function refreshToken(){
    const endpoint = '/auth/refresh';
  
    try {
      const response = await axios.post(`https://flexymarkets.tp.t4b.com:8081/api${endpoint}`, {
        token: token
      });
  
      console.log('refresh Token', response.data);
      jwt = response.data.jwt;
    } catch (error) {
      console.error('Login failed:', error.response ? error.response.data : error.message);
    }
}
setTimeout(refreshToken, 10000)

async function quotes(){
    const wsUrl = `wss://flexymarkets.tp.t4b.com:8081/api/quotes?auth=${jwt}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
    console.log('📡 WebSocket connected. Subscribing to EURUSD...');
    const symbols = [
        "AUDJPY", "AUDNZD", "AUDUSD", "AUS200", "CADCHF",
        "CADJPY", "CHFJPY", "EURAUD", "EURCAD", "EURCHF",
        "EURGBP", "EURJPY", "EURNZD", "EURUSD", "GBPAUD",
        "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD", "GBPUSD",
        "NZDCAD", "NZDCHF", "NZDJPY", "NZDUSD", "US30",
        "USDCAD", "USDCHF", "USDJPY", "USDNOK", "XAGUSD",
        "XAUUSD", "BTCUSD", "ETHUSD", "BNBUSD"
    ];
    // Send subscription message
    symbols.forEach(symbol => {
        ws.send(JSON.stringify({
        Action: 'Subscribe',
        Symbol: symbol
        }));
        console.log(`📨 Subscribed to ${symbol}`);
    });


    //   ws.send(JSON.stringify({ Action: 'Subscribe', Symbol: 'USDJPY' }));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            // console.log('📈 Quote update:', message);
            socket.socketEmitAll(`quote:${message.Symbol}`, message)
        } catch (err) {
            console.error('🔴 Failed to parse message:', data);
        }
    });

    ws.on('close', () => {
    console.log('🔌 WebSocket closed.');
    });

    ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    });

}

// setTimeout(quotes, 15000)