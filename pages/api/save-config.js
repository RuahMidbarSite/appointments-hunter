import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process'; 

// משתנה גלובלי לשמירת הבוט הנוכחי
let currentBotProcess = null;

// 👇 זה צריך להיות כאן, מחוץ לכל פונקציה
const cleanEnv = (key) => {
  const val = process.env[key] || '';
  return val.replace(/^["']|["']$/g, '');
};

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      userId: cleanEnv('CLALIT_USER_ID'),
      userCode: cleanEnv('CLALIT_USER_CODE'),
      password: cleanEnv('CLALIT_PASSWORD'),
      familyMember: cleanEnv('CLALIT_FAMILY_MEMBER')
    });
  }

  if (req.method === 'POST') {
    try {
      // 1. עצירת הבוט הקודם וסגירת כל חלונות הכרומיום המשויכים אליו
      if (currentBotProcess) {
        console.log("🛑 עוצר את הבוט הקודם ומנקה דפדפנים...");
        
        // פקודת חיסול אגרסיבית שמתאימה ל-Windows
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${currentBotProcess.pid} /T /F`);
        } else {
          currentBotProcess.kill('SIGKILL');
        }
        
        currentBotProcess = null;
      }

      // בדיקה האם זו פקודת עצירה בלבד מהדשבורד
      if (req.body && req.body.action === 'stop') {
        console.log("⏹️ סריקה נעצרה בהצלחה לבקשת המשתמש.");
        return res.status(200).json({ message: 'Bot stopped successfully' });
      }

      // 2. הכנת הנתונים ושמירת ההגדרות
      const finalConfig = { ...req.body };

      // משיכת פרטי התחברות מה-ENV אם הם לא נשלחו מהדשבורד
      // משיכת פרטי התחברות מה-ENV רק אם השדות בדשבורד נשארו ריקים לחלוטין
   if (!finalConfig.userId) {
    finalConfig.userId = cleanEnv('CLALIT_USER_ID');
}
if (!finalConfig.userCode) {
    finalConfig.userCode = cleanEnv('CLALIT_USER_CODE');
}
if (!finalConfig.password) {
    finalConfig.password = cleanEnv('CLALIT_PASSWORD');
}
if (!finalConfig.familyMember) {
    finalConfig.familyMember = cleanEnv('CLALIT_FAMILY_MEMBER');
}

      const configPath = path.join(process.cwd(), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

      console.log("✅ ההגדרות נשמרו (כולל פרטים ובת משפחה מה-ENV). מתחיל ריצה חדשה...");

      // 3. הפעלת הבוט החדש
      currentBotProcess = spawn('node', ['index.js'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });

      return res.status(200).json({ message: 'Success' });

    } catch (error) {
      console.error("שגיאה בהפעלת הבוט:", error);
      return res.status(500).json({ error: 'Failed to manage bot process' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}