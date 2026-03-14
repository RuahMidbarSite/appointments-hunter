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
    // לוג מעקב שמדפיס את כל הנתונים שהתקבלו לפני כתיבתם ללוג
    console.log(`💾 [TRACE - reportGenerator] אובייקט apptDetails שהתקבל:`, JSON.stringify(apptDetails, null, 2));
    const now = new Date();
    const runDuration = Math.round((now - stats.startTime) / 1000 / 60);
    const waitDays = calculateWaitTime(apptDetails.dateStr);

  // וידוא ששם התחום קיים, ואם לא - חילוץ מהמקצוע או הגדרה כ'כללי'
    const finalGroupName = apptDetails.groupName || apptDetails.selectedGroup || 'כללי';

    const report = `
[${now.toLocaleString('he-IL')}] נמצא תור: ${apptDetails.dateStr} | תחום: ${finalGroupName} | מקצוע: ${apptDetails.specialization || 'לא צוין'} | רופא: ${apptDetails.doctor || 'לא צוין'} | עיר: ${apptDetails.city || 'לא צוין'} | הופעל ב: ${apptDetails.searchStartTime || 'לא צוין'}
`;
    
    // שמירה לקובץ היסטוריה (אופציונלי)
    fs.appendFileSync(path.join(process.cwd(), 'reports_history.log'), report);
    return report;
}

module.exports = { createFoundAppointmentReport };