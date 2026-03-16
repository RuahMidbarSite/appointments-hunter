const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./constants/doctors_whitelist');
const fs = require('fs');
const path = require('path');
const { setBotStatus, waitMinutes, isBetterAppointment, updateMemory } = require('../../utils/scheduler/loopManager');
const { createExecutionReport } = require('../../utils/scheduler/reportGenerator');

// פונקציה לזיהוי ולהתאוששות מדף שגיאה של כללית
async function handleResponseSorry(page, targetUrl) {
    const currentUrl = page.url();
    console.log(`🌐 [URL-CHECK] כתובת נוכחית: ${currentUrl}`);
    if (currentUrl.includes('ResponseSorry')) {
        console.log('⚠️ זוהה דף שגיאה (ResponseSorry). מנקה עוגיות ומאתחל סשן חדש...');
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

// פונקציה להתחברות עם קוד חד-פעמי SMS + קפצ'ה אוטומטית
async function loginWithSMS(page, config) {
    console.log('📱 [SMS-LOGIN] מתחיל תהליך התחברות עם קוד חד-פעמי...');

   // לחיצה על לשונית "קוד חד-פעמי לנייד"
    try {
        await page.waitForSelector('#ctl00_cphBody__loginView_btnSendSMS', { state: 'visible', timeout: 10000 });
        await page.click('#ctl00_cphBody__loginView_btnSendSMS');
        await page.waitForTimeout(300);
        console.log('✅ [SMS-LOGIN] לשונית קוד חד-פעמי נבחרה');
    } catch (e) {
        console.log('⚠️ [SMS-LOGIN] לא הצלחתי ללחוץ על לשונית SMS:', e.message);
    }

    // מזין תעודת זהות
    const idField = '#ctl00_cphBody__loginView_tbUserId';
    await page.waitForSelector(idField, { visible: true, timeout: 10000 });
    await page.click(idField, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    for (const char of String(config.userId || '')) {
        await page.keyboard.insertText(char);
        await page.waitForTimeout(Math.floor(Math.random() * 80) + 80);
    }
    console.log('✅ [SMS-LOGIN] תעודת זהות הוזנה');

    // מצלם את תמונת הקפצ'ה
    const captchaPath = path.join('.', 'captcha_temp.png');
    try {
        // מנסה למצוא את אלמנט הקפצ'ה לפי סלקטורים אפשריים
const captchaEl = await page.$(
            '#c_general_login_ctl00_cphbody__loginview_captchalogin_CaptchaImage'
        );
        if (captchaEl) {
            await captchaEl.screenshot({ path: captchaPath });
            console.log('📸 [SMS-LOGIN] קפצ\'ה צולמה בהצלחה');
        } else {
            // גיבוי – צילום מסך מלא
            await page.screenshot({ path: captchaPath });
            console.log('📸 [SMS-LOGIN] לא נמצא אלמנט קפצ\'ה – צולם מסך מלא');
        }
    } catch (e) {
        await page.screenshot({ path: captchaPath });
        console.log('📸 [SMS-LOGIN] שגיאה בצילום קפצ\'ה, נשמר מסך מלא:', e.message);
    }

    // שולח לפענוח AI עם ניסיונות חוזרים
    let captchaText = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        captchaText = await solveCaptcha(captchaPath);
        if (captchaText && captchaText.length >= 4) {
            console.log(`✅ [SMS-LOGIN] קפצ\'ה פוענחה (ניסיון ${attempt}): ${captchaText}`);
            break;
        }
        console.log(`⚠️ [SMS-LOGIN] פענוח קפצ\'ה נכשל בניסיון ${attempt}, מנסה שוב...`);
        await page.waitForTimeout(2000);

        // רענון קפצ'ה אם יש כפתור
        try {
            const refreshCaptcha = await page.$('img[onclick*="captcha" i], a[onclick*="captcha" i], .captchaRefresh');
            if (refreshCaptcha) {
                await refreshCaptcha.click();
                await page.waitForTimeout(1500);
                const captchaEl = await page.$('#ctl00_cphBody__loginView_CaptchaImage, img[src*="captcha" i]');
                if (captchaEl) await captchaEl.screenshot({ path: captchaPath });
            }
        } catch (e) {}
    }

    if (!captchaText) {
        console.log('❌ [SMS-LOGIN] לא הצלחתי לפענח קפצ\'ה אחרי 3 ניסיונות');
        return false;
    }

    // מזין את הקפצ'ה בשדה המתאים
    try {
const captchaInput = await page.$('#ctl00_cphBody__loginView_tbCaptchaLogin');
        if (captchaInput) {
            await captchaInput.click({ clickCount: 3 });
            await captchaInput.type(captchaText, { delay: 100 });
            console.log('✅ [SMS-LOGIN] קפצ\'ה הוזנה בשדה');
        } else {
            console.log('⚠️ [SMS-LOGIN] לא נמצא שדה קפצ\'ה');
        }
    } catch (e) {
        console.log('⚠️ [SMS-LOGIN] שגיאה בהזנת קפצ\'ה:', e.message);
    }

   // לוחץ "שלחו לי קוד ב-SMS"
    try {
        await page.waitForSelector('#ctl00_cphBody__loginView_lblSendOTP', { state: 'visible', timeout: 10000 });
        await page.click('#ctl00_cphBody__loginView_lblSendOTP');
        console.log('📤 [SMS-LOGIN] לחצתי על שלח SMS – ממתין שהמשתמש יזין את הקוד בדפדפן...');
    } catch (e) {
        console.log('⚠️ [SMS-LOGIN] שגיאה בלחיצה על שלח SMS:', e.message);
        return false;
    }

    return true;
}

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmailNotification(docName, city, dateStr, targetEmail) {
    // שימוש באימייל מהדשבורד, ואם הוא ריק - גיבוי לאימייל הראשי של השרת
    const recipient = targetEmail || process.env.EMAIL_USER;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipient,
        subject: `🚨 תור פנוי: ${docName} ב${city}!`,
        text: `הבוט מצא תור פנוי אצל ${docName} בעיר ${city}.\nתאריך התור: ${dateStr}\n\nהיכנס מיד לאתר כללית לקבוע אותו!`
    };
    await transporter.sendMail(mailOptions);
}

async function runClalit(page) {
    setBotStatus('active');
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    
    // משתנה שישמור את התור המוקדם ביותר שנמצא *רק בסבב הנוכחי* לצורך שליחת מייל בסיום
    let bestApptForEmailThisRun = null;
    const stats = { startTime: new Date() };

    const MAIN_URL = 'https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsSpecials.aspx';
    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");

    try {
        const currentUrlAtStart = page.url();
        console.log(`🌐 [START] כתובת בתחילת הסבב: ${currentUrlAtStart}`);
        
        if (currentUrlAtStart.includes('ResponseSorry') || currentUrlAtStart === 'about:blank') {
            console.log("🔄 מתחיל מדף שגיאה/ריק – מנווט ל-MAIN_URL לפני בדיקת לוגין...");
            await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
            console.log(`🌐 [AFTER-GOTO] כתובת אחרי ניווט: ${page.url()}`);
        }

        const isLoggedIn = await page.$('text="שירותי האון־ליין"').catch(() => null);
        console.log(`🔐 [LOGIN-CHECK] מחובר? ${isLoggedIn ? 'כן' : 'לא'}`);
        
        if (!isLoggedIn) {
    const currentUrl = page.url();
    if (!currentUrl.includes('e-services.clalit.co.il')) {
        console.log("🛡️ לא מזוהה סשן פעיל ולא על אתר כללית – מנווט...");
        await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
        await handleResponseSorry(page, MAIN_URL);
    } else {
        console.log("🛡️ לא מחובר אך כבר על אתר כללית – לא מרענן.");
    }
} else {
    console.log("⚡ נמצא סשן פעיל! ממשיך לסריקה ללא לוגין מחדש.");
}

        const idField = '#ctl00_cphBody__loginView_tbUserId';
        const needsLogin = await page.waitForSelector(idField, { visible: true, timeout: 5000 }).catch(() => null);

        if (needsLogin) {
            const loginMode = config.loginMode || 'password';
            console.log(`🔑 נדרש לוגין – מצב: ${loginMode === 'sms' ? 'קוד חד-פעמי SMS' : 'קוד משתמש וסיסמה'}`);

            if (loginMode === 'sms') {
                // --- התחברות עם SMS ---
                const smsSent = await loginWithSMS(page, config);
                if (!smsSent) {
                    console.log('❌ שליחת SMS נכשלה. עוצר סבב זה.');
                    return;
                }
                // ממתין שהמשתמש יזין את קוד ה-SMS בדפדפן (עד 5 דקות)
                console.log('⏳ [SMS-LOGIN] ממתין שהמשתמש יזין את קוד ה-SMS בדפדפן...');
                await page.waitForSelector('text="שירותי האון־ליין"', { timeout: 300000 });
                console.log('✅ [SMS-LOGIN] הכניסה הצליחה!');

            } else {
                // --- התחברות רגילה עם סיסמה ---
                const passTabBtn = '#ctl00_cphBody__loginView_btnPassword';
                try {
                    await page.waitForSelector(passTabBtn, { state: 'visible', timeout: 1500 });
                    await page.click(passTabBtn);
await page.waitForSelector(idField, { state: 'visible', timeout: 5000 });
                } catch (tabErr) {
                    console.log("⚠️ לשונית סיסמה לא נמצאה או שכבר פעילה.");
                }

                const codeField = '#ctl00_cphBody__loginView_tbUserName';
                const passField = '#ctl00_cphBody__loginView_tbPassword';
                
                const idToType = String(config.userId || '');
                const codeToType = String(config.userCode || '');
                const passToType = String(config.password || '');

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
            }
        } else {
            console.log("⚡ כבר מחובר! מדלג ישירות לתוך המערכת...");
        }

        console.log("--------------------------------------------------");
        console.log("ממתין לסיום תהליך ההתחברות...");
        await page.waitForSelector('text="שירותי האון־ליין"', { timeout: 300000 });

        // 1. התיקון לפופאפ (לחיצה אגרסיבית עוקפת שכבות)
        await page.evaluate(() => {
            setInterval(() => {
                const continueBtn = document.querySelector('#ctl00_ctl00_LogOutTimeOut_btnMasterOk_lnkSubButton');
                if (continueBtn && continueBtn.offsetParent !== null) {
                    console.log('🚨 [POPUP-FIX] נמצא פופאפ - מבצע לחיצה ישירה...');
                    continueBtn.click();
                    return;
                }
                const allLinks = Array.from(document.querySelectorAll('a.lnkSubButton, button'));
                const backupBtn = allLinks.find(el => el.innerText && el.innerText.includes('המשך'));
                if (backupBtn && backupBtn.offsetParent !== null) {
                    console.log('🚨 [POPUP-FIX] נמצא כפתור "המשך" לפי טקסט - מבצע לחיצה...');
                    backupBtn.click();
                }
            }, 3000);
        });

        // פונקציית עזר לאיתור אלמנטים (גם בתוך iframe)
        async function getTargetElement(selector) {
            if (await page.$(selector).catch(() => null)) return page;
            for (const frame of page.frames()) {
                if (await frame.$(selector).catch(() => null)) return frame;
            }
            return null;
        }

        const groupId = config.selectedGroup || '32';
        const specId = config.selectedSpecialization || groupId;
        
        // 2. הבדיקה: האם אנחנו כבר בדף החיפוש הפעיל?
        let target = await getTargetElement('#SelectedCityName');

        if (target) {
            console.log("⚡ [STATE] סבב שני ומעלה: הטופס כבר פתוח. מדלג על ניווט ובחירת פרופיל וממשיך ישירות להזנת העיר.");
        } else {
            console.log("🔄 [STATE] סבב ראשון: מתחיל תהליך בחירת פרופיל וניווט...");

            // ----- תחילת הקוד המקורי שעובד לך -----
            if (config.familyMember && config.familyMember.trim() !== '') {
                console.log(`👨‍👩‍👧 מנסה לעבור לתיק של בת המשפחה: ${config.familyMember}`);
                try {
                    const memberText = config.familyMember.trim();
                    await page.waitForSelector(`text="${memberText}"`, { state: 'visible', timeout: 15000 });
                    await page.click(`text="${memberText}"`);
                    console.log(`✅ עברתי בהצלחה לתיק של ${memberText}`);
                    await page.waitForTimeout(6000);
                } catch (err) {
                    console.log(`⚠️ לא הצלחתי למצוא או ללחוץ על השם '${config.familyMember}'. ממשיך בתיק הראשי.`);
                }
            }

            await page.click('text="שירותי האון־ליין"').catch(() => {});
            await page.waitForTimeout(2500);
            await page.click('a[title="זימון תורים"]').catch(() => {});

            target = await getTargetElement('#ProfessionVisitButton');
            if (!target) { 
                await page.waitForTimeout(6000); 
                target = await getTargetElement('#ProfessionVisitButton'); 
            }

            if (target) {
                await target.click('#ProfessionVisitButton');
                await target.waitForSelector('#SelectedGroupCode', { timeout: 20000 });

                console.log(`🔍 מפעיל חיפוש: קבוצה ${groupId}, מקצוע ${specId}`);
                await target.selectOption('#SelectedGroupCode', groupId);
                await page.waitForTimeout(3000); 
                await target.selectOption('#SelectedSpecializationCode', specId);
                await page.waitForTimeout(1000);
            } else {
                console.log("❌ לא נמצא כפתור 'ProfessionVisitButton', מנסה להמשיך...");
                target = page; // fallback למניעת קריסה
            }
            // ----- סוף הקוד המקורי שעובד לך -----
        }

        const sentInThisRun = new Set(); 
        
        const activeDoctorsNames = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0)
            ? config.selectedDoctorNames
            : [];

        let citiesToSearch = config.selectedCities || [];
        if (citiesToSearch.length === 0 && activeDoctorsNames.length === 0) {
            citiesToSearch = ['הרצליה'];
        }

        const searchItems = activeDoctorsNames.length > 0 ? activeDoctorsNames : citiesToSearch;
        const isDoctorSearch = activeDoctorsNames.length > 0;

        const activeDoctorsFilter = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0)
            ? config.selectedDoctorNames
            : [];

       for (const item of searchItems) {
            // בדיקה האם המשתמש לחץ על 'עצור' בדשבורד לפני שעוברים לעיר/רופא הבא
            const stopCheck = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            // עוצר רק אם המשתמש לחץ "עצור" (גם הלולאה כבויה וגם הסטטוס במנוחה)
            // זה מונע עצירה בטעות של כפתור "בדיקה" שבו הלולאה כבויה אבל הסטטוס פעיל
            if (stopCheck.runInLoop === false && stopCheck.botStatus === 'idle') {
                console.log("🛑 זיהיתי פקודת עצירה מהדשבורד. מפסיק את הסבב הנוכחי...");
                break; 
            }

            console.log(`\n===================================`);
            console.log(`🔍 מתחיל חיפוש עבור ${isDoctorSearch ? 'רופא' : 'עיר'}: ${item}`);
            if (isDoctorSearch) {
                console.log(`🔎 מזהה שדה 'שם הרופא' ומזין: ${item}...`);
                
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

                await target.evaluate(() => {
                    const cityInp = document.querySelector('#SelectedCityName');
                    if (cityInp) cityInp.value = '';
                });

                await target.click(dynamicDocInputId, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await target.type(dynamicDocInputId, item, { delay: 150 });

            } else {
                const cityInput = '#SelectedCityName';
                
                await target.click(cityInput, { clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(300);

                console.log(`🔎 מזין עיר: ${item}...`);
                await target.type(cityInput, item, { delay: 250 });

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

            if (await handleResponseSorry(page, MAIN_URL)) {
                console.log('🔄 הדף חזר לאחר שגיאה – מפסיק חיפוש נוכחי וממשיך לפריט הבא.');
                continue;
            }

            const closeBtn = await target.$('#CloseButton');
            if (closeBtn && await closeBtn.isVisible()) {
                console.log(`ℹ️ זוהתה הודעת 'אין תורים פנויים' עבור: ${item}. סוגר אותה כעת...`);
                try {
                    await closeBtn.click();
                    await target.evaluate(() => {
                        const btn = document.getElementById('CloseButton');
                        if (btn) btn.click();
                    });
                    await page.waitForTimeout(1000);
                } catch (closeErr) {
                    console.log("⚠️ קושי טכני בסגירת החלון, מנסה להמשיך...");
                }
                
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
              //  await page.screenshot({ path: `debug_${item}_page_${pageNum}.png` });
                console.log(`📸 שמרתי צילום מסך בתיקייה הראשית: debug_${item}_page_${pageNum}.png`);

                const rawDataFromPage = await target.evaluate((searchedItem) => {
                    return Array.from(document.querySelectorAll('.diaryDoctor')).map(card => {
                        const addressText = card.querySelector('.clinicAddress')?.innerText || '';
                        const detailsText = card.querySelector('.clinicDetails')?.innerText || '';
                        
                        let actualCity = '';
                        
                        // 1. ניסיון חילוץ מהכתובת הרגילה (למשל: "רחוב, עיר")
                        const addrParts = addressText.split(',').map(p => p.trim());
                        if (addrParts.length >= 2) {
                            actualCity = addrParts[addrParts.length - 1];
                        } 
                        // 2. ניסיון חילוץ מהאלמנט החדש ששלחת (למשל: "כתובת: רחוב, עיר")
                        else if (detailsText.includes(',')) {
                            const detailParts = detailsText.split(',').map(p => p.trim());
                            actualCity = detailParts[detailParts.length - 1];
                        }
                        // 3. גיבוי - שימוש בערך שחיפשנו (item) אם האתר לא הציג כלום
                        else {
                            actualCity = searchedItem || 'עיר לא צוינה';
                        }

                        return {
                            docNameRaw: card.querySelector('.doctorName')?.innerText || 'לא נמצא שם',
                            dateTextRaw: card.querySelector('.visitDateTime')?.innerText || 'לא נמצא תאריך',
                            actualCity: actualCity
                        };
                    });
                }, item); // העברת item לתוך ה-evaluate

                console.log("\n--- תחילת הדפסת דיבוג: מה הבוט רואה כרגע בדף ---");
                const foundInPage = [];
                
                for (const appt of rawDataFromPage) {
                    console.log(`* קורא כרטיסייה: שם: [${appt.docNameRaw.trim()}], תאריך: [${appt.dateTextRaw.trim()}]`);
                    
                    const match = appt.dateTextRaw.match(/(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
                    
                    if (!match) {
                        console.log(`   -> דילגתי: לא הצלחתי למצוא מבנה של תאריך מלא בטקסט הזה.`);
                        continue;
                    }
                    
                   const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                    
                    // 1. בדיקה האם התאריך כבר עבר (הגנה מתור ישן)
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (isoDate < todayStr) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} כבר עבר (היום ${todayStr}).`);
                        continue;
                    }

                    // 2. בדיקה האם התאריך בטווח היעד שהוגדר
                    const inRange = !config.endDate || (isoDate <= config.endDate);
                    if (!inRange) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} מאוחר מתאריך היעד.`);
                        continue;
                    }
                    
                    // הדפסת דיבוג: מה יש ברשימת המועדפים ומה מצאנו באתר
                    console.log(`    [DEBUG] בודק רופא מהאתר: "${appt.docNameRaw}"`);
                    console.log(`    [DEBUG] מועדפים מהדשבורד: ${JSON.stringify(activeDoctorsFilter)}`);

                    let matchedDashboardName = appt.docNameRaw.trim(); // ברירת מחדל
                    let isPreferred = activeDoctorsFilter.length === 0;

                    if (activeDoctorsFilter.length > 0) {
                        for (const prefName of activeDoctorsFilter) {
                            const cleanPref = prefName.replace(/ד"ר|דר'|\(כללית\)|\(מושלם\)/g, '').replace(/[()]/g, '').trim();
                            const prefWords = cleanPref.split(/\s+/).filter(word => word.length > 1);
                            const cleanSiteName = appt.docNameRaw.replace(/ד"ר|דר'/g, '').trim();
                            
                            // פונקציית עזר שמתעלמת מהאותיות י' ו-ו' כדי לפתור הבדלי כתיב מלא/חסר
                            const normalizeHeb = (str) => str.replace(/[יו]/g, '');
                            
                            // משווים כעת את הגרסאות "הנקיות" ללא אותיות אהו"י
                            if (prefWords.every(word => normalizeHeb(cleanSiteName).includes(normalizeHeb(word)))) {
                                isPreferred = true;
                                // קסם: מעדכנים את השם לזה שמוגדר בדשבורד כדי שהמערכת תזהה אותו!
                                matchedDashboardName = prefName; 
                                break;
                            }
                        }
                    }

                    if (!isPreferred) {
                        console.log(`    -> דילגתי: הרופא אינו ברשימת המועדפים (לא נמצאה התאמה למילים).`);
                        continue;
                    }

                    let finalCity = appt.actualCity;
                    // פתרון באג הכפילות: מונע את זליגת שם הרופא לשדה של העיר
                    if (isDoctorSearch && finalCity === item) {
                        finalCity = (config.selectedCities && config.selectedCities.length > 0) ? config.selectedCities[0] : 'עיר לא צוינה';
                    }

                    if (!config.includeSurrounding && finalCity !== item && finalCity !== 'עיר לא ידועה' && !finalCity.includes('לא צויין') && !isDoctorSearch) {
                        console.log(`   -> דילגתי: התור בעיר ${finalCity} ולא ב-${item}, והצ'קבוקס כבוי.`);
                        continue;
                    }

                    const cleanDate = match[0];
                    console.log(`   -> ✅ התור עבר את כל הסינונים וישלח למייל!`);
                    
                    // מעביר לזיכרון את השם המדויק מהדשבורד ואת העיר הנקייה
                    foundInPage.push({ 
                        doctor: matchedDashboardName, 
                        dateStr: cleanDate, 
                        actualCity: finalCity 
                    });
                }
                console.log("--- סוף הדפסת דיבוג ---\n");

                if (foundInPage.length > 0) {
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

                    for (const doctorName in bestApptsPerDoctor) {
                        const bestAppt = bestApptsPerDoctor[doctorName];
                        const key = `${bestAppt.doctor}-${bestAppt.dateStr}`;
                        
                      if (!sentInThisRun.has(key)) {
                                    try {
                                        // בדיקה: האם התור טוב יותר מהזיכרון הפנימי או שהבאנר הצהוב ריק?
                                        const configCheck = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                                        const isBannerEmpty = !configCheck.lastFoundDate;
                                        const isBetter = isBetterAppointment(bestAppt.doctor, bestAppt.dateStr);

                                        if (isBetter || isBannerEmpty) {
                                            
                                           // 1. חילוץ שם נקי ללא סוגריים לפני כל פעולת שמירה או לוג
                                            const cleanDoctorName = bestAppt.doctor.split('(')[0].trim();

                                            // 2. עדכון הזיכרון המקומי עם השם הנקי והעיר הנכונה
                                            updateMemory(cleanDoctorName, bestAppt.dateStr, bestAppt.actualCity);

                                            try {
                                                const mongoose = require('mongoose');
                                                const SearchTemplate = require('../../models/SearchTemplate');
                                                if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI);

                                                const currentInDB = await SearchTemplate.findOne({ userId: config.userId, selectedGroup: config.selectedGroup });
                                                let isSoFarBest = true;

                                                if (currentInDB && currentInDB.lastBestFound) {
                                                    const dbMatch = currentInDB.lastBestFound.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
                                                    if (dbMatch) {
                                                        const parseD = (d) => new Date(d.split(/[\.\/]/).reverse().join('-')).getTime();
                                                        if (parseD(bestAppt.dateStr) >= parseD(dbMatch[0])) isSoFarBest = false;
                                                    }
                                                }

                                                if (isSoFarBest) {
                                                    // 3. בניית מחרוזת תצוגה נקייה עבור הבאנר הצהוב בדשבורד
                                                    const foundStr = `${bestAppt.dateStr} - ${cleanDoctorName} (${bestAppt.actualCity})`;
                                                    
                                                    await SearchTemplate.updateOne(
                                                        { userId: config.userId, selectedGroup: config.selectedGroup },
                                                        { $set: { lastBestFound: foundStr } },
                                                        { upsert: true }
                                                    );
                                                    console.log(`✅ [DB-UPDATING] נמצא תור! מעדכן דשבורד ל: ${foundStr}`);
                                                }
                                            } catch (dbErr) {
                                                console.error("❌ שגיאה בעדכון ה-DB:", dbErr.message);
                                            }

                                            // 3. עדכון המנצח של הסבב הנוכחי לצורך שליחת מייל בסיום
                                            const parseD = (d) => new Date(d.split(/[\.\/]/).reverse().join('-')).getTime();
                                            if (!bestApptForEmailThisRun || parseD(bestAppt.dateStr) < parseD(bestApptForEmailThisRun.dateStr)) {
                                                bestApptForEmailThisRun = bestAppt;
                                            }

                                            // 4. חילוץ שם התחום והפקת דוח
                                            const { CLALIT_GROUPS } = require('./constants/professions');
                                            const groupName = Object.values(CLALIT_GROUPS).find(g => String(g.id) === String(config.selectedGroup))?.name || "כללי";
                                            
                                            console.log(`📡 [TRACE - clalit.js] שם קבוצה שזוהה: "${groupName}", קוד קבוצה בקונפיג: ${config.selectedGroup}`);
                                            const report = createExecutionReport(stats, {
                                                familyMember: config.familyMember || 'ראשי',
                                                groupName: groupName,
                                                specialization: config.selectedSpecialization || 'לא הוגדר',
                                                city: bestAppt.actualCity,
                                                doctor: bestAppt.doctor,
                                                dateStr: bestAppt.dateStr,
                                                searchStartTime: stats.startTime.toISOString()
                                            });
                                            console.log(report);
                                        } else {
                                            console.log(`   -> נמצא תור ל-${bestAppt.doctor}, אך הוא אינו מוקדם יותר מהתור השמור בזיכרון.`);
                                        }
                                        sentInThisRun.add(key);
                                    } catch (generalErr) {
                                        console.error(`⚠️ שגיאה כללית בעיבוד התור עבור ${bestAppt.doctor}:`, generalErr.message);
                                    }
                                }
                    }
                }

                const nextBtnSelector = 'a[title="הבא"]';
                const nextBtn = await target.$(nextBtnSelector);
                
                if (nextBtn && await nextBtn.isVisible()) {
                    console.log(`➡️ נמצא כפתור 'הבא', עובר לדף ${pageNum + 1}...`);
                    await nextBtn.scrollIntoViewIfNeeded();
                    await nextBtn.click();
                    await page.waitForTimeout(8000);
                    pageNum++;
                } else {
                    console.log(`🏁 סיימתי לסרוק את כל הדפים עבור: ${item}.`);
                    hasNextPage = false;
                }
            }
            
            await target.evaluate((sel) => {
                window.scrollTo(0, 0);
                const el = document.querySelector(sel);
                if (el) el.value = '';
            }, '#SelectedCityName');
            
            await page.waitForTimeout(2000);
        }

        console.log(`\n✅ סריקת כל הערים והדפים הסתיימה!`);

       // --- שליחת מייל רק אם נמצא שיפור בסבב הזה לעומת מה שקיים בדשבורד ---
        if (bestApptForEmailThisRun) {
            // קריאת המצב העדכני של הקונפיגורציה (שמסונכרנת עם ה-DB)
            const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            const lastDBDateStr = currentConfig.lastFoundDate ? currentConfig.lastFoundDate.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/)?.[0] : null;

            let shouldSendMail = true;
            const parseD = (d) => new Date(d.split(/[\.\/]/).reverse().join('-')).getTime();

            if (lastDBDateStr && parseD(bestApptForEmailThisRun.dateStr) >= parseD(lastDBDateStr)) {
                shouldSendMail = false;
            }

            if (shouldSendMail) {
                console.log(`📧 נמצא תור קרוב יותר! שולח מייל סיכום: ${bestApptForEmailThisRun.dateStr}`);
                try {
                    await sendEmailNotification(
                        bestApptForEmailThisRun.doctor, 
                        bestApptForEmailThisRun.actualCity, 
                        bestApptForEmailThisRun.dateStr, 
                        config.email
                    );
                    console.log(`✅ המייל נשלח בהצלחה ליעד: ${config.email || 'ברירת מחדל'}`);
                } catch (e) { 
                    console.error("⚠️ שגיאה בשליחת המייל המסכם:", e.message); 
                }
            } else {
                console.log(`ℹ️ הסבב הסתיים. נמצאו תורים, אך אף אחד מהם לא מקדים את התור שכבר מופיע בדשבורד (${lastDBDateStr}). לא נשלח מייל.`);
            }
        }
    } catch (e) {
        console.error("❌ שגיאה במהלך הבוט:", e.message);
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
        setBotStatus('idle');

        const configRefresh = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        
        if (configRefresh.runInLoop) {
            const frequencyRange = configRefresh.loopFrequency || "10-15";
            console.log(`⏳ סבב הסתיים. הדפדפן נשאר פתוח. ממתין ${frequencyRange} דקות...`);

            const [totalMin, totalMax] = frequencyRange.split('-').map(Number);
            const totalWaitMs = (Math.floor(Math.random() * (totalMax - totalMin + 1)) + totalMin) * 60 * 1000;
            console.log(`🎲 נבחר זמן המתנה אקראי של ${totalWaitMs / 60000} דקות לסבב זה.`);

            try {
                const cfgForTimer = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                cfgForTimer.nextRunTime = Date.now() + totalWaitMs;
                fs.writeFileSync('./config.json', JSON.stringify(cfgForTimer, null, 2));
            } catch (e) {}

            let elapsed = 0;
            while (elapsed < totalWaitMs) {
                // בדיקה אם המשתמש לחץ על 'עצור' בדשבורד בזמן ההמתנה
                const configCheck = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                if (!configCheck.runInLoop) {
                    console.log("🛑 זוהתה בקשת עצירה מהדשבורד. מפסיק המתנה ויוצא מהלולאה.");
                    break;
                }

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
                            const popupBtn = await page.$('#ctl00_ctl00_LogOutTimeOut_btnMasterOk_lnkSubButton');
                            if (popupBtn) {
                                const isVisible = await popupBtn.isVisible().catch(() => false);
                                if (isVisible) {
                                    console.log(`🖱️ [KEEPALIVE] מזהה פופאפ – לוחץ על המשך...`);
                                    await popupBtn.click().catch(() => {});
                                }
                            }
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

            const finalConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            if (finalConfig.runInLoop) {
                console.log("🔄 מתחיל סבב חדש – נשאר בתוך האתר ללא רענון...");
                return runClalit(page);
            }
            console.log("🏁 הבוט הופסק בהצלחה על ידי המשתמש.");
        }
    } // סוף finally
} // סוף runClalit

module.exports = { runClalit };