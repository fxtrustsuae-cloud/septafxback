const XLSX = require('xlsx');
const { maskEmail } = require('./emailMask');

/**
 * Create an Excel file from data array with optional email masking
 * @param {Array} data - Array of objects to export
 * @param {Object} options - Export options
 * @param {Array} options.emailFields - Array of field names that contain emails to mask
 * @param {string} options.sheetName - Name of the worksheet (default: 'Sheet1')
 * @param {string} options.fileName - Name of the output file (default: 'export.xlsx')
 * @returns {Buffer} - Excel file buffer
 */
const createExcelExport = (data, options = {}) => {
    const {
        emailFields = [],
        sheetName = 'Sheet1',
        fileName = 'export.xlsx'
    } = options;

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
    }

    // Create a deep copy of data to avoid modifying original
    const exportData = JSON.parse(JSON.stringify(data));

    // Mask emails in specified fields
    if (emailFields.length > 0) {
        exportData.forEach(row => {
            emailFields.forEach(field => {
                if (row[field]) {
                    row[field] = maskEmail(row[field]);
                }
            });
        });
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return buffer;
};

/**
 * Get Excel response headers
 * @param {string} fileName - Name of the file to download
 * @returns {Object} - Response headers object
 */
const getExcelHeaders = (fileName = 'export.xlsx') => {
    return {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
    };
};

/**
 * Generate Excel file name with timestamp
 * @param {string} baseName - Base name for the file
 * @returns {string} - File name with timestamp
 */
const generateFileName = (baseName) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${baseName}_${timestamp}.xlsx`;
};

module.exports = {
    createExcelExport,
    getExcelHeaders,
    generateFileName,
    maskEmail
};

