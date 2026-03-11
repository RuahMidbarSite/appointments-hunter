const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./constants/doctors_whitelist');
const fs = require('fs'); // נוסף כדי לאפשר קריאה של קובץ ה-config
// ייבוא מנגנוני הלולאה והדיווח מהספרייה החדשה
// ייבוא מנגנוני הלולאה, הדיווח והזיכרון (כולל בדיקת תאריך מוקדם)
const { setBotStatus, waitMinutes, isBetterAppointment, updateMemory } = require('../../utils/scheduler/loopManager');
const { createExecutionReport } = require('../../utils/scheduler/reportGenerator');

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
   // עדכון הנורה ל"פעיל" מיד עם תחילת הפונקציה
    setBotStatus('active');
    
    // טעינת ההגדרות
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const stats = { startTime: new Date() };

    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");
   try {
        // בדיקה אם אנחנו כבר מחוברים בדף שירותי האון-ליין (חוסך טעינה מחדש)
        const isLoggedIn = await page.$('text="שירותי האון־ליין"').catch(() => null);
        
        if (!isLoggedIn) {
            console.log("🛡️ לא מזוהה סשן פעיל, טוען דף כניסה או מרענן...");
            await page.goto('https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsSpecials.aspx', { waitUntil: 'commit' });
        } else {
            console.log("⚡ נמצא סשן פעיל! ממשיך לסריקה ללא לוגין מחדש.");
        }

        const idField = '#ctl00_cphBody__loginView_tbUserId';
        // אם אנחנו כבר בפנים, השדה הזה לא יופיע והבוט ימשיך הלאה
        const needsLogin = await page.waitForSelector(idField, { visible: true, timeout: 5000 }).catch(() => null);
        if (needsLogin) {
            console.log("🔑 לא מזוהה חיבור פעיל, מבצע לוגין מלא...");
            
            // מעבר ללשונית "קוד משתמש וסיסמה"
            const passTabBtn = '#ctl00_cphBody__loginView_btnPassword';
            try {
                await page.waitForSelector(passTabBtn, { state: 'visible', timeout: 10000 });
                await page.click(passTabBtn);
                await page.waitForTimeout(500);
            } catch (tabErr) {
                console.log("⚠️ לשונית סיסמה לא נמצאה או שכבר פעילה.");
            }

            const codeField = '#ctl00_cphBody__loginView_tbUserName';
            const passField = '#ctl00_cphBody__loginView_tbPassword';
            
            const idToType = String(config.userId || '');
            const codeToType = String(config.userCode || '');
            const passToType = String(config.password || '');

            // פונקציית עזר להקלדה אנושית
            const typeHumanLike = async (selector, text) => {
                await page.click(selector, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                for (const char of text) {
                    await page.keyboard.insertText(char);
                    await page.waitForTimeout(Math.floor(Math.random() * 100) + 100);
                }
            };

            await typeHumanLike(idField, idToType);
            await typeHumanLike(codeField, codeToType);
            await typeHumanLike(passField, passToType);

            const loginBtnSelector = '#ctl00_cphBody__loginView_btnSend';
            await page.click(loginBtnSelector);
            console.log("🚀 נשלחו פרטי התחברות...");
        } else {
            console.log("⚡ כבר מחובר! מדלג ישירות לתוך המערכת...");
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

        // --- לוגיקת החיפוש החכמה (תומכת בחיפוש לפי שם רופא ישירות) ---
        const sentInThisRun = new Set(); 
        
        // רשימת הרופאים לחיפוש (מנקה את ה-ID מהמחרוזת שנשמרת בדשבורד)
        const activeDoctorsNames = (config.selectedDoctors && config.selectedDoctors.length > 0)
            ? config.selectedDoctors.map(d => d.split(' - ')[1]) // לוקח רק את השם מתוך ה-Label
            : [];

        // רשימת הערים - אם אין רופאים ואין ערים, רק אז משתמש בברירת מחדל
        let citiesToSearch = config.selectedCities || [];
        if (citiesToSearch.length === 0 && activeDoctorsNames.length === 0) {
            citiesToSearch = ['הרצליה'];
        }

        // במידה ובחרנו רופאים, נחפש כל רופא בנפרד (בשדה שם הרופא)
        // במידה ולא, נחפש לפי הערים שנבחרו
        const searchItems = activeDoctorsNames.length > 0 ? activeDoctorsNames : citiesToSearch;
        const isDoctorSearch = activeDoctorsNames.length > 0;

        for (const item of searchItems) {
            console.log(`\n===================================`);
            console.log(`🔍 מתחיל חיפוש עבור ${isDoctorSearch ? 'רופא' : 'עיר'}: ${item}`);
            
            if (isDoctorSearch) {
                // חיפוש לפי שם רופא (נקה את שדה העיר כדי שלא יפריע)
                await target.evaluate(() => {
                    const cityInp = document.querySelector('#SelectedCityName');
                    const docInp = document.querySelector('#DoctorName');
                    if (cityInp) cityInp.value = '';
                    if (docInp) docInp.value = '';
                });
                await target.type('#DoctorName', item, { delay: 150 });
            } else {
                // חיפוש לפי עיר
                const cityInput = '#SelectedCityName';
                await target.click(cityInput);
                await target.evaluate((selector) => document.querySelector(selector).value = '', cityInput);
                await target.type(cityInput, item, { delay: 200 });
                await target.waitForSelector('li.ui-menu-item', { state: 'visible', timeout: 10000 });
                await page.keyboard.press('Enter');
            }

            await page.waitForTimeout(1000);
            await target.click('#searchBtnSpec');
            await page.waitForTimeout(8000); 
// בדיקה אם קפצה הודעה שאין תורים פנויים
           // זיהוי ההודעה ישירות דרך כפתור ה-X (ID: CloseButton)
            const closeBtn = await target.$('#CloseButton');
            if (closeBtn && await closeBtn.isVisible()) {
                console.log(`ℹ️ זוהתה הודעת 'אין תורים פנויים' ב-${city}. סוגר אותה כעת...`);
                try {
                    // לחיצה על ה-X בתוך הפריים
                    await closeBtn.click();
                    
                    // גיבוי: לחיצה כפויה דרך הדפדפן אם הכפתור חסום
                    await target.evaluate(() => {
                        const btn = document.getElementById('CloseButton');
                        if (btn) btn.click();
                    });

                    await page.waitForTimeout(1000);
                } catch (closeErr) {
                    console.log("⚠️ קושי טכני בסגירת החלון, מנסה להמשיך...");
                }
                
                // מתחשבים בצ'קבוקס: מדלגים רק אם *לא* ביקשנו יישובים בסביבה
                if (!config.includeSurrounding) {
                    console.log("🚫 לא הוגדרו יישובים בסביבה. מדלג לעיר הבאה.");
                    continue; 
                } else {
                    console.log("✅ מוגדר 'כולל יישובים בסביבה'. קורא את התוצאות שהופיעו מאחורי החלון...");
                }
            }
            let hasNextPage = true;
            let pageNum = 1;

            while (hasNextPage) {
                console.log(`📄 סורק דף תוצאות מספר ${pageNum} ב${city}...`);
                // הסרנו את הגדרת activeDoctorsFilter מכאן כי היא כבר הוגדרה למעלה
                // --- קוד דיבוג: צילום מסך ---
                await page.screenshot({ path: `debug_${city}_page_${pageNum}.png` });
                console.log(`📸 שמרתי צילום מסך בתיקייה הראשית: debug_${city}_page_${pageNum}.png`);
                // שולפים את כל המידע הגולמי מתוך הדף ללא שום סינון כדי להדפיס לטרמינל
               const rawDataFromPage = await target.evaluate(() => {
                    return Array.from(document.querySelectorAll('.diaryDoctor')).map(card => {
                        const addressText = card.querySelector('.clinicAddress')?.innerText || '';
                        // תיקון: שם העיר מופיע לרוב אחרי הפסיק (למשל: "דרך הבנים 17, פרדס חנה")
                        const parts = addressText.split(',');
                        const actualCity = parts.length > 1 ? parts[parts.length - 1].trim() : addressText.trim();

                        return {
                            docNameRaw: card.querySelector('.doctorName')?.innerText || 'לא נמצא שם',
                            dateTextRaw: card.querySelector('.visitDateTime')?.innerText || 'לא נמצא תאריך',
                            actualCity: actualCity || 'עיר לא ידועה'
                        };
                    });
                });

                console.log("\n--- תחילת הדפסת דיבוג: מה הבוט רואה כרגע בדף ---");
                const foundInPage = [];
                
                // עוברים על כל רופא שהבוט ראה, מדפיסים אותו, ומפעילים את הסינון שלנו מחוץ לדפדפן
                for (const item of rawDataFromPage) {
                    console.log(`* קורא כרטיסייה: שם: [${item.docNameRaw.trim()}], תאריך: [${item.dateTextRaw.trim()}]`);
                    
                    // תמיכה בפורמט תאריך עם נקודות (כמו 29.06.2026) או סלאשים (29/06/2026)
                    const match = item.dateTextRaw.match(/(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
                    
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

                    // סינון לפי עיר אם הצ'קבוקס כבוי (ותמיכה בתורים טלפוניים ללא ציון עיר)
                    if (!config.includeSurrounding && item.actualCity !== city && item.actualCity !== 'עיר לא ידועה' && !item.actualCity.includes('לא צויין')) {
                        console.log(`   -> דילגתי: התור בעיר ${item.actualCity} ולא ב-${city}, והצ'קבוקס כבוי.`);
                        continue;
                    }

                    // --- התיקון הקריטי: שמירת התאריך הנקי בלבד ---
                    // משתמשים במשתנה match שכבר יצרנו קודם כדי לקחת רק את התאריך הנקי (למשל "24.03.2026")
                    const cleanDate = match[0];

                    console.log(`   -> ✅ התור עבר את כל הסינונים וישלח למייל!`);
                    // מעבירים את cleanDate במקום את הטקסט הגולמי
                    foundInPage.push({ doctor: item.docNameRaw.trim(), dateStr: cleanDate, actualCity: item.actualCity });
                }
                console.log("--- סוף הדפסת דיבוג ---\n");

                if (foundInPage.length > 0) {
                    // קיבוץ ומציאת התור המוקדם ביותר *עבור כל רופא בנפרד* במקום רק תור אחד כללי
                    const bestApptsPerDoctor = {};
                    
                    for (const appt of foundInPage) {
                        const parseDate = (d) => {
                            const parts = d.split(/[\.\/]/);
                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        };
                        
                        if (!bestApptsPerDoctor[appt.doctor]) {
                            bestApptsPerDoctor[appt.doctor] = appt;
                        } else {
                            const currentBestDate = parseDate(bestApptsPerDoctor[appt.doctor].dateStr);
                            const newDate = parseDate(appt.dateStr);
                            if (newDate < currentBestDate) {
                                bestApptsPerDoctor[appt.doctor] = appt;
                            }
                        }
                    }

                    // מעבר על כל התורים הטובים ביותר של כל רופא בנפרד
                    for (const doctorName in bestApptsPerDoctor) {
                        const bestAppt = bestApptsPerDoctor[doctorName];
                        const key = `${bestAppt.doctor}-${bestAppt.dateStr}`;
                        
                        // שליחה רק אם התור הזה לא נשלח בסבב הנוכחי וגם טוב יותר מהזיכרון ההיסטורי
                        if (!sentInThisRun.has(key)) {
                            try {
                                if (isBetterAppointment(bestAppt.doctor, bestAppt.dateStr)) {
                                    // שליחה עם העיר האמיתית (actualCity) שנשלפה מהכרטיסייה
                                    await sendEmailNotification(bestAppt.doctor, bestAppt.actualCity, bestAppt.dateStr);
                                    updateMemory(bestAppt.doctor, bestAppt.dateStr, bestAppt.actualCity);

                                    const report = createExecutionReport(stats, {
                                        familyMember: config.familyMember || 'ראשי',
                                        specialization: config.selectedSpecialization || 'לא הוגדר',
                                        city: bestAppt.actualCity,
                                        doctor: bestAppt.doctor,
                                        dateStr: bestAppt.dateStr
                                    });
                                    console.log(report);
                                } else {
                                    console.log(`   -> נמצא תור ל-${bestAppt.doctor}, אך הוא אינו מוקדם יותר מהתור השמור בזיכרון.`);
                                }
                                sentInThisRun.add(key);
                            } catch (mailErr) {
                                console.error(`⚠️ שגיאה בעיבוד ושליחת התור הטוב ביותר עבור ${bestAppt.doctor}:`, mailErr.message);
                            }
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
    } finally {
        // כיבוי הנורה בדשבורד בסיום סבב הסריקה
        setBotStatus('idle');

        // בדיקה האם להפעיל סבב נוסף (לולאה) או לעצור
        const configRefresh = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        
        if (configRefresh.runInLoop) {
            const frequencyRange = configRefresh.loopFrequency || "10-15";
            console.log(`⏳ סבב הסתיים. הדפדפן נשאר פתוח. ממתין ${frequencyRange} דקות...`);
                        
            const continueLoop = await waitMinutes(frequencyRange);
            
            if (continueLoop) {
                console.log("🔄 מבצע רענון ומתחיל סבב חדש על אותו דפדפן...");
                // רענון קל כדי "להעיר" את הסשן לפני הסריקה
                await page.reload({ waitUntil: 'commit' }).catch(() => {});
                return runClalit(page); 
            }
        }
        console.log("🏁 הבוט סיים את עבודתו.");
    }
}

module.exports = { runClalit };