const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./constants/doctors_whitelist');
const fs = require('fs'); // נוסף כדי לאפשר קריאה של קובץ ה-config

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmailNotification(docName, city, dateStr) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `🚨 תור פנוי לנוירולוג: ${docName} ב${city}!`,
        text: `הבוט מצא תור פנוי אצל ${docName} בעיר ${city}.\nתאריך התור: ${dateStr}\n\nהיכנס מיד לאתר כללית לקבוע אותו!`
    };
    await transporter.sendMail(mailOptions);
}

async function runClalit(page) {
    // טעינת ההגדרות שנשמרו מהדשבורד
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");
    await page.goto('https://e-services.clalit.co.il/onlineweb/general/login.aspx', { waitUntil: 'domcontentloaded' });

  try {
      // 1. מעבר ללשונית "קוד משתמש וסיסמה" עם תיקון גלילה ממרכז
        const passTabBtn = '#ctl00_cphBody__loginView_btnPassword';
        console.log("👆 עובר ללשונית 'קוד משתמש וסיסמה'...");
        try {
            await page.waitForSelector(passTabBtn, { state: 'visible', timeout: 15000 });
            await page.$eval(passTabBtn, (el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            // הקיצוץ: המתנה מינימלית בלבד לפני הלחיצה
            await page.waitForTimeout(200); 
            await page.click(passTabBtn);
            // הקיצוץ: ביטול ההמתנה של ה-2 שניות. פליירייט ימתין אוטומטית לשדה בהמשך הקוד
            await page.waitForTimeout(300); 
        } catch (err) {
            console.log("⚠️ לא הצלחתי ללחוץ על הלשונית באמצעות ID, מנסה להמשיך להזנה...");
        }
        // 2. הגדרת סלקטורים לפי ה-HTML המדויק ששלחת מהקונסול
        const idField = '#ctl00_cphBody__loginView_tbUserId';
        const codeField = '#ctl00_cphBody__loginView_tbUserName';
        const passField = '#ctl00_cphBody__loginView_tbPassword';

        console.log("⏳ ממתין להופעת שדות ההזנה...");
        await page.waitForSelector(idField, { state: 'visible', timeout: 10000 });

        const idToType = String(config.userId || '');
        const codeToType = String(config.userCode || '');
        const passToType = String(config.password || '');

        console.log(`⌨️ מזין נתוני התחברות (ת"ז: ${idToType.substring(0,3)}***)...`);
        
        // פונקציית עזר להקלדה אנושית - שומרת על קצב ההקלדה אך מקצרת המתנות ריקות
        const typeHumanLike = async (selector, text) => {
            await page.click(selector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(50); // קוצר משמעותית: המתנה מזערית רק לאיפוס השדה
            
            for (const char of text) {
                await page.keyboard.insertText(char);
                // קצב ההקלדה האנושי והטוב נשמר בדיוק כפי שהיה
                await page.waitForTimeout(Math.floor(Math.random() * 150) + 150);
            }
        };

        console.log("⌨️ מתחיל הזנה אנושית מיד...");

        // 1. הזנה רציפה - השהיות המעבר בין השדות קוצצו
        await typeHumanLike(idField, idToType);
        await page.waitForTimeout(100); // מעבר כמעט מיידי לשדה הבא
        await typeHumanLike(codeField, codeToType);
        await page.waitForTimeout(100); 
        await typeHumanLike(passField, passToType);

        // 2. לחיצה על כפתור הכניסה
        const loginBtnSelector = '#ctl00_cphBody__loginView_btnSend';
        console.log("🚀 לוחץ על כפתור הכניסה...");
        try {
            await page.waitForSelector(loginBtnSelector, { state: 'visible', timeout: 15000 });
            await page.$eval(loginBtnSelector, (el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            await page.waitForTimeout(200); 
            await page.click(loginBtnSelector);
        } catch (err) {
            console.error("❌ לא הצלחתי ללחוץ על כפתור הכניסה:", err.message);
            await page.click('span:has-text("כניסה")');
        }

        console.log("--------------------------------------------------");
        console.log("ממתין לסיום תהליך ההתחברות...");
        // ממתין שההתחברות תצליח והמסך הראשי ייטען (לפי כפתור שירותי האון-ליין)
        await page.waitForSelector('text="שירותי האון־ליין"', { timeout: 300000 });
        
        // בדיקה אם הוגדר בן משפחה בדשבורד - תוקן לשם המשתנה הנכון
        if (config.familyMember && config.familyMember.trim() !== '') {
            console.log(`👨‍👩‍👧 מנסה לעבור לתיק של בת המשפחה: ${config.familyMember}`);
            try {
                // חיפוש ולחיצה על השם המדויק שהוזן בדשבורד
                const memberText = config.familyMember.trim();
                await page.waitForSelector(`text="${memberText}"`, { state: 'visible', timeout: 15000 });
                await page.click(`text="${memberText}"`);
                console.log(`✅ עברתי בהצלחה לתיק של ${memberText}`);
                await page.waitForTimeout(6000); // המתנה לטעינת התיק
            } catch (err) {
                console.log(`⚠️ לא הצלחתי למצוא או ללחוץ על השם '${config.familyMember}'. ממשיך בתיק הראשי.`);
            }
        }

        await page.click('text="שירותי האון־ליין"');
        await page.waitForTimeout(2500);
        await page.click('a[title="זימון תורים"]');

        async function getTarget() {
            const selector = '#ProfessionVisitButton';
            if (await page.$(selector)) return page;
            for (const frame of page.frames()) {
                if (await frame.$(selector)) return frame;
            }
            return null;
        }

        let target = await getTarget();
        if (!target) { await page.waitForTimeout(6000); target = await getTarget(); }

        await target.click('#ProfessionVisitButton');
        await target.waitForSelector('#SelectedGroupCode', { timeout: 20000 });

        // בחירה דינמית מתוך קובץ ה-config
        const groupId = config.selectedGroup || '32';
        const specId = config.selectedSpecialization || groupId;

        console.log(`🔍 מפעיל חיפוש: קבוצה ${groupId}, מקצוע ${specId}`);
        await target.selectOption('#SelectedGroupCode', groupId);
        
        // המתנה לשינוי ב-DOM של רשימת המקצועות
        await page.waitForTimeout(3000); 
        await target.selectOption('#SelectedSpecializationCode', specId);
        await page.waitForTimeout(1000);

        // --- לוגיקת החיפוש המעודכנת ---
        const sentInThisRun = new Set(); 
// משיכת מערך הערים מהדשבורד או שימוש בברירת מחדל
        const citiesToSearch = (config.selectedCities && config.selectedCities.length > 0) 
            ? config.selectedCities 
            : ['הרצליה'];
            
        // משיכת מערך הרופאים מהדשבורד (אם ריק - יחפש את כולם)
        const activeDoctorsFilter = (config.selectedDoctors && config.selectedDoctors.length > 0)
            ? config.selectedDoctors
            : []; 

        for (const city of citiesToSearch) {
            console.log(`\n===================================`);
            console.log(`🏙️ מתחיל סריקה בעיר: ${city}`);
            
            const cityInput = '#SelectedCityName';
            await target.click(cityInput);
            await target.evaluate((selector) => document.querySelector(selector).value = '', cityInput);
            console.log(`🔎 מזין '${city}'...`);
            await target.type(cityInput, city, { delay: 250 });

            // המתנה להופעת התפריט
            await target.waitForSelector('li.ui-menu-item', { state: 'visible', timeout: 15000 });
            await page.waitForTimeout(1000);

            // בחירה מדויקת מתוך הרשימה לפי טקסט
            const clicked = await target.evaluate((cityName) => {
                const items = Array.from(document.querySelectorAll('li.ui-menu-item'));
                const match = items.find(item => item.innerText.trim() === cityName);
                if (match) {
                    match.click();
                    return true;
                }
                return false;
            }, city);

            if (!clicked) {
                console.log(`⚠️ לא נמצאה התאמה מדויקת ל-'${city}' ברשימה, מנסה ללחוץ Enter כברירת מחדל.`);
                await page.keyboard.press('Enter');
            }

            await page.waitForTimeout(2000);

            await target.click('#searchBtnSpec');
            await page.waitForTimeout(8000); 

            let hasNextPage = true;
            let pageNum = 1;

            while (hasNextPage) {
                console.log(`📄 סורק דף תוצאות מספר ${pageNum} ב${city}...`);

               // משיכת מערך הרופאים מהדשבורד לצורך השוואה
                const activeDoctorsFilter = (config.selectedDoctors && config.selectedDoctors.length > 0)
                    ? config.selectedDoctors
                    : []; 

                // שולפים את כל המידע הגולמי מתוך הדף ללא שום סינון כדי להדפיס לטרמינל
                const rawDataFromPage = await target.evaluate(() => {
                    return Array.from(document.querySelectorAll('.diaryDoctor')).map(card => {
                        return {
                            docNameRaw: card.querySelector('.doctorName')?.innerText || 'לא נמצא שם',
                            dateTextRaw: card.querySelector('.visitDateTime')?.innerText || 'לא נמצא תאריך'
                        };
                    });
                });

                console.log("\n--- תחילת הדפסת דיבוג: מה הבוט רואה כרגע בדף ---");
                const foundInPage = [];
                
                // עוברים על כל רופא שהבוט ראה, מדפיסים אותו, ומפעילים את הסינון שלנו מחוץ לדפדפן
                for (const item of rawDataFromPage) {
                    console.log(`* קורא כרטיסייה: שם: [${item.docNameRaw.trim()}], תאריך: [${item.dateTextRaw.trim()}]`);
                    
                    const match = item.dateTextRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    
                    if (!match) {
                        console.log(`   -> דילגתי: לא הצלחתי למצוא מבנה של תאריך מלא (DD/MM/YYYY) בטקסט הזה.`);
                        continue;
                    }
                    
                    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                    const inRange = !config.endDate || (isoDate <= config.endDate);
                    
                    if (!inRange) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} מאוחר מתאריך היעד ${config.endDate}.`);
                        continue;
                    }
                    
                    const isPreferred = activeDoctorsFilter.length === 0 || activeDoctorsFilter.some(name => item.docNameRaw.includes(name));
                    
                    if (!isPreferred) {
                        console.log(`   -> דילגתי: הרופא אינו ברשימת המועדפים שהוגדרה.`);
                        continue;
                    }

                    console.log(`   -> ✅ התור עבר את כל הסינונים וישלח למייל!`);
                    foundInPage.push({ doctor: item.docNameRaw.trim(), dateStr: item.dateTextRaw.trim() });
                }
                console.log("--- סוף הדפסת דיבוג ---\n");

                for (const appt of foundInPage) {
                    const key = `${appt.doctor}-${appt.dateStr}`;
                    if (!sentInThisRun.has(key)) {
                        try {
                            await sendEmailNotification(appt.doctor, city, appt.dateStr);
                            console.log(`🎉 נמצא תור! מייל נשלח עבור: ${appt.doctor}`);
                            sentInThisRun.add(key);
                        } catch (mailErr) {
                            console.error(`⚠️ שגיאה בשליחת מייל:`, mailErr.message);
                        }
                    }
                }

               // בדיקת דף הבא - מוודא שהכפתור קיים ונראה לעין
                const nextBtnSelector = 'a[title="הבא"]';
                const nextBtn = await target.$(nextBtnSelector);
                
                if (nextBtn && await nextBtn.isVisible()) {
                    console.log(`➡️ נמצא כפתור 'הבא', עובר לדף ${pageNum + 1}...`);
                    await nextBtn.scrollIntoViewIfNeeded(); // גלילה לכפתור כדי שיהיה ניתן ללחוץ
                    await nextBtn.click();
                    await page.waitForTimeout(8000); // זמן טעינה ארוך יותר בין דפים
                    pageNum++;
                } else {
                    console.log("🏁 לא נמצאו דפים נוספים בעיר זו.");
                    hasNextPage = false;
                }
            }
        }

        console.log(`\n✅ סריקת כל הערים והדפים הסתיימה!`);

    } catch (error) {
        console.error("❌ שגיאה במהלך הבוט:", error.message);
    }
}

module.exports = { runClalit };