const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./constants/doctors_whitelist');
const fs = require('fs'); // נוסף כדי לאפשר קריאה של קובץ ה-config
// ייבוא מנגנוני הלולאה והדיווח מהספרייה החדשה
// ייבוא מנגנוני הלולאה, הדיווח והזיכרון (כולל בדיקת תאריך מוקדם)
const { setBotStatus, waitMinutes, isBetterAppointment, updateMemory } = require('../../utils/scheduler/loopManager');
const { createExecutionReport } = require('../../utils/scheduler/reportGenerator');
// פונקציה לזיהוי ולהתאוששות מדף שגיאה של כללית
async function handleResponseSorry(page, targetUrl) {
    const currentUrl = page.url();
    console.log(`🌐 [URL-CHECK] כתובת נוכחית: ${currentUrl}`);
    if (currentUrl.includes('ResponseSorry')) {
        console.log('⚠️ זוהה דף שגיאה (ResponseSorry). מנקה עוגיות ומאתחל סשן חדש...');
        // ניקוי עוגיות כדי לאפס את הסשן המת ולקבל דף לוגין נקי
        const context = page.context();
        await context.clearCookies();
        console.log('🍪 עוגיות נוקו. מנווט מחדש...');
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        const urlAfter = page.url();
        console.log(`🌐 [URL-AFTER-RECOVERY] כתובת אחרי ניקוי: ${urlAfter}`);
        return true;
    }
    return false;
}
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

const MAIN_URL = 'https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsSpecials.aspx';
    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");
   try {
        // בדיקה אם אנחנו כבר מחוברים בדף שירותי האון-ליין (חוסך טעינה מחדש)
const currentUrlAtStart = page.url();
        console.log(`🌐 [START] כתובת בתחילת הסבב: ${currentUrlAtStart}`);
        
        // אם אנחנו בדף שגיאה - נווט קודם ל-MAIN_URL לפני שבודקים isLoggedIn
        if (currentUrlAtStart.includes('ResponseSorry') || currentUrlAtStart === 'about:blank') {
            console.log("🔄 מתחיל מדף שגיאה/ריק – מנווט ל-MAIN_URL לפני בדיקת לוגין...");
            await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
            console.log(`🌐 [AFTER-GOTO] כתובת אחרי ניווט: ${page.url()}`);
        }

        const isLoggedIn = await page.$('text="שירותי האון־ליין"').catch(() => null);
        console.log(`🔐 [LOGIN-CHECK] מחובר? ${isLoggedIn ? 'כן' : 'לא'}`);
        
        if (!isLoggedIn) {
            console.log("🛡️ לא מזוהה סשן פעיל, טוען דף כניסה או מרענן...");
            await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            await handleResponseSorry(page, MAIN_URL);
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
     await page.evaluate(() => {
    setInterval(() => {
        const continueButton = document.querySelector('#ctl00_ctl00_LogOutTimeOut_btnMasterOk_lnkSubButton');
        if (continueButton) {
            const rect = continueButton.getBoundingClientRect();
            const isVisible = rect.width > 0 || rect.height > 0 || continueButton.offsetParent !== null;
            if (isVisible) {
                console.log('מזהה פופאפ חוסר פעילות של הכללית, לוחץ על המשך...');
                continueButton.click();
                return;
            }
        }
        // גיבוי - חיפוש לפי טקסט "המשך" אם ה-ID לא עובד
        const allLinks = Array.from(document.querySelectorAll('a, button'));
        const continueByText = allLinks.find(el => el.innerText && el.innerText.trim() === 'המשך');
        if (continueByText) {
            console.log('מזהה פופאפ חוסר פעילות (לפי טקסט), לוחץ על המשך...');
            continueByText.click();
        }
    }, 3000); // כל 3 שניות
});
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

        // 1. הגדרת המשתנים קודם כדי למנוע שגיאת undefined
        const groupId = config.selectedGroup || '32';
        const specId = config.selectedSpecialization || groupId;

        console.log(`🔍 מפעיל חיפוש: קבוצה ${groupId}, מקצוע ${specId}`);
        
        // 2. בחירת קבוצה ומקצוע
        await target.selectOption('#SelectedGroupCode', groupId);
        await page.waitForTimeout(3000); 
        await target.selectOption('#SelectedSpecializationCode', specId);
        
        // 3. המתנה קצרה לרינדור השדות וביצוע בדיקת דיבוג מעודכנת
        await page.waitForTimeout(2000);
        const debugFields = await target.evaluate(() => {
            const doc = document.querySelector('#DoctorName');
            const city = document.querySelector('#SelectedCityName');
            return {
                doctorFieldExists: !!doc,
                cityFieldExists: !!city,
                docVisible: doc ? (doc.offsetWidth > 0 && doc.offsetHeight > 0) : false,
                docId: doc ? doc.id : 'n/a'
            };
        });
        console.log("🔍 [DEBUG] מצב שדות לאחר בחירת מקצוע:", debugFields);
        await target.selectOption('#SelectedGroupCode', groupId);
        
        // המתנה לשינוי ב-DOM של רשימת המקצועות
        await page.waitForTimeout(3000); 
        await target.selectOption('#SelectedSpecializationCode', specId);
        await page.waitForTimeout(1000);

        // --- לוגיקת החיפוש החכמה (תומכת בחיפוש לפי שם רופא ישירות) ---
        const sentInThisRun = new Set(); 
        
        // רשימת הרופאים לחיפוש (משתמש במערך השמות הנקיים שיצרנו בדשבורד)
        const activeDoctorsNames = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0)
            ? config.selectedDoctorNames
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

       // --- התיקון הקריטי: הגדרת רשימת הרופאים לסינון ---
        // סינון התוצאות שנשאבו מהדף חייב להתבצע מול שמות הרופאים (ולא מול ה-ID שלהם)
        const activeDoctorsFilter = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0)
            ? config.selectedDoctorNames
            : [];

        for (const item of searchItems) {
            console.log(`\n===================================`);
            console.log(`🔍 מתחיל חיפוש עבור ${isDoctorSearch ? 'רופא' : 'עיר'}: ${item}`);
            
            if (isDoctorSearch) {
                console.log(`🔎 מזהה שדה 'שם הרופא' ומזין: ${item}...`);
                
                // מציאת ה-ID של שדה הרופא בצורה דינמית על סמך הטקסט "שם הרופא/ה" בטבלה
                const dynamicDocInputId = await target.evaluate(() => {
                    const tds = Array.from(document.querySelectorAll('td.title'));
                    const docTd = tds.find(td => td.textContent && td.textContent.includes('שם הרופא/ה'));
                    if (docTd && docTd.parentElement) {
                        const input = docTd.parentElement.querySelector('input[type="text"]');
                        if (input && input.id) return '#' + input.id;
                    }
                    return null;
                });

                if (!dynamicDocInputId) {
                    console.log("❌ שגיאה: לא מצאתי את שדה 'שם הרופא/ה' במסך. מדלג...");
                    continue; 
                }

                // ניקוי שדות אחרים (עיר) כדי שלא יפריעו
                await target.evaluate(() => {
                    const cityInp = document.querySelector('#SelectedCityName');
                    if (cityInp) cityInp.value = '';
                });

                // פוקוס, ניקוי והקלדה מבוקרת בשדה הרופא
                await target.click(dynamicDocInputId, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await target.type(dynamicDocInputId, item, { delay: 150 });
           } else {
               // חיפוש לפי עיר - ניקוי עמוק למניעת שרשור שמות ערים
                const cityInput = '#SelectedCityName';
                
                // גלילה למעלה כדי לוודא ששדה החיפוש גלוי
                await target.evaluate(() => window.scrollTo(0, 0));
                await page.waitForTimeout(500);
                
                // ניקוי עמוק של השדה הכולל בחירה מרובה, מחיקה במקלדת ורענון אירועים
                await target.click(cityInput, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await target.evaluate((selector) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, cityInput);
                await page.waitForTimeout(500);

                console.log(`🔎 מזין עיר: ${item}...`);
                await target.type(cityInput, item, { delay: 250 });
                

                // המתנה להופעת התפריט ובחירה מתוכו
                await target.waitForSelector('li.ui-menu-item', { state: 'visible', timeout: 15000 });
                await page.waitForTimeout(1000);

                const clicked = await target.evaluate((cityName) => {
                    const items = Array.from(document.querySelectorAll('li.ui-menu-item'));
                    const match = items.find(i => i.innerText.trim() === cityName);
                    if (match) {
                        match.click();
                        return true;
                    }
                    return false;
                }, item);

                if (!clicked) {
                    console.log(`⚠️ לא נמצאה התאמה מדויקת ל-'${item}' ברשימה, מנסה Enter.`);
                    await page.keyboard.press('Enter');
                }
            }

            await page.waitForTimeout(1000);
            await target.click('#searchBtnSpec');
            await page.waitForTimeout(8000); 
            // בדיקת ResponseSorry אחרי לחיצה על חיפוש
            if (await handleResponseSorry(page, MAIN_URL)) {
                console.log('🔄 הדף חזר לאחר שגיאה – מפסיק חיפוש נוכחי וממשיך לפריט הבא.');
                continue;
            }
// בדיקה אם קפצה הודעה שאין תורים פנויים
           // זיהוי ההודעה ישירות דרך כפתור ה-X (ID: CloseButton)
            const closeBtn = await target.$('#CloseButton');
            if (closeBtn && await closeBtn.isVisible()) {
                console.log(`ℹ️ זוהתה הודעת 'אין תורים פנויים' עבור: ${item}. סוגר אותה כעת...`);
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
                console.log(`📄 סורק דף תוצאות מספר ${pageNum} עבור ${item}...`);
                // הסרנו את הגדרת activeDoctorsFilter מכאן כי היא כבר הוגדרה למעלה
                // --- קוד דיבוג: צילום מסך ---
                await page.screenshot({ path: `debug_${item}_page_${pageNum}.png` });
                console.log(`📸 שמרתי צילום מסך בתיקייה הראשית: debug_${item}_page_${pageNum}.png`);
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
                
                // עוברים על כל תור שהבוט ראה, מדפיסים אותו, ומפעילים את הסינון
                // שינינו את שם המשתנה ל-appt כדי לא לדרוס את המשתנה item של העיר מהלולאה החיצונית
                for (const appt of rawDataFromPage) {
                    console.log(`* קורא כרטיסייה: שם: [${appt.docNameRaw.trim()}], תאריך: [${appt.dateTextRaw.trim()}]`);
                    
                    // תמיכה בפורמט תאריך עם נקודות או סלאשים
                    const match = appt.dateTextRaw.match(/(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
                    
                    if (!match) {
                        console.log(`   -> דילגתי: לא הצלחתי למצוא מבנה של תאריך מלא בטקסט הזה.`);
                        continue;
                    }
                    
                    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                    const inRange = !config.endDate || (isoDate <= config.endDate);
                    
                    if (!inRange) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} מאוחר מתאריך היעד.`);
                        continue;
                    }
                    
                    const isPreferred = activeDoctorsFilter.length === 0 || activeDoctorsFilter.some(name => appt.docNameRaw.includes(name));
                    
                    if (!isPreferred) {
                        console.log(`   -> דילגתי: הרופא אינו ברשימת המועדפים.`);
                        continue;
                    }

                    // סינון לפי עיר אם הצ'קבוקס כבוי - עכשיו משווים ל-item התקין
                    if (!config.includeSurrounding && appt.actualCity !== item && appt.actualCity !== 'עיר לא ידועה' && !appt.actualCity.includes('לא צויין')) {
                        console.log(`   -> דילגתי: התור בעיר ${appt.actualCity} ולא ב-${item}, והצ'קבוקס כבוי.`);
                        continue;
                    }

                    const cleanDate = match[0];

                    console.log(`   -> ✅ התור עבר את כל הסינונים וישלח למייל!`);
                    foundInPage.push({ doctor: appt.docNameRaw.trim(), dateStr: cleanDate, actualCity: appt.actualCity });
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
                    console.log(`🏁 סיימתי לסרוק את כל הדפים עבור: ${item}.`);
                    hasNextPage = false;
                }
            }
            
            // חזרה לראש הדף ואיפוס השדה כהכנה לעיר הבאה
            await target.evaluate((sel) => {
                window.scrollTo(0, 0);
                const el = document.querySelector(sel);
                if (el) el.value = '';
            }, '#SelectedCityName');
            
            await page.waitForTimeout(2000);
        }

       console.log(`\n✅ סריקת כל הערים והדפים הסתיימה!`);

   } catch (error) {
        console.error("❌ שגיאה במהלך הבוט:", error.message);
        // אם הבעיה היא ResponseSorry או timeout – מנסה לחזור מיד לסבב חדש
        const currentUrl = page.url();
        if (currentUrl.includes('ResponseSorry') || error.message.includes('Timeout')) {
            console.log('🔄 זוהתה שגיאת סשן – מנקה עוגיות ומתחיל סבב חדש מיד...');
            try {
                await page.context().clearCookies();
                await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            } catch (e) {}
            setBotStatus('idle');
            return runClalit(page);
        }
    } finally {
        // כיבוי הנורה בדשבורד בסיום סבב הסריקה
        setBotStatus('idle');

        // בדיקה האם להפעיל סבב נוסף (לולאה) או לעצור
        const configRefresh = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        
        if (configRefresh.runInLoop) {
    const frequencyRange = configRefresh.loopFrequency || "10-15";
            console.log(`⏳ סבב הסתיים. הדפדפן נשאר פתוח. ממתין ${frequencyRange} דקות...`);

          // keepalive - מחכה בלולאה ושולח בקשה באופן רנדומלי
            const [totalMin, totalMax] = frequencyRange.split('-').map(Number);
            const totalWaitMs = (Math.floor(Math.random() * (totalMax - totalMin + 1)) + totalMin) * 60 * 1000;
            console.log(`🎲 נבחר זמן המתנה אקראי של ${totalWaitMs / 60000} דקות לסבב זה.`);

            // שמירת זמן הריצה הבא ב-config כדי שהדשבורד יציג אותו נכון
            try {
                const cfgForTimer = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                cfgForTimer.nextRunTime = Date.now() + totalWaitMs;
                fs.writeFileSync('./config.json', JSON.stringify(cfgForTimer, null, 2));
            } catch (e) {}

            let elapsed = 0;
            while (elapsed < totalWaitMs) {
                // זמן המתנה רנדומלי בין 90 ל-150 שניות כדי לא להיראות מכאני
                const randomWait = (Math.floor(Math.random() * 61) + 90) * 1000;
                const sleepTime = Math.min(randomWait, totalWaitMs - elapsed);
                await new Promise(resolve => setTimeout(resolve, sleepTime));
                elapsed += sleepTime;

                if (elapsed < totalWaitMs) {
                    console.log(`💓 [KEEPALIVE] פועל... (${new Date().toLocaleTimeString()})`);
                    try {
                        const currentUrl = page.url();
                        console.log(`🌐 [KEEPALIVE] כתובת נוכחית: ${currentUrl}`);
                        if (!currentUrl.includes('ResponseSorry')) {
                            // לחיצה על כפתור המשך אם קיים - מחוץ לדפדפן דרך Playwright
                            const popupBtn = await page.$('#ctl00_ctl00_LogOutTimeOut_btnMasterOk_lnkSubButton');
                            if (popupBtn) {
                                const isVisible = await popupBtn.isVisible().catch(() => false);
                                if (isVisible) {
                                    console.log(`🖱️ [KEEPALIVE] מזהה פופאפ – לוחץ על המשך...`);
                                    await popupBtn.click().catch(() => {});
                                }
                            }
                            // דפיקה קלה על השרת
                            await page.evaluate(() => {
                                fetch('/OnlineWeb/Services/Appointments/AppointmentsSpecials.aspx', { method: 'HEAD' }).catch(() => {});
                            });
                            console.log(`✅ [KEEPALIVE] בקשה נשלחה לשרת בהצלחה`);
                        } else {
                            console.log(`⚠️ [KEEPALIVE] דף שגיאה פעיל – לא שולח בקשה`);
                        }
                    } catch (e) {
                        console.log('⚠️ [KEEPALIVE] שגיאה:', e.message);
                    }
                }
            }

            const continueLoop = true; // המתנה הסתיימה, ממשיכים לסבב הבא
    if (continueLoop) {
                console.log("🔄 מבצע רענון ומתחיל סבב חדש על אותו דפדפן...");
                await page.reload({ waitUntil: 'commit' }).catch(() => {});
                await handleResponseSorry(page, MAIN_URL);
                return runClalit(page); 
            }
  console.log("🏁 הבוט סיים את עבודתו.");
        }
    } // סוף finally
} // סוף runClalit

module.exports = { runClalit };