import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process'; 

// משתנה גלובלי לשמירת הבוט הנוכחי
let currentBotProcess = null;

const cleanEnv = (key) => {
  const val = process.env[key] || '';
  return val.replace(/^["']|["']$/g, '');
};

export default function handler(req, res) {
  const configPath = path.join(process.cwd(), 'config.json');

  if (req.method === 'GET') {
    // טעינת הקובץ הקיים כדי להחזיר לדשבורד את הסטטוס העדכני (בשביל הנורה)
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
        currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    return res.status(200).json({
      ...currentConfig,
      userId: currentConfig.userId || cleanEnv('CLALIT_USER_ID'),
      userCode: currentConfig.userCode || cleanEnv('CLALIT_USER_CODE'),
      password: currentConfig.password || cleanEnv('CLALIT_PASSWORD'),
      familyMember: currentConfig.familyMember || cleanEnv('CLALIT_FAMILY_MEMBER')
    });
  }

  if (req.method === 'POST') {
    try {
      // ניקוי ממוקד: סוגר את הבוט הקודם ואת הדפדפנים שלו מבלי להפיל את השרת
      console.log("🪓 מנקה שאריות של דפדפנים ובוט קודם...");
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          // סוגר רק את הדפדפנים הפתוחים (chrome/chromium)
          execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
          
          // אם יש בוט שרץ כרגע, סוגר רק אותו לפי ה-PID שלו
          if (currentBotProcess && currentBotProcess.pid) {
             execSync(`taskkill /PID ${currentBotProcess.pid} /F /T`, { stdio: 'ignore' });
          }
        } catch (e) { /* אין מה לסגור */ }
      } else {
        // גיבוי למערכות הפעלה שאינן ווינדוס (כמו שרתי לינוקס)
        if (currentBotProcess) currentBotProcess.kill('SIGKILL');
      }
      currentBotProcess = null;

      // בדיקה האם זו פקודת עצירה בלבד מהדשבורד
      if (req.body && req.body.action === 'stop') {
        // עדכון הקובץ לסטטוס כבוי כדי שהנורה תתעדכן מיד
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            cfg.runInLoop = false;
            cfg.botStatus = 'idle';
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
        }
        console.log("⏹️ סריקה נעצרה לבקשת המשתמש.");
        return res.status(200).json({ message: 'Bot stopped successfully' });
      }

      // 2. הכנת הנתונים ושמירת ההגדרות
      const finalConfig = { ...req.body };

      // משיכת פרטי התחברות מה-ENV רק אם השדות בדשבורד ריקים
      if (!finalConfig.userId) finalConfig.userId = cleanEnv('CLALIT_USER_ID');
      if (!finalConfig.userCode) finalConfig.userCode = cleanEnv('CLALIT_USER_CODE');
      if (!finalConfig.password) finalConfig.password = cleanEnv('CLALIT_PASSWORD');
      if (!finalConfig.familyMember) finalConfig.familyMember = cleanEnv('CLALIT_FAMILY_MEMBER');

      // הבטחת סטטוס ראשוני כשאנחנו מפעילים בוט חדש
      finalConfig.botStatus = 'active';
      fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

      console.log("✅ ההגדרות נשמרו. מתחיל ריצה חדשה...");

      // 3. הפעלת הבוט החדש
      currentBotProcess = spawn('node', ['index.js'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });

      return res.status(200).json({ message: 'Success' });

    } catch (error) {
      console.error("שגיאה בניהול תהליך הבוט:", error);
      return res.status(500).json({ error: 'Failed to manage bot process' });
    }
  }
}