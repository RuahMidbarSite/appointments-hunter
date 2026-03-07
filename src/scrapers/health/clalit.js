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
    await page.goto('https://e-services.clalit.co.il/onlineweb/general/login.aspx');

  try {
        // 1. לחיצה על לשונית ה-SMS (הסלקטור שעבד לך קודם)
        const exactSmsBtnSelector = '#ctl00_cphBody__loginView_btnSendSMS';
        await page.waitForSelector(exactSmsBtnSelector, { state: 'visible', timeout: 30000 });
        console.log("👆 עובר ללשונית 'קוד חד-פעמי לנייד'...");
        await page.click(exactSmsBtnSelector);
        
        await page.waitForTimeout(2000);

        // 2. הזנת תעודת הזהות מהדשבורד (שימוש בסלקטור tbUserId שעבד לך קודם)
        const userIdSelector = '#ctl00_cphBody__loginView_tbUserId';
        await page.waitForSelector(userIdSelector, { state: 'visible', timeout: 30000 });

        // המרה ודאית לטקסט (כדי שיפעל בדיוק כמו המחרוזת '029280484' שעבדה קודם)
        const idToType = String(config.userId || '');

        console.log(`⌨️ מזין תעודת זהות: ${idToType}`);
        
        // החזרנו למהירות 150 שעבדה לך בצורה חלקה בקוד המקורי
        await page.type(userIdSelector, idToType, { delay: 150 }); 
        
        await page.waitForTimeout(1500); // המתנה קטנה לפני מעבר לקפצ'ה
        
        console.log("⏳ ממתין לקוד SMS...");
        
        const captchaEl = await page.waitForSelector('img[id*="Captcha"]', { state: 'visible', timeout: 15000 });
        const captchaImgPath = 'captcha_temp.png';
        await captchaEl.screenshot({ path: captchaImgPath });
        
        const solvedText = await solveCaptcha(captchaImgPath);
        if (solvedText) {
            console.log(`⌨️ מזין קפצ'ה: ${solvedText}`);
            await page.type('#ctl00_cphBody__loginView_tbCaptchaLogin', solvedText, { delay: 200 });
            await page.waitForTimeout(1200); // המתנה לפני לחיצה
        }

        const submitBtnId = '#ctl00_cphBody__loginView_lblSendOTP';
        // שימוש בלחיצה רגילה במקום evaluate כדי לדמות עכבר
        await page.click(submitBtnId);

        console.log("--------------------------------------------------");
        console.log("אנא הזן את קוד ה-SMS בתיבה שנפתחה ולחץ כניסה.");
        const daughterSelector = '#ctl00_ctl00_cphTopMenuRight_FamilySliderControl21_rptPersonList_ctl01_FirstNameTxt';
        await page.waitForSelector(daughterSelector, { timeout: 300000 });
        
        await page.click(daughterSelector);
        await page.waitForTimeout(6000); 

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
        const citiesToSearch = [config.city]; // חיפוש לפי העיר שנבחרה בדשבורד

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
            await page.waitForTimeout(2000);

            await target.click('#searchBtnSpec');
            await page.waitForTimeout(8000); 

            let hasNextPage = true;
            let pageNum = 1;

            while (hasNextPage) {
                console.log(`📄 סורק דף תוצאות מספר ${pageNum} ב${city}...`);

                const foundInPage = await target.evaluate((whitelist, start, end) => {
                    return Array.from(document.querySelectorAll('.diaryDoctor')).map(card => {
                        const docName = card.querySelector('.doctorName')?.innerText || '';
                        const dateText = card.querySelector('.visitDateTime')?.innerText || '';
                        
                        const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                        if (!match) return null;
                        
                        const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                        const inRange = (!start || isoDate >= start) && (!end || isoDate <= end);
                        const isPreferred = whitelist.some(name => docName.includes(name));

                        return (isPreferred && inRange) ? { doctor: docName, dateStr: dateText } : null;
                    }).filter(res => res !== null);
                }, preferredDoctors, config.startDate, config.endDate);

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