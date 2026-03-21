const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const SearchTemplate = require('../../src/models/SearchTemplate');
const MorSearchTemplate = require('../../src/models/MorSearchTemplate'); // המודל החדש של מור

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

    // סנכרון מלא: משיכת התור המוקדם ביותר ישירות מהתבנית ב-Database
    let lastFoundDate = "טרם נמצאו תורים";
    
    try {
        await dbConnect();
        
        // ניתוב חכם: בחירת הטבלה לפי המנוע שמוגדר בקונפיגורציה
        const isMor = currentConfig.activeEngines && currentConfig.activeEngines.includes('mor_institute');
        const TargetModel = isMor ? MorSearchTemplate : SearchTemplate;

        // בניית השאילתה - למור מחפשים לפי ת.ז, לכללית לפי ת.ז ותחום
        const query = { userId: currentConfig.userId || cleanEnv('CLALIT_USER_ID') };
        if (!isMor) query.selectedGroup = currentConfig.selectedGroup;

        const template = await TargetModel.findOne(query);

        if (template && template.lastBestFound) {
            lastFoundDate = template.lastBestFound;
        }
    } catch (e) {
        console.error("❌ שגיאה בסנכרון נתונים מה-DB לדשבורד:", e.message);
        // גיבוי למקרה של תקלת תקשורת - נשתמש במה ששמור בקובץ הקונפיגורציה
        lastFoundDate = currentConfig.lastFoundDate || "טרם נמצאו תורים";
    }

    return res.status(200).json({
      ...currentConfig,
      lastFoundDate, 
      liveProgress: currentConfig.liveProgress || '', // תוספת: שליחת הסטטוס החי לדשבורד
      userId: currentConfig.userId || cleanEnv('CLALIT_USER_ID'),
      userCode: currentConfig.userCode || cleanEnv('CLALIT_USER_CODE'),
      password: currentConfig.password || cleanEnv('CLALIT_PASSWORD'),
      familyMember: currentConfig.familyMember || cleanEnv('CLALIT_FAMILY_MEMBER'),
      email: currentConfig.email || cleanEnv('CLALIT_EMAIL') || cleanEnv('EMAIL_USER')
    });
  }

 if (req.method === 'POST') {
    try {
      if (!MONGODB_URI) {
          console.error("❌ MONGODB_URI is missing in .env file");
          return res.status(500).json({ error: "Database configuration missing" });
      }
      await dbConnect();

// --- קבלת קוד אימות מהסמארטפון (תמיכה בתבנית האפליקציה ללא שגיאות ירידת שורה) ---
      const isSmsAction = req.body.action === 'sms_for_appointment' || req.body.sender !== undefined;

      if (isSmsAction) {
          // חילוץ הנתונים (תומך גם בתבנית הישנה שלך וגם בברירת המחדל הבטוחה של האפליקציה)
          const from = req.body.from || req.body.sender;
          const message = req.body.message || req.body.body;

          console.log(`\n--- 📩 [INCOMING SMS DEBUG] ---`);
          console.log(`מאת: ${from || 'לא ידוע'}`);
          console.log(`תוכן: ${message || 'אין תוכן'}`);
          console.log(`-------------------------------\n`);

          const authorizedSenders = ['Clalit', 'Mor', 'CLALIT', 'MOR', 'Machon', 'מכון מור', 'מור'];
          const isMedical = authorizedSenders.some(s => {
              if (!from) return false;
              return String(from).toLowerCase().includes(s.toLowerCase());
          });

          if (!isMedical) {
              console.warn(`[SMS-BLOCK] נחסמה הודעה ממקור לא מורשה: ${from}`);
              return res.status(403).json({ error: "Unauthorized sender" });
          }

          // חילוץ של 4 עד 6 ספרות רצופות מתוך הטקסט
          const otpMatch = message ? String(message).match(/\b\d{4,6}\b/) : null;
          const otpCode = otpMatch ? otpMatch[0] : null;

          if (otpCode) {
              const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              currentConfig.lastOtp = otpCode;
              currentConfig.otpReceivedAt = Date.now();
              fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
              
              console.log(`✅ [SMS-GATEWAY] קוד ${otpCode} נשמר בהצלחה!`);
              return res.status(200).json({ status: 'success' });
          }
          
          console.log(`❌ [SMS-GATEWAY] לא נמצא קוד מספרים בהודעה. מחזיר 400.`);
          return res.status(400).json({ error: "Missing OTP data" });
      }

      // --- המשך הקוד הקיים: חיפוש תבניות ---
      if (req.body.action === 'search_templates') {
          const query = req.body.query || '';
          
          if (!query.trim()) {
              return res.status(200).json([]);
          }

          const searchFilter = {
              $or: [
                  { familyMember: { $regex: `^${query}`, $options: 'i' } },
                  { userId: { $regex: `^${query}`, $options: 'i' } }
              ]
          };

          // מחפש בשתי הטבלאות ומאחד תוצאות
          const clalitTemplates = await SearchTemplate.find(searchFilter).lean();
          const morTemplates = await MorSearchTemplate.find(searchFilter).lean();
          
          const combinedTemplates = [...clalitTemplates, ...morTemplates]
              .sort((a, b) => (a.familyMember || '').localeCompare(b.familyMember || ''))
              .slice(0, 15);
          
          return res.status(200).json(combinedTemplates);
      }

      // שמירת תבנית ל-DB (ניתוב אוטומטי לטבלה הנכונה)
      if (req.body.action === 'save_template_to_db') {
          const { templateName, ...configData } = req.body.data;
          
          const isMor = configData.activeEngines && configData.activeEngines.includes('mor_institute');
          const TargetModel = isMor ? MorSearchTemplate : SearchTemplate;

          await TargetModel.findOneAndUpdate(
              { templateName },
              { ...configData, updatedAt: new Date() },
              { upsert: true }
          );
          return res.status(200).json({ message: 'Saved to DB' });
      }

      // מחיקת תבנית מה-DB
      if (req.body.action === 'delete_template') {
          const { id } = req.body;
          // מנסה למחוק משתיהן (רק אחת תצליח בהתאם ל-ID)
          await SearchTemplate.findByIdAndDelete(id);
          await MorSearchTemplate.findByIdAndDelete(id);
          return res.status(200).json({ message: 'Template deleted' });
      }

      // ניקוי ממוקד: סוגר את הבוט הקודם ואת הדפדפנים שלו מבלי להפיל את השרת
      console.log("🪓 מנקה שאריות של דפדפנים ובוט קודם...");
      if (currentBotProcess) {
        console.log(`🪓 שולח בקשת עצירה לבוט (PID: ${currentBotProcess.pid})...`);
        currentBotProcess.kill('SIGINT');
      }
      currentBotProcess = null;

      // טיפול באיפוס תור אחרון (מחיקה מכל המקורות)
      if (req.body && req.body.action === 'reset_last_found') {
          try {
              // 1. איפוס ב-Database (מבצע בשתי הטבלאות ליתר ביטחון)
              await SearchTemplate.updateOne(
                  { userId: req.body.userId, selectedGroup: req.body.selectedGroup },
                  { $set: { lastBestFound: "" } }
              );
              await MorSearchTemplate.updateMany(
                  { userId: req.body.userId },
                  { $set: { lastBestFound: "" } }
              );

              // 2. מחיקת קובץ הזיכרון המקומי (sent_appointments.json)
              const memoryPath = path.join(process.cwd(), 'sent_appointments.json');
              if (fs.existsSync(memoryPath)) {
                  fs.writeFileSync(memoryPath, JSON.stringify({}, null, 2));
              }

              // 3. עדכון ה-config.json המקומי
              if (fs.existsSync(configPath)) {
                  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                  cfg.lastFoundDate = "";
                  cfg.doctorDates = {};
                  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
              }

            console.log("🗑️ הזיכרון אופס ב-DB ובקבצים.");
            return res.status(200).json({ message: 'Memory reset successfully' });
          } catch (err) {
              console.error("Reset error:", err);
              return res.status(500).json({ error: 'Failed to reset memory' });
          }
      }

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
            cfg.liveProgress = '🛑 עצרתי הכל'; // כתיבת החיווי לקובץ ההגדרות
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
        }
        if (currentBotProcess) {
            console.log(`🪓 סוגר תהליך בוט פעיל (PID: ${currentBotProcess.pid})`);
            currentBotProcess.kill('SIGINT');
            currentBotProcess = null;
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
      if (!finalConfig.email) finalConfig.email = cleanEnv('CLALIT_EMAIL') || cleanEnv('EMAIL_USER');

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