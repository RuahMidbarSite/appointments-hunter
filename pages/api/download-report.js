import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    
    // בדיקה אם הקובץ קיים פיזית על הדיסק
    if (!fs.existsSync(reportPath)) {
        const initialContent = "--- דוח צייד התורים - היסטוריית ריצות ---\n";
        fs.writeFileSync(reportPath, initialContent, 'utf8');
    }

    try {
        const fileContent = fs.readFileSync(reportPath, 'utf8');
        const lines = fileContent.split('\n');
        
        let totalLoops = 0;
        let appointmentsFound = 0;
        const doctorsCount = {};
        const hoursCount = {};
        const datesFound = [];

        // ניתוח הנתונים שורות-שורות
        lines.forEach(line => {
            // ספירת סבבי לולאה
            if (line.includes('סבב סריקה הסתיים')) {
                totalLoops++;
            }
            
            // זיהוי שורות שבהן נמצא תור מוצלח
            if (line.includes('נמצא תור:')) {
                appointmentsFound++;
                
                // 1. חילוץ שעת המציאה מתוך הסוגריים המרובעים (למשל [9.3.2026, 12:30:44])
                const timeMatch = line.match(/\[.*?,\s*(\d{1,2}):/);
                if (timeMatch) {
                    const hour = timeMatch[1];
                    hoursCount[hour] = (hoursCount[hour] || 0) + 1;
                }

                // 2. חילוץ שם הרופא
                const docMatch = line.match(/רופא:\s*(.+?)\s*\|/);
                if (docMatch) {
                    const doc = docMatch[1].trim();
                    doctorsCount[doc] = (doctorsCount[doc] || 0) + 1;
                }

                // 3. חילוץ תאריך התור הפנוי
                const dateMatch = line.match(/בתאריך\s*([\d\.\/]+)/);
                if (dateMatch) {
                    datesFound.push(dateMatch[1]);
                }
            }
        });

        // בניית תקציר הסטטיסטיקות שיופיע בראש הדוח
        let summary = "========================================================\n";
        summary += "📊 דוח צייד התורים - תקציר סטטיסטי וניתוח נתונים 📊\n";
        summary += "========================================================\n\n";
        
        summary += `🔄 סך הכל סבבי סריקה שתועדו: ${totalLoops > 0 ? totalLoops : '(החל להתעדכן כעת)'}\n`;
        summary += `🎯 סך הכל תורים שנמצאו: ${appointmentsFound}\n\n`;

        if (appointmentsFound > 0) {
            summary += "🏆 הרופאים שהתפנו הכי הרבה פעמים:\n";
            // מיון רופאים לפי כמות התורים מהגבוה לנמוך
            Object.entries(doctorsCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([doc, count]) => {
                    summary += `   - ${doc}: ${count} פעמים\n`;
                });

            summary += "\n⏰ השעות ה\"חמות\" ביותר למציאת תור:\n";
            // מיון שעות לפי אחוזי ההצלחה
            Object.entries(hoursCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([hour, count]) => {
                    summary += `   - סביבות השעה ${hour}:00: ${count} תורים\n`;
                });

            summary += "\n📅 התאריכים שהתפנו (לפי סדר מציאתם):\n";
            // הדפסת התאריכים (מוגבל ל-15 האחרונים כדי לא להעמיס)
            const recentDates = datesFound.slice(-15);
            summary += `   - ${recentDates.join(', ')}\n`;
        }

        summary += "\n========================================================\n";
        summary += "📄 פירוט מלא של היסטוריית הריצות (יומן מערכת):\n";
        summary += "========================================================\n\n";

        // הדבקת התקציר החכם מעל הלוג המקורי השלם
        const finalOutput = summary + fileContent;

        // הגדרת כותרות התגובה כדי לגרום לדפדפן להוריד קובץ טקסט
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=bot_smart_report.txt');
        return res.send(finalOutput);
        
    } catch (error) {
        console.error("שגיאה בשליחת הדוח:", error);
        return res.status(500).json({ error: 'נכשלה גישה לקובץ הדוח' });
    }
}