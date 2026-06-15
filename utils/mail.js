const nodemailer = require("nodemailer");
const config = require("../config/config");

// Company configuration from .env
const companyName = config.COMPANY_NAME || 'Vinnexia Capital';
const supportEmail = config.SUPPORT_EMAIL || 'support@vinnexiacapital.com';
const supportMail = config.SUPPORTMAIL || supportEmail;
const copyrightName = config.COPYRIGHT_NAME || companyName;
const dashboardLink = config.DASHBOARD_LINK || 'http://user.vinnexiacapital.com';
const companyAddress = config.COMPANY_ADDRESS || 'Premier Business Center, 10th Floor, Sterling Tower, 14 Poudrière St Port Louis Mauritius.';
const companyLogo = config.COMPANY_LOGO || 'https://ik.imagekit.io/emmufi2tro/Frame%208%20(2).png?updatedAt=1768399256883';

// Default color scheme
const defaultColors = {
    primary: config.EMAIL_PRIMARY_COLOR || '#0066cc',
    primaryDark: config.EMAIL_PRIMARY_DARK_COLOR || '#003366',
    textColor: config.EMAIL_TEXT_COLOR || '#020c1a',
    onPrimary: config.EMAIL_ON_PRIMARY_COLOR || '#ffffff',
    footerColor: config.EMAIL_FOOTER_COLOR || '#eff6ff',
    depositColor: config.EMAIL_DEPOSIT_COLOR || '#28a745',
    withdrawalColor: config.EMAIL_WITHDRAWAL_COLOR || '#dc3545'
};

// Theme presets
const themes = {
    blue: defaultColors,
    purple: { primary: '#7c3aed', primaryDark: '#5b21b6', textColor: '#0b1020', onPrimary: '#ffffff', footerColor: '#f5f3ff', depositColor: '#a78bfa', withdrawalColor: '#f59e0b' },
    sunset: { primary: '#f97316', primaryDark: '#ea580c', textColor: '#111827', onPrimary: '#ffffff', footerColor: '#fff7ed', depositColor: '#22c55e', withdrawalColor: '#ef4444' },
    dark: { primary: '#0ea5e9', primaryDark: '#0369a1', textColor: '#e5e7eb', onPrimary: '#0b1220', footerColor: '#0b1220', depositColor: '#22c55e', withdrawalColor: '#f43f5e' },
};

const resolveTheme = (input) => {
    if (!input) return { ...defaultColors };
    if (typeof input === 'string') {
        const key = input.toLowerCase();
        return themes[key] ? { ...themes[key] } : { ...defaultColors };
    }
    if (typeof input === 'object') {
        return { ...defaultColors, ...input };
    }
    return { ...defaultColors };
};

// Global Styles
const getGlobalEmailStyles = (themeColors) => `
  body, table, td, a, p, span, div { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  body { margin: 0; padding: 0; background-color: #f1f3f9; -webkit-font-smoothing: antialiased; }
  .bg-page { background: #f1f3f9; }
  .panel { background: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); overflow: hidden; max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.primaryDark} 100%); padding: 40px 30px; text-align: center; position: relative; }
  .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23ffffff" fill-opacity="0.1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>') bottom center no-repeat; background-size: cover; opacity: 0.3; }
  .logo-container img { height: 40px; }
  .success-icon { display: none; }
  .header-title { font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; z-index: 1; position: relative; }
  .header-subtitle { font-size: 16px; color: #e2f4f1; margin: 0; z-index: 1; position: relative; }
  .content { padding: 36px 40px; color: ${themeColors.textColor}; }
  .greeting { font-size: 18px; font-weight: 600; margin: 0 0 16px 0; }
  .message { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 28px 0; }
  .details-card { background: linear-gradient(135deg, #f6f8fc 0%, #ffffff 100%); border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 28px 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
  .details-title { font-size: 16px; font-weight: 700; color: ${themeColors.primary}; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid ${themeColors.primaryDark}; display: flex; align-items: center; }
  .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f3f9; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { font-size: 14px; color: #6b7280; font-weight: 500; flex: 0 0 auto; margin-right: 20px; }
  .detail-value { font-size: 14px; color: ${themeColors.textColor}; font-weight: 600; text-align: right; flex: 1 1 auto; word-break: break-word; }
  .amount-highlight { background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.primaryDark} 100%); color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 16px; }
  .info-box { background: #dbeafe; border-left: 4px solid ${themeColors.primaryDark}; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
  .info-box p { margin: 0; font-size: 14px; line-height: 1.6; color: ${themeColors.primary}; }
  .cta-button { display: inline-block; background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.primaryDark} 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
  .otp-code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${themeColors.primary}; background: #f8fafc; padding: 16px; border-radius: 12px; text-align: center; margin: 24px 0; border: 2px dashed ${themeColors.primary}; }
  .footer { padding: 24px 40px; background: ${themeColors.footerColor}; text-align: center; }
  .footer-text { font-size: 13px; color: #6b7280; margin: 0 0 8px 0; line-height: 1.5; }
  .footer-link { color: ${themeColors.primary}; text-decoration: none; font-weight: 500; }
  .divider { height: 1px; background: linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%); margin: 24px 0; }
  @media (max-width: 600px) {
    .content { padding: 24px 20px !important; }
    .header { padding: 32px 20px !important; }
    .detail-row { flex-direction: column; gap: 4px; }
    .detail-value { text-align: left !important; }
  }
`;

// Common Templates
const getEmailHeader = (title, subtitle) => `
  <div class="logo-container"><img src="${companyLogo}" alt="${companyName}" /></div>
  <h1 class="header-title" style="margin-top: 24px;">${title}</h1>
  <p class="header-subtitle">${subtitle}</p>
`;


const getEmailSignoff = (themeColors) => `
  <div class="divider"></div>
  <p class="message">We wish you a successful trading journey.</p>
  <p class="message">If you need assistance, our team is here:<br><a href="mailto:${supportMail}" style="color:${themeColors.primary};">${supportMail}</a></p>
  <p class="message">Best Regards,<br><strong>${companyName} Team</strong></p>
  <p class="message" style="font-size:13px;color:#6b7280;">This is an automated email. Please do not reply to this message.</p>
  <p class="message" style="font-size:12px;color:#9ca3af;">&copy; ${copyrightName} All rights reserved.</p>
`;

// SVG Icons (inline, email-safe with proper encoding)
const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" style="display:block;margin:0 auto;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lock: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" style="display:block;margin:0 auto;"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

let sharedTransporter = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableSmtpError = (err) => {
  const responseCode = Number(err?.responseCode);
  const errorText = `${err?.response || ""} ${err?.message || ""}`.toLowerCase();

  if ([421, 429, 450, 451, 452, 454].includes(responseCode)) return true;

  return (
    errorText.includes("too much mail") ||
    errorText.includes("too many auth") ||
    errorText.includes("rate") ||
    errorText.includes("thrott") ||
    errorText.includes("tempor") ||
    errorText.includes("try again")
  );
};

const sendWithRetry = async (transporter, mailOptions) => {
  const maxAttempts = Math.max(1, Number(config.SMTP_RETRY_ATTEMPTS || 4));
  const baseDelayMs = Math.max(250, Number(config.SMTP_RETRY_BASE_DELAY_MS || 1500));
  const maxDelayMs = Math.max(baseDelayMs, Number(config.SMTP_RETRY_MAX_DELAY_MS || 20000));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      const shouldRetry = isRetryableSmtpError(err) && attempt < maxAttempts;
      if (!shouldRetry) throw err;

      const jitterMs = Math.floor(Math.random() * 500);
      const delayMs = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1))) + jitterMs;

      console.warn(
        `SMTP retry ${attempt}/${maxAttempts - 1} for ${mailOptions.to} after ${delayMs}ms due to: ${err?.message || err}`
      );

      await sleep(delayMs);
    }
  }
};

// Create transporter (reuse in all functions)
const createTransporter = () => {
  if (sharedTransporter) return sharedTransporter;

  sharedTransporter = nodemailer.createTransport({
    host: config.HOST,
    port: 465,
    secure: true,
    pool: true,
  maxConnections: Number(config.SMTP_MAX_CONNECTIONS || 2),
  maxMessages: Number(config.SMTP_MAX_MESSAGES || 50),
  rateDelta: Number(config.SMTP_RATE_DELTA_MS || 1000),
  rateLimit: Number(config.SMTP_RATE_LIMIT || 2),
    auth: {
      user: config.HOSTMAIL,
      pass: config.MAIL_PASSWORD,
    },
  });

  return sharedTransporter;
};

// 1. WELCOME EMAIL
const sendWelcomeEmail = async (email, name, userName, password, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader(`Welcome ${name}!`, 'Your account is ready')}</td></tr>
          <tr><td class="content">
            <p class="greeting">Hello ${name},</p>
            <p class="message">Welcome to <strong>${companyName}</strong>! Your client portal is now active.</p>
            <div class="details-card">
              <div class="details-title">Your Login Details</div>
              <div class="detail-row">
                <span class="detail-label">Username</span>
                <span class="detail-value">${userName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Password</span>
                <span class="detail-value">${password}</span>
              </div>
            </div>
            <div class="info-box"><p>Change your password immediately after first login for security.</p></div>
            <center><a href="${dashboardLink}" class="cta-button">Login Now</a></center>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: `Welcome to ${companyName} - Your Account is Ready`,
            html,
        });

        console.log("Welcome email sent to:", email);
        return true;
    } catch (err) {
        console.error("Welcome email error:", err);
        return false;
    }
};

// 2. OTP EMAIL (THIS WAS THE BROKEN ONE)
const sendOtpEmail = async (email, userName, otp, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader('Verify Your Email', 'One-Time Password (OTP)')}</td></tr>
          <tr><td class="content">
            <p class="greeting">Hello ${userName},</p>
            <p class="message">Use the code below to complete your verification. It expires in 10 minutes.</p>
            <div class="otp-code">${otp}</div>
            <p class="message">If you didn't request this, please ignore this email.</p>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: `Your OTP Code: ${otp}`,
            html,
        });

        console.log("OTP email sent to:", email);
        return true;
    } catch (err) {
        console.error("OTP email error:", err);
        return false;
    }
};

// 3. ACCOUNT ACTIVATION EMAIL
const sendAccountActivationEmail = async (email, name, accountCurrency, accountNumber, mainPassword, investorPassword, tradingPlatform, serverName, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader('Account Activated', 'Your trading account is ready')}</td></tr>
          <tr><td class="content">
            <p class="greeting">Dear ${name},</p>
            <p class="message">Your live trading account has been successfully activated and is ready for use.</p>
            <div class="details-card">
              <div class="details-title">Account Details</div>
              <div class="detail-row"><span class="detail-label">Currency</span><span class="detail-value">${accountCurrency}</span></div>
              <div class="detail-row"><span class="detail-label">Account Number</span><span class="detail-value">${accountNumber}</span></div>
              <div class="detail-row"><span class="detail-label">Main Password</span><span class="detail-value">${mainPassword}</span></div>
              <div class="detail-row"><span class="detail-label">Investor Password</span><span class="detail-value">${investorPassword}</span></div>
              <div class="detail-row"><span class="detail-label">Platform</span><span class="detail-value">${tradingPlatform}</span></div>
              <div class="detail-row"><span class="detail-label">Server</span><span class="detail-value">${serverName}</span></div>
            </div>
            <center><a href="${dashboardLink}" class="cta-button">Access Platform</a></center>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: "Your Trading Account Activation Details",
            html,
        });

        console.log("Account activation email sent to:", email);
        return true;
    } catch (err) {
        console.error("Account activation email error:", err);
        return false;
    }
};

// 4. TRANSACTION ALERT EMAIL
const sendTransactionAlertEmail = async (email, username, transactionType, amount, transactionId, dateTime, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader('Transaction Alert', `${transactionType} processed`)}</td></tr>
          <tr><td class="content">
            <p class="greeting">Hello ${username},</p>
            <p class="message">Your ${transactionType.toLowerCase()} transaction has been processed successfully.</p>
            <div class="details-card">
              <div class="details-title">Transaction Details</div>
              <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${transactionType}</span></div>
              <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value amount-highlight">${amount}</span></div>
              <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${transactionId}</span></div>
              <div class="detail-row"><span class="detail-label">Date & Time</span><span class="detail-value">${dateTime}</span></div>
            </div>
            <center><a href="${dashboardLink}" class="cta-button">View Account</a></center>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: `Transaction Alert - ${transactionType}`,
            html,
        });

        console.log("Transaction alert email sent to:", email);
        return true;
    } catch (err) {
        console.error("Transaction alert email error:", err);
        return false;
    }
};

// 4b. PENDING TRANSACTION ALERT EMAIL (deposit/withdrawal received, awaiting approval)
const sendPendingTransactionAlertEmail = async (email, username, transactionType, amount, transactionId, dateTime, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader('Transaction Received', `${transactionType} is being processed`)}</td></tr>
          <tr><td class="content">
            <p class="greeting">Hello ${username},</p>
            <p class="message">We have received your ${transactionType.toLowerCase()} request. It is currently being reviewed and will be processed shortly.</p>
            <div class="details-card">
              <div class="details-title">Transaction Details</div>
              <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${transactionType}</span></div>
              <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value amount-highlight">${amount}</span></div>
              <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${transactionId}</span></div>
              <div class="detail-row"><span class="detail-label">Date & Time</span><span class="detail-value">${dateTime}</span></div>
              <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">Processing</span></div>
            </div>
            <div class="info-box"><p>You will be notified once your transaction has been approved. This may take 1-3 business days.</p></div>
            <center><a href="${dashboardLink}" class="cta-button">View Account</a></center>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: `Transaction Received - ${transactionType} Processing`,
            html,
        });

        console.log("Pending transaction alert email sent to:", email);
        return true;
    } catch (err) {
        console.error("Pending transaction alert email error:", err);
        return false;
    }
};

// 5. MT5 WELCOME EMAIL
const sendMt5WelcomeEmail = async (email, name, accountNumber, mainPassword, investorPassword, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
        <tr><td align="center"><table class="panel">
          <tr><td class="header">${getEmailHeader('MT5 Account Ready', 'Your MetaTrader 5 account is activated')}</td></tr>
          <tr><td class="content">
            <p class="greeting">Dear ${name},</p>
            <p class="message">Your MetaTrader 5 trading account has been successfully created and activated.</p>
            <div class="details-card">
              <div class="details-title">MT5 Account Details</div>
              <div class="detail-row"><span class="detail-label">Account Number</span><span class="detail-value">${accountNumber}</span></div>
              <div class="detail-row"><span class="detail-label">Main Password</span><span class="detail-value">${mainPassword}</span></div>
              <div class="detail-row"><span class="detail-label">Investor Password</span><span class="detail-value">${investorPassword}</span></div>
              <div class="detail-row"><span class="detail-label">Currency</span><span class="detail-value">USD</span></div>
            </div>
            <center><a href="${dashboardLink}" class="cta-button">Download MT5</a></center>
            ${getEmailSignoff(theme)}
          </td></tr>
        </table></td></tr>
      </table>
    </body></html>`;

        await transporter.sendMail({
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            bcc: config.BCC_MAIL,
            subject: "Your Trading Account Activation Details",
            html,
        });

        console.log("MT5 welcome email sent to:", email);
        return true;
    } catch (err) {
        console.error("MT5 welcome email error:", err);
        return false;
    }
};

// HELPER FUNCTIONS FOR MAIL TEMPLATES

// MT5 Created Mail Template
const mt5CreatedMail = (data, colors = {}) => {
    const theme = resolveTheme(colors);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
      <tr><td align="center"><table class="panel">
        <tr><td class="header">${getEmailHeader('Account Activated', 'Your MT5 trading account is ready')}</td></tr>
        <tr><td class="content">
          <p class="greeting">Dear ${data.name},</p>
          <p class="message">Your live trading account with ${companyName} has been successfully activated.</p>
          <div class="details-card">
            <div class="details-title">Account Details</div>
            <div class="detail-row"><span class="detail-label">Currency</span><span class="detail-value">USD</span></div>
            <div class="detail-row"><span class="detail-label">Account Number</span><span class="detail-value">${data.login}</span></div>
            <div class="detail-row"><span class="detail-label">Main Password</span><span class="detail-value">${data.mainPassword}</span></div>
            <div class="detail-row"><span class="detail-label">Investor Password</span><span class="detail-value">${data.investorPassword}</span></div>
            <div class="detail-row"><span class="detail-label">Platform</span><span class="detail-value">MT-5</span></div>
            <div class="detail-row"><span class="detail-label">Server</span><span class="detail-value">${config.SERVER || 'Vinnexia-server'}</span></div>
          </div>
          <div class="info-box"><p>Treat your login credentials with utmost confidentiality. Never share passwords or allow third-party access to your account.</p></div>
          <center><a href="${dashboardLink}" class="cta-button">Access Platform</a></center>
          ${getEmailSignoff(theme)}
        </td></tr>
      </table></td></tr>
    </table>
  </body></html>`;
};

// Deposit Mail Template
const deposit = (data, colors = {}) => {
    const theme = resolveTheme(colors);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
      <tr><td align="center"><table class="panel">
        <tr><td class="header">${getEmailHeader('Deposit Successful', 'Your funds have been credited')}</td></tr>
        <tr><td class="content">
          <p class="greeting">Dear ${data.name},</p>
          <p class="message">Your deposit has been successfully processed and credited to your account.</p>
          <div class="details-card">
            <div class="details-title">Transaction Details</div>
            <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value">${data.userName}</span></div>
            <div class="detail-row"><span class="detail-label">Deposit Amount</span><span class="detail-value amount-highlight">$${data.amount}</span></div>
            <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${data.transactionId || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Date & Time</span><span class="detail-value">${new Date().toLocaleString()}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">Completed</span></div>
          </div>
          <center><a href="${dashboardLink}" class="cta-button">View Account</a></center>
          ${getEmailSignoff(theme)}
        </td></tr>
      </table></td></tr>
    </table>
  </body></html>`;
};

// Withdraw Mail Template
const withdraw = (data, colors = {}) => {
    const theme = resolveTheme(colors);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
      <tr><td align="center"><table class="panel">
        <tr><td class="header">${getEmailHeader('Withdrawal Processed', 'Your withdrawal request has been completed')}</td></tr>
        <tr><td class="content">
          <p class="greeting">Dear ${data.name},</p>
          <p class="message">Your withdrawal request has been successfully processed.</p>
          <div class="details-card">
            <div class="details-title">Withdrawal Details</div>
            <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value">${data.userName}</span></div>
            <div class="detail-row"><span class="detail-label">Withdraw Amount</span><span class="detail-value amount-highlight">$${data.amount}</span></div>
            <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${data.transactionId || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Date & Time</span><span class="detail-value">${new Date().toLocaleString()}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">Completed</span></div>
          </div>
          <div class="info-box"><p>Funds will be transferred to your registered account within 1-3 business days.</p></div>
          <center><a href="${dashboardLink}" class="cta-button">View Account</a></center>
          ${getEmailSignoff(theme)}
        </td></tr>
      </table></td></tr>
    </table>
  </body></html>`;
};

// Login Password Changed Template
const loginPasswordChanged = (data, colors = {}) => {
    const theme = resolveTheme(colors);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
      <tr><td align="center"><table class="panel">
        <tr><td class="header">${getEmailHeader('Your Portal Credentials', 'Access details for your account')}</td></tr>
        <tr><td class="content">
          <p class="greeting">Dear ${data.name},</p>
          <p class="message">Below are your portal login credentials. Please keep them safe and do not share with anyone.</p>
          <div class="details-card">
            <div class="details-title">Portal Login Details</div>
            <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value">${data.userName}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${data.email}</span></div>
            <div class="detail-row"><span class="detail-label">New Login Password</span><span class="detail-value">${data.password}</span></div>
           <div class="detail-row"><span class="detail-label">Generated On</span><span class="detail-value">${new Date().toLocaleString()}</span></div>
          </div>
          <div class="info-box">
            <p><strong>Note:</strong> For your security, please update your password after your first login.</p>
          </div>
          <center><a href="${dashboardLink}" class="cta-button">Login to Account</a></center>
          ${getEmailSignoff(theme)}
        </td></tr>
      </table></td></tr>
    </table>
  </body></html>`;
};

// Meta Password Changed Template
const metaPasswordChanged = (data, colors = {}) => {
    const theme = resolveTheme(colors);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
      <tr><td align="center"><table class="panel">
        <tr><td class="header">${getEmailHeader('Your MT5 Credentials', 'Access details for your MT5 trading account')}</td></tr>
        <tr><td class="content">
          <p class="greeting">Dear ${data.name},</p>
          <p class="message">Below are your MetaTrader 5 account credentials. Please keep them confidential and do not share with anyone.</p>
          <div class="details-card">
            <div class="details-title">Updated MT5 Credentials</div>
            <div class="detail-row"><span class="detail-label">Login</span><span class="detail-value">${data.login}</span></div>
            <div class="detail-row"><span class="detail-label">Main Password</span><span class="detail-value">${data.mainPassword}</span></div>
            <div class="detail-row"><span class="detail-label">Investor Password</span><span class="detail-value">${data.investorPassword}</span></div>
            <div class="detail-row"><span class="detail-label">Changed On</span><span class="detail-value">${new Date().toLocaleString()}</span></div>
          </div>
          <div class="info-box">
            <p><strong>Note:</strong> For better security, we recommend updating your password after your first login.</p>
          </div>
          <center><a href="${dashboardLink}" class="cta-button">Access MT5</a></center>
          ${getEmailSignoff(theme)}
        </td></tr>
      </table></td></tr>
    </table>
  </body></html>`;
};

// Create Mail Template Helper
const createMailTemplate = async (mailType, data, colors = {}) => {

    if (mailType === "MT5CREATED") {
        return {
            mail: mt5CreatedMail(data, colors),
            subject: "MT5 Account Created"
        };
    }

    if (mailType === "DEPOSIT") {
        return {
            mail: deposit(data, colors),
            subject: "Deposit Confirmation"
        };
    }

    if (mailType === "WITHDRAW") {
        return {
            mail: withdraw(data, colors),
            subject: "Withdrawal Confirmation"
        };
    }

    if (mailType === "LOGIN-PASSWROD-CHANGED") {
        return {
            mail: loginPasswordChanged(data, colors),
            subject: "Portal Credentials"
        };
    }

    if (mailType === "META-RECENT-PASSWROD-CHANGED") {
        return {
            mail: metaPasswordChanged(data, colors),
            subject: "MT5 Credentials"
        };
    }

    return null;
};

// 6. GENERAL SEND MAIL FUNCTION (Updated with template support)
const sendMail = async (email, mailType, data, subject, mailContent, colors = {}) => {
    try {
        const theme = resolveTheme(colors);
        const transporter = createTransporter();

        let html = mailContent;
        let emailSubject = subject;
    let isTemplateApplied = false;

        // Check if using predefined mail type
        if (mailType && data) {
            const template = await createMailTemplate(mailType, data, theme);
            if (template) {
                html = template.mail;
                emailSubject = template.subject;
        isTemplateApplied = true;
            }
        }

    // If plain text/no content and no predefined template, use default modern template
    const isCustomHtml = typeof mailContent === 'string' && /<[^>]+>/.test(mailContent);
    if (!isTemplateApplied && (!html || !isCustomHtml)) {
            html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getGlobalEmailStyles(theme)}</style></head><body>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="padding:40px 0;">
          <tr><td align="center"><table class="panel">
            <tr><td class="header">${getEmailHeader(emailSubject || 'Notification', 'Important update from your account')}</td></tr>
            <tr><td class="content">
              <p class="greeting">Dear Valued Client,</p>
              <div class="message">${mailContent || 'We have an important update regarding your account.'}</div>
              <center><a href="${dashboardLink}" class="cta-button">View Dashboard</a></center>
              ${getEmailSignoff(theme)}
            </td></tr>
            </table></td></tr>
        </table>
      </body></html>`;
        }

        const mailOptions = {
            from: `${companyName} <${config.HOSTMAIL}>`,
            to: email,
            subject: emailSubject || 'Notification from ' + companyName,
            html,
        };

        // Only add BCC if it's configured and valid
        if (config.BCC_MAIL && config.BCC_MAIL.includes('@')) {
            mailOptions.bcc = config.BCC_MAIL;
        }

        await sendWithRetry(transporter, mailOptions);

        console.log("Email sent by admin to:", email);
        return true;
    } catch (err) {
        console.error("Admin email error:", err);
        return false;
    }
};

// EXPORT ALL FUNCTIONS
module.exports = {
    sendWelcomeEmail,
    sendAccountActivationEmail,
    sendOtpEmail,
    sendTransactionAlertEmail,
    sendPendingTransactionAlertEmail,
    sendMt5WelcomeEmail,
    sendMail,
};