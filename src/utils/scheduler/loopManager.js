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

    const prevEntry = memory[docName];
    
    // אם אין תור קודם בזיכרון לרופא הזה, זה נחשב תור "טוב יותר"
    if (!prevEntry) {
        console.log(`   [דיבוג תאריכים] אין תור קודם בזיכרון לרופא ${docName}. מאשר שליחה!`);
        return true; 
    }

    // חילוץ בטוח של התאריך החדש (מוודא שאין טקסט מיותר מסביב)
    const newMatch = dateStr.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
    if (!newMatch) {
        console.log(`   [דיבוג תאריכים] התאריך החדש שהתקבל אינו תקין: ${dateStr}`);
        return false;
    }
    const newDate = new Date(`${newMatch[3]}-${newMatch[2]}-${newMatch[1]}`).getTime();

    // שליפת התאריך הישן מהזיכרון
    const prevDateStr = typeof prevEntry === 'object' ? prevEntry.date : prevEntry;
    
    // חילוץ בטוח של התאריך הישן באמצעות Regex (למקרה שהקובץ מכיל טקסט מלוכלך מפעם קודמת)
    const prevMatch = prevDateStr.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
    
    if (!prevMatch) {
        console.log(`   [דיבוג תאריכים] התאריך השמור בזיכרון משובש: ${prevDateStr}. דורס אותו עם החדש.`);
        return true; // אם התאריך הישן נדפק או הוקלט כטקסט מוזר, נאשר את התור החדש כדי לתקן את הזיכרון
    }

    const previousDate = new Date(`${prevMatch[3]}-${prevMatch[2]}-${prevMatch[1]}`).getTime();

    // הדפסת הדיבוג לטרמינל כדי שנראה בדיוק מה המחשב רואה
    console.log(`   [דיבוג תאריכים] השוואת תאריכים עבור ${docName}:`);
    console.log(`   [דיבוג תאריכים] 🗓️ חדש: ${newMatch[0]} | 💾 שמור בזיכרון: ${prevMatch[0]}`);
    console.log(`   [דיבוג תאריכים] 🧮 מתמטיקה: ${newDate} < ${previousDate} = ${newDate < previousDate}`);

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
 * מחשב זמן המתנה אקראי מתוך מחרוזת טווח (למשל "10-15")
 */
const getRandomFrequency = (rangeStr) => {
    if (!rangeStr || typeof rangeStr !== 'string' || !rangeStr.includes('-')) {
        return typeof rangeStr === 'number' ? rangeStr : 15;
    }
    const [min, max] = rangeStr.split('-').map(Number);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * ממתין בין סבבים ובודק כל 5 שניות אם המשתמש ביקש להפסיק בדשבורד
 */
async function waitMinutes(range) {
    const minutes = getRandomFrequency(range);
    console.log(`🎲 נבחר זמן המתנה אקראי של ${minutes} דקות לסבב זה.`);
    const ms = minutes * 60 * 1000;
    
    // --- תוספת חדשה לסנכרון הטיימר מול הדשבורד ---
    // מחשבים את שעת ההתעוררות המדויקת ושומרים בקובץ כדי שהדשבורד יקרא אותה
    try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        cfg.nextRunTime = Date.now() + ms;
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error("שגיאה בשמירת זמן הריצה הבא:", e);
    }
    // ----------------------------------------------

    const checkStep = 5000; // בודק כל 5 שניות אם המשתמש עצר את הבוט
    for (let i = 0; i < ms; i += checkStep) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!cfg.runInLoop) return false; // המשתמש כיבה את הלולאה בדשבורד
        await new Promise(resolve => setTimeout(resolve, checkStep));
    }
    return true;
}

/**
 * מתעד כל סיום של לולאת סריקה בקובץ הדוח, כולל כמות התוצאות
 */
const logScanRun = (foundCount) => {
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    const timestamp = new Date().toLocaleString('he-IL');
    const status = foundCount > 0 ? `✅ הניב ${foundCount} תוצאות חדשות/טובות יותר` : `⚪ סריקה ריקה (לא נמצאו תורים חדשים)`;
    const logEntry = `[${timestamp}] 🔄 סבב סריקה הסתיים | ${status}\n`;
    
    try {
        fs.appendFileSync(reportPath, logEntry, 'utf8');
    } catch (err) {
        console.error("שגיאה בכתיבת סיכום סבב לדוח:", err);
    }
};

// ייצוא מעודכן הכולל את כל הפונקציות הנדרשות
module.exports = { 
    setBotStatus, 
    waitMinutes, 
    isBetterAppointment, 
    updateMemory,
    logScanRun
};