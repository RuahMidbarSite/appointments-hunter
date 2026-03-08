const fs = require('fs');
const path = require('path');

/**
 * מחשב כמה ימי המתנה יש מהיום ועד תאריך התור
 */
function calculateWaitTime(dateStr) {
    const [day, month, year] = dateStr.split('.');
    const apptDate = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    const diffTime = Math.abs(apptDate - today);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * יוצר דו"ח מפורט על מציאת תור
 */
function createFoundAppointmentReport(stats, apptDetails) {
    const now = new Date();
    const runDuration = Math.round((now - stats.startTime) / 1000 / 60);
    const waitDays = calculateWaitTime(apptDetails.dateStr);

    const report = `
🔔 נמצא תור חדש! - דו"ח מפורט
---------------------------------
🕒 זמן מציאה: ${now.toLocaleString('he-IL')}
⏱️ זמן ריצת בוט עד למציאה: ${runDuration} דקות
---------------------------------
👨‍⚕️ מקצוע/תחום: ${apptDetails.specialization || 'לא צוין'}
📍 יישוב: ${apptDetails.city}
👩‍⚕️ רופא: ${apptDetails.doctor}
📅 תאריך התור: ${apptDetails.dateStr}
⏳ זמן המתנה לתור: ${waitDays} ימים
---------------------------------
`;
    
    // שמירה לקובץ היסטוריה (אופציונלי)
    fs.appendFileSync(path.join(process.cwd(), 'reports_history.log'), report);
    return report;
}

module.exports = { createFoundAppointmentReport };