const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const SearchTemplate = require('../../src/models/SearchTemplate');

const MONGODB_URI = process.env.MONGODB_URI;

async function dbConnect() {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGODB_URI);
}
// משתנה גלובלי לשמירת הבוט הנוכחי
let currentBotProcess = null;

const cleanEnv = (key) => {
  const val = process.env[key] || '';
  return val.replace(/^["']|["']$/g, '');
};

module.exports = async function handler(req, res) {
  const configPath = path.join(process.cwd(), 'config.json');

  if (req.method === 'GET') {
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
        currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // משיכת התור המוקדם ביותר מהזיכרון הכולל רופא ועיר
    let lastFoundDate = "טרם נמצאו תורים";
    const memoryPath = path.join(process.cwd(), 'sent_appointments.json');
    
    if (fs.existsSync(memoryPath)) {
        const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
        let minTime = Infinity;
        let bestDisplay = "";

        for (const [docName, data] of Object.entries(memory)) {
            // תמיכה בפורמט ישן (טקסט) ובפורמט חדש (אובייקט עם עיר)
            const dateStr = typeof data === 'object' ? data.date : data;
            const city = typeof data === 'object' ? data.city : "לא צוין יישוב";
            
            // חילוץ תאריך להשוואה (מנקה טקסט מיותר אם קיים)
            const dateMatch = dateStr.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
            if (dateMatch) {
                const [_, d, m, y] = dateMatch;
                const time = new Date(`${y}-${m}-${d}`).getTime();

                if (time < minTime) {
                    minTime = time;
                    bestDisplay = `${dateMatch[0]} - ${docName} (${city})`;
                }
            }
        }
        if (bestDisplay) lastFoundDate = bestDisplay;
    }

    return res.status(200).json({
      ...currentConfig,
      lastFoundDate, // הוספת המידע לתשובה לדשבורד
      userId: currentConfig.userId || cleanEnv('CLALIT_USER_ID'),
      userCode: currentConfig.userCode || cleanEnv('CLALIT_USER_CODE'),
      password: currentConfig.password || cleanEnv('CLALIT_PASSWORD'),
      familyMember: currentConfig.familyMember || cleanEnv('CLALIT_FAMILY_MEMBER')
    });
  }

  if (req.method === 'POST') {
    try {
      if (!MONGODB_URI) {
          console.error("❌ MONGODB_URI is missing in .env file");
          return res.status(500).json({ error: "Database configuration missing" });
      }
      await dbConnect();

      // חיפוש תבניות ב-DB
      if (req.body.action === 'search_templates') {
          const query = req.body.query;
          const templates = await SearchTemplate.find({
              $or: [
                  { templateName: { $regex: query, $options: 'i' } },
                  { userId: { $regex: query, $options: 'i' } }
              ]
          }).limit(5);
          return res.status(200).json(templates);
      }

      // שמירת תבנית ל-DB
      if (req.body.action === 'save_template_to_db') {
          const { templateName, ...configData } = req.body.data;
          await SearchTemplate.findOneAndUpdate(
              { templateName },
              { ...configData, updatedAt: new Date() },
              { upsert: true }
          );
          return res.status(200).json({ message: 'Saved to DB' });
      }
        // מחיקת תבנית מה-DB
      if (req.body.action === 'delete_template') {
          const { id } = req.body;
          await SearchTemplate.findByIdAndDelete(id);
          return res.status(200).json({ message: 'Template deleted' });
      }
      // ניקוי ממוקד: סוגר את הבוט הקודם ואת הדפדפנים שלו מבלי להפיל את השרת
      console.log("🪓 מנקה שאריות של דפדפנים ובוט קודם...");
      // סגירה מבוקרת של תהליך הבוט הקודם (ללא פקודות מערכת שסוגרות את כל הכרום)
      if (currentBotProcess) {
        console.log(`🪓 שולח בקשת עצירה לבוט (PID: ${currentBotProcess.pid})...`);
        currentBotProcess.kill('SIGINT'); // שליחת סיגנל סגירה מסודר
      }
      currentBotProcess = null;

      // בדיקה האם זו פקודת שמירה בלבד (ללא הפעלה מחדש של הבוט)
      if (req.body && req.body.action === 'save_only') {
          const cfgToSave = { ...req.body };
          delete cfgToSave.action; // מנקים את שדה הפעולה כדי לא ללכלך את הקובץ
          
          // שומרים את ההגדרות החדשות בקובץ בשקט. הבוט יקרא אותן בסבב הבא
          fs.writeFileSync(configPath, JSON.stringify(cfgToSave, null, 2));
          console.log("💾 הגדרות עודכנו ברקע (ייכנסו לתוקף בסבב הבא).");
          return res.status(200).json({ message: 'Config saved silently' });
      }

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

      // הבטחת סטטוס ראשוני כשאנחנו מפעילים בוט חדש (ואיפוס טיימר קודם)
      finalConfig.botStatus = 'active';
      finalConfig.nextRunTime = null; // מוחקים זמן ישן כדי לא לבלבל את הטיימר
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