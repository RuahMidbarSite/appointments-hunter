const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./constants/doctors_whitelist');
const mongoose = require('mongoose'); 
const SearchTemplate = require('../../models/SearchTemplate'); 
const MorSearchTemplate = require('../../models/MorSearchTemplate');
const fs = require('fs');
const path = require('path');
const { setBotStatus, waitMinutes, isBetterAppointment, updateMemory } = require('../../utils/scheduler/loopManager');
const { createExecutionReport } = require('../../utils/scheduler/reportGenerator');
const { navigateHospitalSearch } = require('./hospital_navigator');
const { navigateMor } = require('./mor_navigator'); // הוספת הייבוא למכון מור

// פונקציה לעדכון סטטוס חי לדשבורד
function updateLiveProgress(msg, seconds = null) {
    try {
        const configPath = './config.json';
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            cfg.liveProgress = msg;
            // שמירת השניות הגולמיות כדי שהדשבורד יוכל להריץ טיימר חי
            cfg.scanTimeRemaining = seconds;
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
        }
    } catch (e) {}
}

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

    const MAIN_URL = 'https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsSpecials.aspx';

    try {
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI);
                console.log("✅ [DB-RECONNECT] החיבור חודש בהצלחה.");
            } catch (err) {
                console.error("❌ [DB-RECONNECT] נכשלה התחברות ל-DB:", err.message);
            }
        }

        const mainConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        const queue = (mainConfig.templateQueue && mainConfig.templateQueue.length > 0) 
            ? mainConfig.templateQueue 
            : [mainConfig];

        console.log(`🚀 מתחיל סבב סריקה עבור ${queue.length} תבניות.`);

        for (let i = 0; i < queue.length; i++) {
            const config = { ...mainConfig, ...queue[i] };
            const engines = config.activeEngines || ['clalit_specialist'];
            
            updateLiveProgress(`🔄 סורק ${i + 1}/${queue.length}: ${config.familyMember || 'ראשי'}...`);
            console.log(`\n--- סורק תבנית ${i + 1}: ${config.familyMember} ---`);

            if (engines.includes('mor_institute')) {
                console.log("🧪 זוהתה בקשה למכון מור - מנווט ישירות למור...");
                const morResult = await navigateMor(page, config);
                
                if (morResult) {
                    const foundStr = `${morResult.date} - מור: ${morResult.branch} (${morResult.time})`;
                    updateLiveProgress(`✅ נמצא תור במור: ${foundStr}`);
                    
                    try {
                        await MorSearchTemplate.updateOne(
                            { userId: config.userId },
                            { $set: { lastBestFound: foundStr, bestBranch: morResult.branch, bestDate: morResult.date, bestTime: morResult.time, provider: 'MACHON_MOR' } }, 
                            { upsert: true }
                        );
                    } catch (dbErr) { console.error("❌ [DB-ERROR] שמירת נתוני מור נכשלה:", dbErr.message); }

                    const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                    currentConfig.lastFoundDate = foundStr;
                    fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2));

                    try {
                        await sendEmailNotification(`מכון מור - ${morResult.branch}`, morResult.area, `${morResult.date} בשעה ${morResult.time}`, config.email);
                    } catch (e) { console.error("⚠️ שגיאה בשליחת מייל מור:", e.message); }
                } else {
                    console.log(`ℹ️ הסבב הסתיים. לא נמצאו תורים במכון מור.`);
                    updateLiveProgress("ℹ️ סבב מכון מור הסתיים - לא נמצאו תורים.");
                }
                
                console.log(`🏁 סבב מכון מור הסתיים עבור ${config.familyMember}.`);
                
                // הכנה לתבנית הבאה בתור (חוזרים לדף הבית של כללית)
                if (i < queue.length - 1) {
                    console.log(`🔙 מתכונן לתבנית הבאה... חוזר לדף הבית`);
                    await page.goto(MAIN_URL, { waitUntil: 'networkidle' }).catch(() => {});
                    await page.waitForTimeout(5000);
                    const sessionAlive = await page.$('text="שירותי האון־ליין"').catch(() => null);
                    if (!sessionAlive) console.log("⚠️ הסשן נותק במעבר בין תבניות.");
                }
                
                continue; // מדלג לסוף הלולאה ועובר לתבנית הבאה בתור!
            }

            // --- מכאן מתחילה הלוגיקה של כללית (תרוץ רק אם engines לא מכיל 'mor_institute') ---
            const learningPath = path.join(__dirname, '../../utils/bot_learning_data.json');
        let scanHistory = {};
        try { if (fs.existsSync(learningPath)) scanHistory = JSON.parse(fs.readFileSync(learningPath, 'utf8')); } catch(e) {}
        
        let bestApptForEmailThisRun = null;
        const stats = { startTime: new Date() };

        console.log("--- מתחיל סריקה עבור כללית ---");
        updateLiveProgress("🚀 מתחיל סבב סריקה חדש...");
        const currentUrlAtStart = page.url();
        console.log(`🌐 [START] כתובת בתחילת הסבב: ${currentUrlAtStart}`);
        
        if (currentUrlAtStart.includes('ResponseSorry') || currentUrlAtStart === 'about:blank') {
            console.log("🔄 מתחיל מדף שגיאה/ריק - מנווט ל-MAIN_URL לפני בדיקת לוגין...");
            await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
        }

        const isLoggedIn = await page.$('text="שירותי האון־ליין"').catch(() => null);
        console.log(`🔐 [LOGIN-CHECK] מחובר? ${isLoggedIn ? 'כן' : 'לא'}`);
        
        if (!isLoggedIn) {
            const currentUrl = page.url();
            if (!currentUrl.includes('e-services.clalit.co.il')) {
                console.log("🛡️ לא מזוהה סשן פעיל ולא על אתר כללית - מנווט...");
                await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
                await handleResponseSorry(page, MAIN_URL);
            } else {
                console.log("🛡️ לא מחובר אך כבר על אתר כללית - לא מרענן.");
            }
        } else {
            console.log("⚡ נמצא סשן פעיל! ממשיך לסריקה ללא לוגין מחדש.");
        }

        const idField = '#ctl00_cphBody__loginView_tbUserId';
        const needsLogin = await page.waitForSelector(idField, { visible: true, timeout: 5000 }).catch(() => null);

        if (needsLogin) {
            const loginMode = config.loginMode || 'password';
            console.log(`🔑 נדרש לוגין - מצב: ${loginMode === 'sms' ? 'קוד חד-פעמי SMS' : 'קוד משתמש וסיסמה'}`);

            const loginKey = `login_method_${loginMode}`;
            const loginStartTime = Date.now();
            
            const defaultLoginTime = loginMode === 'sms' ? 60 : 20;
            const estimatedLoginTime = scanHistory[loginKey] || defaultLoginTime;
            const isDefaultLogin = !scanHistory[loginKey];

            updateLiveProgress(`🔐 מתחבר בשיטת ${loginMode === 'sms' ? 'SMS' : 'סיסמה'} ${isDefaultLogin ? '*' : ''}`, estimatedLoginTime);
         if (loginMode === 'sms') {
                // --- מנגנון כניסה SMS משופר (כולל זיהוי אוטומטי וריענון במקרה של קפצ'ה שגויה) ---
                let smsSent = false;
                for (let captchaAttempt = 1; captchaAttempt <= 2; captchaAttempt++) {
                    smsSent = await loginWithSMS(page, config);
                    if (smsSent) break;
                    console.log(`⚠️ ניסיון שליחת SMS נכשל, מרענן דף ומנסה שוב... (${captchaAttempt}/2)`);
                    await page.reload({ waitUntil: 'networkidle' });
                    await page.waitForTimeout(3000);
                }

                if (!smsSent) {
                    console.log('❌ שליחת SMS נכשלה אחרי כל הניסיונות. עוצר סבב זה.');
                    return;
                }

                console.log('⏳ [SMS-LOGIN] ממתין לקוד אימות (אוטומטי מה-SMS או הזנה ידנית)...');
                updateLiveProgress("📱 ממתין לקוד (אוטומטי או ידני)");

                const timeoutMs = 300000; // 5 דקות
                const startTime = Date.now();
                let loginSuccess = false;
                
                const otpInput = '#ctl00_cphBody_txtClientOTP';
                const otpSubmitBtn = '#ctl00_cphBody_btnContinue_lnkSubButton'; 

                while (Date.now() - startTime < timeoutMs) {
                    const isLoggedInManual = await page.$('text="שירותי האון־ליין"').catch(() => null);
                    if (isLoggedInManual) {
                        loginSuccess = true;
                        break;
                    }

                    try {
                        if (fs.existsSync('./config.json')) {
                            const currentCfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                            const isFreshFile = currentCfg.otpReceivedAt && (Date.now() - currentCfg.otpReceivedAt < 300000);
                            
                            if (isFreshFile && currentCfg.lastOtp && currentCfg.lastOtp.length >= 4) {
                                const inputEl = await page.$(otpInput);
                                if (inputEl && await inputEl.isVisible()) {
                                    console.log(`🤖 [AUTO-LOGIN] מזין קוד אוטומטי: ${currentCfg.lastOtp}`);
                                    await page.click(otpInput, { clickCount: 3 });
                                    await page.keyboard.press('Backspace');
                                    await page.type(otpInput, currentCfg.lastOtp, { delay: 150 });
                                    await page.waitForTimeout(1000);
                                    
                                    const submitBtn = await page.$(otpSubmitBtn);
                                    if (submitBtn) await submitBtn.click();
                                    else await page.keyboard.press('Enter');
                                    
                                    currentCfg.lastOtp = "";
                                    fs.writeFileSync('./config.json', JSON.stringify(currentCfg, null, 2));
                                }
                            }
                        }
                    } catch (e) { }

                    try {
                        const template = await SearchTemplate.findOne({ email: config.email }).catch(() => null);
                        if (template?.lastOtp && (new Date() - template.otpReceivedAt < 120000)) {
                            if (await page.$(otpInput)) {
                                await page.fill(otpInput, template.lastOtp);
                                await page.keyboard.press('Enter');
                            }
                        }
                    } catch (e) {}

                    await new Promise(r => setTimeout(r, 3000));
                }

                if (!loginSuccess) {
                    throw new Error("❌ זמן ההמתנה להתחברות הסתיים ללא הצלחה.");
                }
                console.log('✅ [SMS-LOGIN] הכניסה הצליחה!');

            } else {
                // --- התחברות רגילה עם סיסמה ---
                const passTabBtn = '#ctl00_cphBody__loginView_btnPassword';
                try {
                    await page.waitForSelector(passTabBtn, { state: 'visible', timeout: 1500 });
                    await page.click(passTabBtn);
                    await page.waitForSelector('#ctl00_cphBody__loginView_tbUserId', { state: 'visible', timeout: 5000 });
                } catch (tabErr) {
                    console.log("⚠️ לשונית סיסמה לא נמצאה או שכבר פעילה.");
                }

                const idField = '#ctl00_cphBody__loginView_tbUserId';
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
        
        if (typeof loginStartTime !== 'undefined') {
            const loginDuration = Math.floor((Date.now() - loginStartTime) / 1000);
            const currentLoginKey = `login_method_${config.loginMode || 'password'}`;
            
            if (scanHistory[currentLoginKey]) {
                scanHistory[currentLoginKey] = Math.floor((scanHistory[currentLoginKey] + loginDuration) / 2);
            } else {
                scanHistory[currentLoginKey] = loginDuration;
            }
            try { fs.writeFileSync(learningPath, JSON.stringify(scanHistory, null, 2)); } catch (err) {}
        }

        updateLiveProgress("✅ תהליך הכניסה למערכת הושלם בהצלחה!");
        await page.waitForTimeout(3000); 
        updateLiveProgress("🏗️ נערך לחיפוש של התחומים בערים שהזנת...");

        // פתרון iFrame וקפיצות פופאפים
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
                if (backupBtn && backupBtn.offsetParent !== null) backupBtn.click();
            }, 3000);
        });

        async function getTargetElement(selector) {
            if (await page.$(selector).catch(() => null)) return page;
            for (const frame of page.frames()) {
                if (await frame.$(selector).catch(() => null)) return frame;
            }
            return null;
        }

        const groupId = config.selectedGroup || '32';
        const specId = config.selectedSpecialization || groupId;
        
        let target = await getTargetElement('#SelectedCityName');

        if (target) {
            console.log("⚡ [STATE] סבב שני ומעלה: הטופס כבר פתוח. מדלג על ניווט ובחירת פרופיל וממשיך ישירות להזנת העיר.");
        } else {
            console.log("🔄 [STATE] סבב ראשון: מתחיל תהליך בחירת פרופיל וניווט...");

            // מעבר לתיק בן משפחה
            if (config.familyMember && config.familyMember.trim() !== '') {
                console.log(`👨‍👩‍👧 מנסה לעבור לתיק של בת המשפחה: ${config.familyMember}`);
                updateLiveProgress(`👨‍👩‍👧 עובר לתיק של ${config.familyMember.trim()}...`);
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

            const engines = config.activeEngines || ['clalit_specialist'];

            if (engines.includes('mor_institute')) {
                const morResult = await navigateMor(page, config);
                if (morResult) {
                    const foundStr = `${morResult.date} - מור: ${morResult.branch} (${morResult.time})`;
                    updateLiveProgress(`✅ נמצא תור במור: ${foundStr}`);
                    
                   try {
                        // תיקון: חיפוש לפי ID ייחודי כדי לא לדרוס תבניות אחרות של אותו משתמש
                        const morQuery = config._id ? { _id: config._id } : { userId: config.userId, "morSettings.targetOrgan": config.morSettings?.targetOrgan };
                        await MorSearchTemplate.updateOne(
                            morQuery,
                            { 
                                $set: { 
                                    lastBestFound: foundStr, 
                                    bestBranch: morResult.branch, 
                                    bestDate: morResult.date, 
                                    bestTime: morResult.time, 
                                    provider: 'MACHON_MOR',
                                    category: config.morSettings?.category,
                                    subCategory: config.morSettings?.subCategory,
                                    targetOrgan: config.morSettings?.targetOrgan,
                                    insuranceType: config.morSettings?.insuranceType
                                } 
                            }, 
                            { upsert: true }
                        );
                    } catch (dbErr) { console.error("❌ [DB-ERROR] שמירת נתוני מור נכשלה:", dbErr.message); }

                    const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                    currentConfig.lastFoundDate = foundStr;
                    
                    // תיקון: עדכון התור המוקדם ישירות בתוך קבוצת הסריקה (כדי שיופיע בצ'יפ הספציפי)
                    if (currentConfig.templateQueue && currentConfig.templateQueue.length > 0) {
                        const qIndex = currentConfig.templateQueue.findIndex(t => t._id === config._id || t.templateName === config.templateName);
                        if (qIndex !== -1) {
                            currentConfig.templateQueue[qIndex].lastBestFound = foundStr;
                        }
                    }
                    fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2));

                    try {
                        await sendEmailNotification(`מכון מור - ${morResult.branch}`, morResult.area, `${morResult.date} בשעה ${morResult.time}`, config.email);
                    } catch (e) { console.error("⚠️ שגיאה בשליחת מייל מור:", e.message); }
                } else {
                    console.log(`ℹ️ הסבב הסתיים. לא נמצאו תורים במכון מור.`);
                    updateLiveProgress("ℹ️ סבב מכון מור הסתיים - לא נמצאו תורים.");
                }
                
                console.log(`🏁 סבב מכון מור הסתיים עבור ${config.familyMember || 'ראשי'}.`);
                
                // הכנה לתבנית הבאה במקום לעצור את כל הלולאה
                if (i < queue.length - 1) {
                    const nextConfig = { ...mainConfig, ...queue[i + 1] };
                    if (nextConfig.activeEngines && nextConfig.activeEngines.includes('mor_institute')) {
                        console.log(`🔙 התבנית הבאה גם היא של מכון מור - נשאר באתר כדי לחסוך לוגין כפול...`);
                        await page.goto('https://zimun.mor.org.il/machon-mor/#/main/page/new-appointment', { waitUntil: 'networkidle' }).catch(() => {});
                        await page.waitForTimeout(3000);
                    } else {
                        console.log(`🔙 מתכונן לתבנית הבאה... חוזר לדף הבית של כללית`);
                        await page.goto(MAIN_URL, { waitUntil: 'networkidle' }).catch(() => {});
                        await page.waitForTimeout(5000);
                    }
                }
                
                continue; // מדלג לסוף הלולאה ועובר לתבנית הבאה בתור (חשוב במקום return!)
            }
            
            if (engines.includes('clalit_hospital')) {
                const hospitalToSearch = (config.selectedCities && config.selectedCities.length > 0) ? config.selectedCities[0] : 'בילינסון';
                const navResult = await navigateHospitalSearch(page, config, hospitalToSearch);
                if (navResult.error === 'SYSTEM_CONFIG_ERROR') {
                    const errorMsg = `<span style="color:red; font-weight:bold;">⚠️ שגיאת מערכת: לא ניתן לזמן תור כרגע</span>`;
                    const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                    currentConfig.lastFoundDate = errorMsg;
                    fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2));
                    return; 
                }
                target = page;
            } 
            else {
                // מסלול רפואה יועצת
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

                    const checkReferral = async (stepName) => {
                        const isMissing = await target.evaluate(() => {
                            const activeModals = Array.from(document.querySelectorAll('#messageView, .ui-dialog, .modal-dialog, #divMessage, .messgeBox'));
                            for (const modal of activeModals) {
                                const isVisible = modal.offsetParent !== null && window.getComputedStyle(modal).display !== 'none';
                                if (isVisible && modal.innerText && modal.innerText.includes('נדרשת הפניה')) return true; 
                            }
                            return false;
                        });

                        if (isMissing) {
                            const { CLALIT_GROUPS } = require('./constants/professions');
                            const groupName = Object.values(CLALIT_GROUPS).find(g => String(g.id) === String(config.selectedGroup))?.name || "המבוקש";
                            const errorMsg = `⚠️ חסרה הפנייה בתחום ${groupName}`;
                            console.log(`💡 [DETECTION-TEST] ${errorMsg} (בשלב: ${stepName})`);
                            
                            try {
                                const formattedError = `<span id="referral-error" style="color: red; font-weight: bold; display: block; text-align: right;">${errorMsg}</span>`;
                                const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                                currentConfig.lastFoundDate = formattedError;
                                currentConfig.lastBestFound = formattedError; 
                                fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2));

                                if (mongoose.connection.readyState === 1) {
                                    await SearchTemplate.updateOne(
                                        { userId: config.userId, selectedGroup: config.selectedGroup },
                                        { $set: { lastBestFound: formattedError }, $setOnInsert: { templateName: `התראת חסימה - ${Date.now()}` } },
                                        { upsert: true }
                                    ).catch((dbErr) => console.log('⚠️ [DB-WARN] שגיאה בשמירת התראת הפניה:', dbErr.message));
                                }
                                console.log('🛑 [STOP-SEARCH] חסרה הפניה. עוצר סריקה לסבב זה.');
                            } catch (err) { console.error("Error in detection handler:", err.message); }
                            return true; 
                        }
                        return false;
                    };

                    if (await checkReferral("בחירת תחום")) return; 

                    try {
                        await target.selectOption('#SelectedSpecializationCode', specId);
                        await page.waitForTimeout(2000);
                        if (await checkReferral("בחירת מקצוע")) return;
                    } catch (e) {
                        console.log("⚠️ לא ניתן היה לבחור מקצוע - ייתכן והפופ-אפ חוסם את האלמנט.");
                        return; 
                    }
                } else {
                    console.log("❌ לא נמצא כפתור 'ProfessionVisitButton', מנסה להמשיך...");
                    target = page; 
                }
            }
        }

        const sentInThisRun = new Set();
        const activeDoctorsNames = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0) ? config.selectedDoctorNames : [];
        let citiesToSearch = config.selectedCities || [];

        if (engines.includes('clalit_hospital') && citiesToSearch.length === 0) {
            citiesToSearch = ['בילינסון']; 
        } else if (citiesToSearch.length === 0 && activeDoctorsNames.length === 0) {
            citiesToSearch = ['הרצליה'];
        }

        const searchItems = activeDoctorsNames.length > 0 ? activeDoctorsNames : citiesToSearch;
        const isDoctorSearch = activeDoctorsNames.length > 0;
        const activeDoctorsFilter = (config.selectedDoctorNames && config.selectedDoctorNames.length > 0) ? config.selectedDoctorNames : [];

        const getSearchKey = (item) => `${config.selectedGroup}_${config.selectedSpecialization}_${item}`;
        const DEFAULT_TIME_PER_ITEM = 45; 
        let currentIndex = 0;
        const totalItems = searchItems.length;
        const itemType = isDoctorSearch ? 'רופאים' : 'ערים';

        for (const item of searchItems) {
            currentIndex++;
            const startTime = Date.now(); 
            let remainingSeconds = 0;
            let isDefault = false;

            for (let i = currentIndex - 1; i < searchItems.length; i++) {
                const key = getSearchKey(searchItems[i]);
                if (scanHistory[key]) remainingSeconds += scanHistory[key];
                else { remainingSeconds += DEFAULT_TIME_PER_ITEM; isDefault = true; }
            }

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            updateLiveProgress(`📄 עמוד 1 | ${item} (${currentIndex} מתוך ${totalItems} ${itemType})`, remainingSeconds);
            
            const stopCheck = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
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
                // התיקון הקריטי: בחירת עיר מתוך רשימה נפתחת (Autocomplete)
                const cityInput = '#SelectedCityName';
                await target.click(cityInput, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.waitForTimeout(300);

                console.log(`🔎 מזין עיר: ${item}...`);
                await target.type(cityInput, item, { delay: 250 });

                // המתנה לרשימה ובחירה מתוכה
                await page.waitForTimeout(2500); 
                const menuItemSelector = `li.ui-menu-item:has-text("${item}")`;
                const menuItem = await getTargetElement(menuItemSelector).catch(() => null);
                
                if (menuItem) {
                    console.log(`🖱️ בוחר את '${item}' מתוך הרשימה שנפתחה...`);
                    const itemInFrame = await menuItem.$(menuItemSelector);
                    if (itemInFrame) await itemInFrame.click();
                    else await page.click(menuItemSelector);
                } else {
                    console.log(`⚠️ לא זוהתה רשימה עבור '${item}', מבצע בחירה דרך מקלדת (ArrowDown + Enter).`);
                    await page.keyboard.press('ArrowDown');
                    await page.waitForTimeout(500);
                    await page.keyboard.press('Enter');
                }
            }

            await page.waitForTimeout(1500);
            await target.click('#searchBtnSpec');
            await page.waitForTimeout(8000); 

            // --- תוספת חדשה: בדיקת מסך לבן/קריסה למניעת המשך הלולאה על ריק ---
            try {
                const currentUrl = page.url();
                if (currentUrl === 'about:blank') {
                    console.log('⚠️ [CRASH] זוהה מסך לבן (about:blank) לאחר החיפוש! יוזם אתחול מיידי...');
                    throw new Error('BlankPageCrash');
                }
            } catch (err) {
                if (err.message.includes('BlankPageCrash') || err.message.includes('detached')) {
                    throw err; // זורק את השגיאה החוצה כדי שהמערכת תתחיל סבב חדש מיד
                }
            }
            // ---------------------------------------------------------

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
                updateLiveProgress(`📄 עמוד ${pageNum} | ${item} (${currentIndex} מתוך ${totalItems} ${itemType})`, remainingSeconds);
                console.log(`📄 סורק דף תוצאות מספר ${pageNum} עבור ${item}...`);
                console.log(`📸 שמרתי צילום מסך בתיקייה הראשית: debug_${item}_page_${pageNum}.png`);

                const rawDataFromPage = await target.evaluate((searchedItem) => {
                    return Array.from(document.querySelectorAll('.diaryDoctor')).map(card => {
                        const addressText = card.querySelector('.clinicAddress')?.innerText || '';
                        const detailsText = card.querySelector('.clinicDetails')?.innerText || '';
                        let actualCity = '';
                        
                        const addrParts = addressText.split(',').map(p => p.trim());
                        if (addrParts.length >= 2) actualCity = addrParts[addrParts.length - 1];
                        else if (detailsText.includes(',')) {
                            const detailParts = detailsText.split(',').map(p => p.trim());
                            actualCity = detailParts[detailParts.length - 1];
                        } else actualCity = searchedItem || 'עיר לא צוינה';

                        return {
                            docNameRaw: card.querySelector('.doctorName')?.innerText || 'לא נמצא שם',
                            dateTextRaw: card.querySelector('.visitDateTime')?.innerText || 'לא נמצא תאריך',
                            actualCity: actualCity
                        };
                    });
                }, item); 

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
                   const todayStr = new Date().toISOString().split('T')[0];
                    if (isoDate < todayStr) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} כבר עבר (היום ${todayStr}).`);
                        continue;
                    }

                    const inRange = !config.endDate || (isoDate <= config.endDate);
                    if (!inRange) {
                        console.log(`   -> דילגתי: התאריך ${isoDate} מאוחר מתאריך היעד.`);
                        continue;
                    }
                    
                    console.log(`    [DEBUG] בודק רופא מהאתר: "${appt.docNameRaw}"`);
                    console.log(`    [DEBUG] מועדפים מהדשבורד: ${JSON.stringify(activeDoctorsFilter)}`);

                    let matchedDashboardName = appt.docNameRaw.trim(); 
                    let isPreferred = activeDoctorsFilter.length === 0;

                    if (activeDoctorsFilter.length > 0) {
                        for (const prefName of activeDoctorsFilter) {
                            const cleanPref = prefName.replace(/ד"ר|דר'|\(כללית\)|\(מושלם\)/g, '').replace(/[()]/g, '').trim();
                            const prefWords = cleanPref.split(/\s+/).filter(word => word.length > 1);
                            const cleanSiteName = appt.docNameRaw.replace(/ד"ר|דר'/g, '').trim();
                            const normalizeHeb = (str) => str.replace(/[יו]/g, '');
                            
                            if (prefWords.every(word => normalizeHeb(cleanSiteName).includes(normalizeHeb(word)))) {
                                isPreferred = true;
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
                    if (isDoctorSearch && finalCity === item) {
                        finalCity = (config.selectedCities && config.selectedCities.length > 0) ? config.selectedCities[0] : 'עיר לא צוינה';
                    }

                    if (!config.includeSurrounding && finalCity !== item && finalCity !== 'עיר לא ידועה' && !finalCity.includes('לא צויין') && !isDoctorSearch) {
                        console.log(`   -> דילגתי: התור בעיר ${finalCity} ולא ב-${item}, והצ'קבוקס כבוי.`);
                        continue;
                    }

                    const cleanDate = match[0];
                    console.log(`   -> ✅ התור עבר את כל הסינונים וישלח למייל!`);
                    
                    foundInPage.push({ doctor: matchedDashboardName, dateStr: cleanDate, actualCity: finalCity });
                }
                console.log("--- סוף הדפסת דיבוג ---\n");

                if (foundInPage.length > 0) {
                    const bestApptsPerDoctor = {};
                    
                    for (const appt of foundInPage) {
                        const parseDate = (d) => {
                            const parts = d.split(/[\.\/]/);
                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        };
                        if (!bestApptsPerDoctor[appt.doctor]) bestApptsPerDoctor[appt.doctor] = appt;
                        else {
                            const currentBestDate = parseDate(bestApptsPerDoctor[appt.doctor].dateStr);
                            const newDate = parseDate(appt.dateStr);
                            if (newDate < currentBestDate) bestApptsPerDoctor[appt.doctor] = appt;
                        }
                    }

                    for (const doctorName in bestApptsPerDoctor) {
                        const bestAppt = bestApptsPerDoctor[doctorName];
                        const key = `${bestAppt.doctor}-${bestAppt.dateStr}`;
                        
                      if (!sentInThisRun.has(key)) {
                                    try {
                                        const configCheck = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                                        const isBannerEmpty = !configCheck.lastFoundDate;
                                        const isBetter = isBetterAppointment(bestAppt.doctor, bestAppt.dateStr);

                                        if (isBetter || isBannerEmpty) {
                                            const cleanDoctorName = bestAppt.doctor.split('(')[0].trim();
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
                                                        const parseD = (d) => {
                                                            const parts = d.split(/[\.\/]/);
                                                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                                                        };
                                                        if (parseD(bestAppt.dateStr) >= parseD(dbMatch[0])) isSoFarBest = false;
                                                    }
                                                }

                                                if (isSoFarBest) {
                                                    const cleanDoctorName = bestAppt.doctor.split('(')[0].trim();
                                                    const foundStr = `${bestAppt.dateStr} - ${cleanDoctorName} (${bestAppt.actualCity})`;
                                                    
                                                    await SearchTemplate.updateOne(
                                                        { userId: config.userId, selectedGroup: config.selectedGroup },
                                                        { $set: { lastBestFound: foundStr } },
                                                        { upsert: true }
                                                    );

                                                    const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                                                    currentConfig.lastFoundDate = foundStr;
                                                    currentConfig.lastBestFound = foundStr;
                                                    if (!currentConfig.doctorDates) currentConfig.doctorDates = {};
                                                    currentConfig.doctorDates[cleanDoctorName] = bestAppt.dateStr;
                                                    fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2));

                                                    updateMemory(cleanDoctorName, bestAppt.dateStr, bestAppt.actualCity);
                                                    console.log(`✅ [FULL-SYNC] ה-DB, הקונפיג וקובץ המיילים סונכרנו לתור: ${foundStr}`);
                                                }
                                            } catch (dbErr) { console.error("❌ שגיאה בעדכון ה-DB:", dbErr.message); }

                                            const parseD = (d) => new Date(d.split(/[\.\/]/).reverse().join('-')).getTime();
                                            if (!bestApptForEmailThisRun || parseD(bestAppt.dateStr) < parseD(bestApptForEmailThisRun.dateStr)) {
                                                bestApptForEmailThisRun = bestAppt;
                                            }

                                            const { CLALIT_GROUPS } = require('./constants/professions');
                                            const groupName = Object.values(CLALIT_GROUPS).find(g => String(g.id) === String(config.selectedGroup))?.name || "כללי";
                                            console.log(`📡 [TRACE - clalit.js] שם קבוצה שזוהה: "${groupName}", קוד קבוצה בקונפיג: ${config.selectedGroup}`);
                                            
                                            stats.lastFoundDoctor = bestAppt.doctor;
                                            stats.lastFoundDate = bestAppt.dateStr;
                                            stats.lastFoundCity = bestAppt.actualCity;

                                            const { createFoundAppointmentReport } = require('../../utils/scheduler/reportGenerator');
                                            const report = createFoundAppointmentReport(stats, {
                                                familyMember: config.familyMember || 'ראשי',
                                                groupName: groupName,
                                                specialization: config.selectedSpecialization || 'לא הוגדר',
                                                city: bestAppt.actualCity,
                                                doctor: bestAppt.doctor,
                                                dateStr: bestAppt.dateStr,
                                                searchStartTime: stats.startTime.toLocaleString('he-IL')
                                            });
                                            console.log('📊 [REPORT-GENERATED] דוח ביצוע מעודכן נשמר בהצלחה.');
                                        } else {
                                            console.log(`   -> נמצא תור ל-${bestAppt.doctor}, אך הוא אינו מוקדם יותר מהתור השמור בזיכרון.`);
                                        }
                                        sentInThisRun.add(key);
                                    } catch (generalErr) { console.error(`⚠️ שגיאה כללית בעיבוד התור עבור ${bestAppt.doctor}:`, generalErr.message); }
                                }
                    }
                }

                const nextBtnSelector = 'a[title="הבא"]';
                const nextBtn = await target.$(nextBtnSelector);
                
                if (nextBtn && await nextBtn.isVisible()) {
                    console.log(`➡️ נמצא כפתור 'הבא', עובר לדף ${pageNum + 1}...`);
                    await nextBtn.scrollIntoViewIfNeeded();
                    await nextBtn.click();
                    pageNum++; 
                    updateLiveProgress(`📄 עמוד ${pageNum} | ${item} (${currentIndex} מתוך ${totalItems} ${itemType})`, remainingSeconds);
                    await page.waitForTimeout(8000);
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
            
            const duration = Math.floor((Date.now() - startTime) / 1000);
            const currentItemKey = getSearchKey(item);
            
            if (scanHistory[currentItemKey]) scanHistory[currentItemKey] = Math.floor((scanHistory[currentItemKey] + duration) / 2);
            else scanHistory[currentItemKey] = duration;
            
            try { fs.writeFileSync(learningPath, JSON.stringify(scanHistory, null, 2)); } catch (err) { console.error("❌ שגיאה בכתיבת קובץ הלמידה ל-utils:", err.message); }
            await page.waitForTimeout(2000);
        }

        console.log(`\n✅ סריקת כל הערים והדפים הסתיימה!`);
        
        const endConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        updateLiveProgress(endConfig.runInLoop ? "✅ הסתיימה הבדיקה וממתינים לסבב הבא..." : "✅ הסתיימה הבדיקה.");

        if (bestApptForEmailThisRun) {
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
                } catch (e) { console.error("⚠️ שגיאה בשליחת המייל המסכם:", e.message); }
            } else {
                console.log(`ℹ️ הסבב הסתיים. נמצאו תורים, אך אף אחד מהם לא מקדים את התור שכבר מופיע בדשבורד (${lastDBDateStr}). לא נשלח מייל.`);
                updateLiveProgress("ℹ️ הסבב הסתיים - אין תור מקדים חדש.");
            }
       } else {
                console.log(`ℹ️ הסבב הסתיים עבור תבנית זו.`);
                updateLiveProgress(`ℹ️ סיימתי לסרוק את ${config.familyMember || 'התבנית'}.`);
            }

            // הכנה לתבנית הבאה בתור
            if (i < queue.length - 1) {
                const nextConfig = { ...mainConfig, ...queue[i + 1] };
                const nextIsMor = nextConfig.activeEngines?.includes('mor_institute');

                console.log(`🔙 סיימתי עם ${config.familyMember}, מתכונן לתבנית הבאה...`);

                // תמיד נחזור לדף הבית הראשי כדי להבטיח נקודת מוצא נקייה
                // הניווט למור או לכללית יתבצע אוטומטית בתחילת הסיבוב הבא של הלולאה
                await page.goto(MAIN_URL, { waitUntil: 'networkidle' }).catch(() => {});
                await page.waitForTimeout(5000);
                
                // בדיקה אם הסשן עדיין חי אחרי המעבר
                const sessionAlive = await page.$('text="שירותי האון־ליין"').catch(() => null);
                if (!sessionAlive) {
                    console.log("⚠️ הסשן נותק במעבר בין תבניות, הבוט ינסה להתחבר מחדש בסיבוב הבא.");
                }
            }
        } // <--- סגירת לולאת ה-for (queue)

        const endConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        updateLiveProgress(endConfig.runInLoop ? "✅ הסתיימה הבדיקה לכל התור וממתינים לסבב הבא..." : "✅ הסתיימה הבדיקה.");

    } catch (e) {
        console.error("❌ שגיאה במהלך הבוט:", e.message);
        let currentUrl = '';
        try { currentUrl = page.url(); } catch (err) {} 
        
        if (currentUrl.includes('ResponseSorry') || currentUrl === 'about:blank' || 
            e.message.includes('Timeout') || e.message.includes('detached') || 
            e.message.includes('destroyed') || e.message.includes('BlankPageCrash')) {
            
            console.log('🔄 זוהתה קריסת עמוד (מסך לבן/שגיאת סשן) – מנקה עוגיות ומתחיל סבב חדש מיד וללא טיימר...');
            try {
                await page.context().clearCookies();
                await page.goto(MAIN_URL, { waitUntil: 'networkidle' });
            } catch (navErr) {}
            
            // מדליקים דגל שמונע מהטיימר ב-finally לעבוד בסבב הזה
            page.__skipTimer = true;
            setTimeout(() => runClalit(page), 100);
            return; 
        }
    } finally {
        setBotStatus('idle');
        const configRefresh = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        
        // הטיימר מופעל רק אם אנחנו בלולאה ואין בקשת התעלמות בגלל קריסה
        if (configRefresh.runInLoop && !page.__skipTimer) {
            updateLiveProgress("⏳ בהמתנה לזמן הסבב הבא...");
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
                        }
                    } catch (e) { console.log('⚠️ [KEEPALIVE] שגיאה:', e.message); }
                }
            }

            const finalConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            if (finalConfig.runInLoop) {
                console.log("🔄 מתחיל סבב חדש – נשאר בתוך האתר ללא רענון...");
                page.__skipTimer = false; // מנקים את הדגל לסבב הבא
                return runClalit(page);
            }
            console.log("🏁 הבוט הופסק בהצלחה על ידי המשתמש.");
        }
        
        // איפוס הדגל ליתר ביטחון למקרה של עצירה יזומה
        page.__skipTimer = false;
    } 
} 

module.exports = { runClalit };