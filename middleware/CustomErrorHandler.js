class CustomErrorHandler extends Error {
    constructor(status, msg) {
        super(); 
        this.status = status;
        this.message = msg; 
    }

    static alreadyExist(message) {
        return new CustomErrorHandler(409, message);  
    }

    static wrongCredentials(message) {
        return new CustomErrorHandler(401, message);  
    }

    static lowBalance(message) {
        return new CustomErrorHandler(401, message);  
    }

    static unAuthorized(message = "UnAuthorized! Access") { 
        return new CustomErrorHandler(401, message); 
    }

    static notAllowed(message = "Not allowed!") { 
        return new CustomErrorHandler(403, message); 
    }

    static notFound(message) { 
        return new CustomErrorHandler(404, message); 
    }

    static serverError(message = "Internal server error!") {
        return new CustomErrorHandler(500, message);
    }
}

const handleErrorResponse = (e, response) => {
    // console.error(e.message);

    if (e instanceof CustomErrorHandler) {
        return response.status(e.status).json({
            status: false,
            message: e.message,
            data: null,
        });
    } else {
        console.error('Unexpected error:', e);
        return response.status(500).json({
            status: false,
            message: "Something went wrong",
            data: null,
        });
    }
};

module.exports = { CustomErrorHandler, handleErrorResponse };