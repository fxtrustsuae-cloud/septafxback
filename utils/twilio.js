const config = require("../config/config");
const client = require("twilio")(
    config.TWILIO_ACCOUNT_SID,
    config.TWILIO_AUTH_TOKEN,
);

module.exports.sendOtpOnMobile = async (mobile) => {
    try {
        await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verifications.create({ to: mobile, channel: "sms" });
        return true;
    } catch (err) {
        return false;
    }
};

module.exports.verifyMobileOtp = async(mobile, otp) => {
    try {
        const data = await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verificationChecks.create({ to: mobile, code: otp });
        
        if(!data) return false;

        if(data.valid) return true;

        return false;
    } catch(e) {
        return false;
    }
};
