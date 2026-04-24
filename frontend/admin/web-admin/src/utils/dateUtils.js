/**
 * Utility for standardized date and time formatting
 * Philippine Standard Time (UTC+8 / Asia/Manila)
 */

export const formatPST = (date) => {
    if (!date) return "—";
    const d = typeof date === 'string' ? new Date(date) : date;

    // Check for invalid date
    if (isNaN(d.getTime())) return "—";

    const options = {
        timeZone: 'Asia/Manila',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    // Use en-US or en-GB as base and manually assemble for precision
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(d);

    const getPart = (type) => parts.find(p => p.type === type)?.value || "";

    const weekday = getPart('weekday');
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');
    const dayPeriod = getPart('dayPeriod');

    // Format: Thursday, 23 April 2026 • 6:18:09 PM
    return `${weekday}, ${day} ${month} ${year} • ${hour}:${minute}:${second} ${dayPeriod}`;
};

/**
 * Logic for system status based on connected devices
 * Connected devices >= 1 -> Online
 * Connected devices = 0 -> Offline
 */
export const getSystemStatus = (onlineCount, totalCount = 0) => {
    return `${onlineCount}/${totalCount} Live`;
};

export const getSystemStatusColor = (onlineCount) => {
    return onlineCount >= 1 ? "#16a34a" : "#64748b"; // Green for Online, Slate for Offline
};
