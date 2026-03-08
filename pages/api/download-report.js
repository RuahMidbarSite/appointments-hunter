import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // הגדרת הנתיב לקובץ הלוג בתיקיית השורש של הפרויקט
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    
    // בדיקה אם הקובץ קיים פיזית על הדיסק
    if (!fs.existsSync(reportPath)) {
        // אם לא קיים, ניצור קובץ ריק עם כותרת כדי שההורדה לא תיכשל
        const initialContent = "--- דוח צייד התורים - היסטוריית ריצות ---\n";
        fs.writeFileSync(reportPath, initialContent, 'utf8');
    }

    try {
        const fileContent = fs.readFileSync(reportPath, 'utf8');
        // הגדרת כותרות התגובה כדי לגרום לדפדפן להוריד קובץ טקסט
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=bot_report.txt');
        return res.send(fileContent);
    } catch (error) {
        console.error("שגיאה בשליחת הדוח:", error);
        return res.status(500).json({ error: 'נכשלה גישה לקובץ הדוח' });
    }
}