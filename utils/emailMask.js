/**
 * Utility function to mask email addresses
 * Example: "john.doe@example.com" -> "j***n@example.com"
 * @param {string} email - The email address to mask
 * @returns {string} - Masked email address
 */
const maskEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return email;
    }

    const [localPart, domain] = email.split('@');
    
    if (!localPart || !domain) {
        return email;
    }

    // Mask the local part (before @)
    // Keep first and last character, mask the middle
    let maskedLocalPart;
    if (localPart.length <= 2) {
        // If local part is very short, mask all but first character
        maskedLocalPart = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 1, 1));
    } else {
        maskedLocalPart = localPart.charAt(0) + '*'.repeat(Math.min(localPart.length - 2, 5)) + localPart.charAt(localPart.length - 1);
    }

    return `${maskedLocalPart}@${domain}`;
};

module.exports = { maskEmail };

