const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'config.json');
// הגדרת נתיב לקובץ הזיכרון שבו יישמרו התאריכים האחרונים שנמצאו עבור כל רופא
const memoryPath = path.join(process.cwd(), 'sent_appointments.json');

/**
 * מעדכן את הסטטוס עבור הנורה בדשבורד
 * @param {string} status - 'active' או 'idle'
 */
const setBotStatus = (status) => {
    try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        cfg.botStatus = status; // 'active' או 'idle'
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error("Error updating bot status:", e);
    }
};

/**
 * בודק אם התור שנמצא מוקדם יותר ממה ששמור בזיכרון עבור אותו רופא
 */
const isBetterAppointment = (docName, dateStr) => {
    let memory = {};
    if (fs.existsSync(memoryPath)) {
        memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    }

    // המרת התאריך שנמצא (DD.MM.YYYY או DD/MM/YYYY) לאובייקט תאריך בר השוואה
    const [day, month, year] = dateStr.split(/[\.\/]/);
    const newDate = new Date(`${year}-${month}-${day}`).getTime();
    
    const prevEntry = memory[docName];
    // אם אין תור קודם בזיכרון לרופא הזה, זה נחשב תור "טוב יותר"
    if (!prevEntry) return true; 

    // תמיכה בשליפת התאריך בין אם הוא מחרוזת (פורמט ישן) או אובייקט (פורמט חדש)
    const prevDateStr = typeof prevEntry === 'object' ? prevEntry.date : prevEntry;
    const [pDay, pMonth, pYear] = prevDateStr.split(/[\.\/]/);
    const previousDate = new Date(`${pYear}-${pMonth}-${pDay}`).getTime();

    // מחזיר אמת (true) רק אם התאריך שנמצא עכשיו מוקדם יותר מהתאריך השמור
    return newDate < previousDate; 
};

/**
 * מעדכן את קובץ הזיכרון בתאריך החדש, הטוב ביותר והעיר שנמצאה
 */
const updateMemory = (docName, dateStr, city) => {
    // 1. עדכון קובץ הזיכרון (עבור הדשבורד וההתראות)
    let memory = fs.existsSync(memoryPath) ? JSON.parse(fs.readFileSync(memoryPath, 'utf8')) : {};
    const finalCity = city || "לא צויין יישוב";
    memory[docName] = { date: dateStr, city: finalCity };
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

    // 2. רישום בדוח הריצה (עבור כפתור הדוח בדשבורד)
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    const timestamp = new Date().toLocaleString('he-IL');
    const logEntry = `[${timestamp}] נמצא תור: ${dateStr} | רופא: ${docName} | עיר: ${finalCity}\n`;
    
    try {
        fs.appendFileSync(reportPath, logEntry, 'utf8');
    } catch (err) {
        console.error("שגיאה בכתיבה לדוח המערכת:", err);
    }
};

/**
 * ממתין בין סבבים ובודק כל 5 שניות אם המשתמש ביקש להפסיק בדשבורד
 */
async function waitMinutes(minutes) {
    const ms = minutes * 60 * 1000;
    const checkStep = 5000; // בודק כל 5 שניות אם המשתמש עצר את הבוט
    for (let i = 0; i < ms; i += checkStep) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!cfg.runInLoop) return false; // המשתמש כיבה את הלולאה בדשבורד
        await new Promise(resolve => setTimeout(resolve, checkStep));
    }
    return true;
}

// ייצוא כל הפונקציות לשימוש בתוך clalit.js
module.exports = { 
    setBotStatus, 
    waitMinutes, 
    isBetterAppointment, 
    updateMemory 
};