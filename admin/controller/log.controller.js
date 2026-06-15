const fs = require('fs');
const path = require('path');
const asyncHandler = require('../../middleware/asyncHandler');
const { CustomErrorHandler } = require('../../middleware/CustomErrorHandler');

const logsDir = path.join(__dirname, '../../logs');

module.exports.listLogs = asyncHandler(async (req, res) => {
    if (!fs.existsSync(logsDir)) {
        return res.json({ status: true, message: "Logs list", data: [] });
    }

    const files = fs.readdirSync(logsDir);
    
    // Filter and sort by modified time
    const logFiles = files
        .filter(file => file.endsWith('.log') || file.endsWith('.gz'))
        .map(file => {
            const stats = fs.statSync(path.join(logsDir, file));
            return {
                filename: file,
                size: stats.size, // Size in bytes
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
            };
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt); // Latest first

    return res.json({
        status: true,
        message: "Logs retrieved successfully",
        data: logFiles
    });
});

module.exports.downloadLog = asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!filename) throw CustomErrorHandler.wrongCredentials("Filename is required!");

    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw CustomErrorHandler.notAllowed("Invalid filename");
    }

    const filePath = path.join(logsDir, filename);

    if (!fs.existsSync(filePath)) {
        throw CustomErrorHandler.notFound("Log file not found!");
    }

    // res.download automatically sets the correct headers for file download
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error("Error downloading log file:", err);
        }
    });
});

module.exports.getLogContent = asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const { search, level, limit = 1000 } = req.query;

    if (!filename) throw CustomErrorHandler.wrongCredentials("Filename is required!");
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw CustomErrorHandler.notAllowed("Invalid filename");
    }

    const filePath = path.join(logsDir, filename);
    if (!fs.existsSync(filePath)) {
        throw CustomErrorHandler.notFound("Log file not found!");
    }

    // Read file and parse lines
    // For very large files, this should be a stream, but for 20MB files (max size in logger.js), this is okay.
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    // Parse logic matching utils/logger.js format:
    // YYYY-MM-DD HH:mm:ss [LEVEL] [MODULE] [METHOD] route - message | meta
    const parsedLogs = lines.map((line, index) => {
        try {
            const regex = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s\[([^\]]+)\]\s(?:\[([^\]]+)\]\s)?(?:\[([^\]]+)\]\s)?(?:([^-]+)\s-\s)?(.*)$/;
            const match = line.match(regex);

            if (match) {
                return {
                    id: index,
                    timestamp: match[1],
                    level: match[2],
                    module: match[3] || '',
                    method: match[4] || '',
                    route: match[5] || '',
                    message: match[6],
                    raw: line
                };
            }
            return { id: index, raw: line, message: line, level: 'UNKNOWN' };
        } catch (e) {
            return { id: index, raw: line, message: line, level: 'ERROR' };
        }
    });

    // Apply filters
    let filtered = parsedLogs;
    if (level && level !== 'ALL') {
        filtered = filtered.filter(log => log.level === level.toUpperCase());
    }
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(log => log.raw.toLowerCase().includes(searchLower));
    }

    // Return latest first
    const result = filtered.reverse().slice(0, parseInt(limit));

    return res.json({
        status: true,
        message: "Logs content retrieved successfully",
        data: result
    });
});
