const axios = require("axios");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const socket = require("../../config/socketIO");
const PriceController = require("../../mt5Services/price");
const Symbols = require('../../config/ibPlan.json');
const { userLogger } = require("../../utils/logger");

module.exports.echonomicsCalander = async (request, response) => {
    try {
        userLogger.info('Entering echonomicsCalander', { method: request.method || "", route: request.originalUrl || "" });
        const config = {
            method: 'get',
            url: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
            headers: { 
                'Accept': 'application/json'
            }
        };
    
        const data = await axios.request(config);

        userLogger.info('Exiting echonomicsCalander: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Economic calandar.",
            data: data.data
        });
    } catch (error) {
        userLogger.error('Error in echonomicsCalander', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
        console.error("Error fetching economic calendar:", error);
        return handleErrorResponse(error, res);
    }
};

async function fetchPrice(symbols) {
    try {
        const priceData = await PriceController.quotes(symbols);
        if (priceData && Array.isArray(priceData.answer) && priceData.answer.length > 0) {
            socket.socketEmitAll("quotes", priceData.answer);
        }
    } catch (error) {
        console.error("Error fetching price:", error);
    }
}

setTimeout(async () => {
    try {
        const fx = Symbols.cfdFx;
        const metal = Symbols.cfdMetals;
        const symbolList = [...fx, ...metal];
        setInterval(() => {
            fetchPrice(symbolList);
        }, 3000);
        console.log("Quotes Started.")
    } catch (error) {
        console.error("Error getting symbol list:", error);
    }
}, 2000);


async function brodcastSymbolChart(symbol) {
    try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 3600; // last 1 hour only
        const chartData = await PriceController.symbolChart(symbol, from, to);
        if (chartData && Array.isArray(chartData.answer) && chartData.answer.length > 0) {
            socket.socketEmitAll("symbolChart", chartData.answer);
        }
    } catch (error) {
        console.error("Error fetching symbolChart:", error);
    }
}

setTimeout(async () => {
    try {
        setInterval(() => {
            brodcastSymbolChart("XAUUSD");
        }, 10000);
    } catch (error) {
        console.error("Error getting symbol Chart:", error);
    }
}, 2000);

module.exports.getSymbolChart = async (request, response) => {
    try {
        userLogger.info('Entering getSymbolChart', { method: request.method || "", route: request.originalUrl || "" });
        const { symbol, from, to, period } = request.query;

        const fromTs = from ? parseInt(from, 10) : Math.floor(Date.now() / 1000) - (24 * 60 * 60);
        const toTs = to ? parseInt(to, 10) : Math.floor(Date.now() / 1000);

        const chartData = await PriceController.symbolChart(symbol, fromTs, toTs, period ? parseInt(period, 10) : 5);
        if (!chartData) throw new Error(`Failed to fetch chart for ${symbol}`);

        userLogger.info('Exiting getSymbolChart: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Symbol chart data.",
            data: chartData.answer,
        });
    } catch (error) {
        userLogger.error('Error in getSymbolChart', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
        return response.status(500).json({ status: false, message: error.message });
    }
};

module.exports.getSymbolPrice = async (request, response) => {
    try {
        userLogger.info('Entering getSymbolPrice', { method: request.method || "", route: request.originalUrl || "" });
        const { symbol } = request.query;

        const priceData = await PriceController.quotes(symbol);
        if (!priceData) throw new Error(`Failed to fetch price for ${symbol}`);

        userLogger.info('Exiting getSymbolPrice: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Symbol price.",
            data: priceData.answer,
        });
    } catch (error) {
        userLogger.error('Error in getSymbolPrice', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
        return response.status(500).json({ status: false, message: error.message });
    }
};
