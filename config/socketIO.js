const { Server } = require('socket.io');
const config = require("../config/config");
const UserModel = require("../models/users.model");
const Mt5AccModel = require("../models/mt5Account.model");
const positionController = require("../mt5Services/position");
const { wsVerifyJWTToken } = require("../middleware/jwt.middleware");
const tradeController = require("../user/controller/trade.controller");
const paymentController = require("../user/controller/payment.controller");
const { userLogger } = require("../utils/logger");
const marginIntervals = new Map();
const socketLoginMap = new Map(); 

let socketIO = '';

const createSocketIO = (server) => {
    socketIO = new Server(server, {
        pingTimeout: 60000,
        cors: {
            origin: "*"
        }
    });

    socketIO.on('connection', async (socket) => {
        console.log('New client connected:', socket.id);
        const token = socket.handshake.auth?.authorization
            || socket.handshake.auth?.token
            || socket.handshake.headers.authorization;
    
        const authResult = await wsVerifyJWTToken(token);
        
        if (!authResult.status) {
            console.log('Unauthorized socket connection:', authResult.message);
            socket.disconnect(true);
            return;
        }
    
        const userData = authResult.data;

        if (["ADMIN", "SUPER-ADMIN"].includes(userData.role)) {
            socket.join("admins");
        }

        socket.on('startPayment', async (data) => {
            userLogger.info(`Payment request received from ${socket.id}`, { data });
            const allowedNetworks = ["TRON", "BINANCE", "TRC20", "BEP20", "ERC20", "BITCOIN", "BTC"];
            const requestedNetwork = String(data.network || "").toUpperCase();

            if (!allowedNetworks.includes(requestedNetwork)) {
                socket.emit('paymentError', { message: "Unsupported payment network." }, () => {
                    socket.disconnect(true);
                });
                return;
            }

            try {
                const updatedUserData = await UserModel.findByPk(userData.id);
                if(updatedUserData.isDeleted == true || updatedUserData.isDepositeAllowed == true) {
                    socket.disconnect(true);
                    return;
                }
                const result = await paymentController.createPaymentOrder(socket.id, userData.id, data.amount, data.network)

                data = result.data;
                const savedPayment = await paymentController.savePyamentDetails(userData.id, socket.id, data);
                if (savedPayment === false) {
                    throw new Error("Payment invoice was created but could not be saved.");
                }

                socket.emit('paymentReady', {
                    data
                });
            } catch (e){
                userLogger.error("Socket startPayment Error:", { message: e.message, stack: e.stack });
                socket.emit('paymentError', { message: e.message || "Payment initiation failed." }, () => {
                    socket.disconnect(true);
                });
                setTimeout(() => {
                    if (socket.connected) socket.disconnect(true);
                }, 500);
            }
        });

        socket.on('cardPayment', async (data) => {
            console.log(`Card Payment request received from`, socket.id);
            try {
                const checkUser = await UserModel.findByPk(userData.id);
                if(!checkUser) socket.disconnect(true);
                if(data.amount > config.MIN_DEPOSIT) socket.disconnect(true);
                const result = await paymentController.depositWithCard(socket.id, data.amount, checkUser, data.login);
                if(!result) socket.disconnect(true);
                socket.emit('cardPaymentReady', {
                    result
                });
            } catch (e){
                console.log("Failed to Initiate Payment!");
            }
        });

        socket.on('checkMargin', async (data) => {
            console.log(`Started margin updates for`, socket.id);
        
            const mt5Data = await Mt5AccModel.findOne({
                where: { 
                    userId: userData.id, 
                    Login: `${data.login}`
                }
            }); if(!mt5Data) socket.disconnect(true);
            
            // Prevent starting multiple intervals
            if (marginIntervals.has(socket.id)) return;
        
            // Save login per socket
            socketLoginMap.set(socket.id, data.login);
        
            const login = socketLoginMap.get(socket.id);
        
                const marginData = await tradeController.checkMargin(login);
                if (marginData) {
                    socketEmitOne("checkMargin", marginData, socket.id);
                } else {
                    socketEmitOne("checkMargin", {marginData}, socket.id);
                }
            const intervalId = setInterval(async () => {
                const login = socketLoginMap.get(socket.id);
        
                const marginData = await tradeController.checkMargin(login);
                if (marginData) {
                    socketEmitOne("checkMargin", marginData, socket.id);
                } else {
                    socketEmitOne("checkMargin", {marginData}, socket.id);
                }
            }, 5000);
        
            marginIntervals.set(socket.id, intervalId);
        });

        socket.on('adminCheckMargin', async (data) => {
            console.log(`Started margin updates for`, socket.id);
        
            const mt5Data = await Mt5AccModel.findOne({
                where: {
                    Login: `${data.login}`
                }
            }); if(!mt5Data) socket.disconnect(true);
            
            // Prevent starting multiple intervals
            if (marginIntervals.has(socket.id)) return;
        
            // Save login per socket
            socketLoginMap.set(socket.id, data.login);
        
            const login = socketLoginMap.get(socket.id);
        
                const marginData = await tradeController.checkMargin(login);
                if (marginData) {
                    socketEmitOne("adminCheckMargin", marginData, socket.id);
                } else {
                    socketEmitOne("adminCheckMargin", {marginData}, socket.id);
                }
            const intervalId = setInterval(async () => {
                const login = socketLoginMap.get(socket.id);
        
                const marginData = await tradeController.checkMargin(login);
                if (marginData) {
                    socketEmitOne("adminCheckMargin", marginData, socket.id);
                } else {
                    socketEmitOne("adminCheckMargin", {marginData}, socket.id);
                }
            }, 5000);
        
            marginIntervals.set(socket.id, intervalId);
        });

        socket.on('checkPosition', async (data) => {
            console.log(`Started margin updates for`, socket.id);

            if(userData.role != "ADMIN") socket.disconnect(true);
            
            if (marginIntervals.has(socket.id)) return;

            socketLoginMap.set(socket.id, data.login);
            const login = socketLoginMap.get(socket.id);
                const positionList = await positionController.getPositionList(login, 0, 10);
                if (positionList) {
                    socketEmitOne("checkPosition", positionList.answer, socket.id);
                } else {
                    socketEmitOne("checkPosition", {positionList}, socket.id);
                }
            const intervalId = setInterval(async () => {
                const login = socketLoginMap.get(socket.id);
                const positionList = await positionController.getPositionList(login, 0, 10);
                if (positionList) {
                    socketEmitOne("checkPosition", positionList.answer, socket.id);
                } else {
                    socketEmitOne("checkPosition", {positionList}, socket.id);
                }
            }, 5000);
        
            marginIntervals.set(socket.id, intervalId);
        });

        socket.on('checkPositionUser', async (data) => {
            console.log(`Started margin updates for user`, socket.id);

            const mt5Data = await Mt5AccModel.findOne({
                where: { 
                    userId: userData.id, 
                    Login: `${data.login}`
                }
            }); if(!mt5Data) socket.disconnect(true);

            if (marginIntervals.has(socket.id)) return;

            socketLoginMap.set(socket.id, data.login);
            const login = socketLoginMap.get(socket.id);
                const positionList = await positionController.getPositionList(login, 0, 10);
                if (positionList) {
                    socketEmitOne("checkPositionUser", positionList.answer, socket.id);
                } else {
                    socketEmitOne("checkPositionUser", {positionList}, socket.id);
                }
            const intervalId = setInterval(async () => {
                const login = socketLoginMap.get(socket.id);
                const positionList = await positionController.getPositionList(login, 0, 10);
                if (positionList) {
                    socketEmitOne("checkPositionUser", positionList.answer, socket.id);
                } else {
                    socketEmitOne("checkPositionUser", {positionList}, socket.id);
                }
            }, 5000);
        
            marginIntervals.set(socket.id, intervalId);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);

            if (marginIntervals.has(socket.id)) {
                clearInterval(marginIntervals.get(socket.id));
                marginIntervals.delete(socket.id);
            }
        });
    });
    
};

const socketEmitAll = (event, data) => {
    try {
        socketIO.emit(event, data);
    } catch (err) {
        console.error('EmitAll Error:', err);
    }
};

const socketEmitOne = (event, data, socketId) => {
    try {
        socketIO.to(socketId.toString()).emit(event, data);
    } catch (err) {
        console.error('EmitOne Error:', err);
    }
};

const socketEmitRoom = (event, data, room) => {
    try {
        socketIO.to(room).emit(event, data);
    } catch (err) {
        console.error('EmitRoom Error:', err);
    }
};

module.exports = {
    createSocketIO,
    socketEmitAll,
    socketEmitOne,
    socketEmitRoom
};
