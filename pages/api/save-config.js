import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process'; // הוספנו את exec עבור הפקודה לווינדוס

// משתנה גלובלי לשמירת הבוט הנוכחי
let currentBotProcess = null;

export default function handler(req, res) {
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

      // 2. שמירת ההגדרות מהדשבורד
      const configPath = path.join(process.cwd(), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));

      console.log("✅ ההגדרות נשמרו. מתחיל ריצה חדשה...");

      // 3. הפעלת הבוט החדש (הסרנו את shell: true כדי למנוע יצירת "מעטפת")
      currentBotProcess = spawn('node', ['index.js'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });

      return res.status(200).json({ message: 'Success' });
    } catch (error) {
      console.error("שגיאה בהפעלת הבוט:", error);
      return res.status(500).json({ error: 'Failed' });
    }
  }
  res.status(405).json({ message: 'Method not allowed' });
}