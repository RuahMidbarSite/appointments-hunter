const { solveCaptcha } = require('../../services/captchaService');
const nodemailer = require('nodemailer');
const preferredDoctors = require('./doctors_whitelist'); 

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
    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");
    await page.goto('https://e-services.clalit.co.il/onlineweb/general/login.aspx');

    try {
        const exactSmsBtnSelector = '#ctl00_cphBody__loginView_btnSendSMS';
        await page.waitForSelector(exactSmsBtnSelector, { state: 'visible', timeout: 30000 });
        await page.click(exactSmsBtnSelector);
        
        await page.waitForTimeout(2000);
        const userIdSelector = '#ctl00_cphBody__loginView_tbUserId';
        await page.waitForSelector(userIdSelector, { state: 'visible', timeout: 30000 });

        console.log("⌨️ מזין תעודת זהות...");
        await page.type(userIdSelector, '029280484', { delay: 150 });
        
        const captchaEl = await page.waitForSelector('img[id*="Captcha"]', { state: 'visible', timeout: 15000 });
        const captchaImgPath = 'captcha_temp.png';
        await captchaEl.screenshot({ path: captchaImgPath });
        
        const solvedText = await solveCaptcha(captchaImgPath);
        if (solvedText) {
            await page.type('#ctl00_cphBody__loginView_tbCaptchaLogin', solvedText, { delay: 150 });
        }

        const submitBtnId = '#ctl00_cphBody__loginView_lblSendOTP';
        await page.evaluate((btnId) => document.querySelector(btnId).click(), submitBtnId);

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
        await target.selectOption('#SelectedGroupCode', '32');
        await page.waitForTimeout(5000); 

        // --- לוגיקת החיפוש המעודכנת ---
        const sentInThisRun = new Set(); 
        const citiesToSearch = ['כפר קרע', 'הרצליה', 'תל אביב - יפו'];

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

                const foundInPage = await target.evaluate((whitelist) => {
                    const results = [];
                    const cards = document.querySelectorAll('.diaryDoctor'); 
                    cards.forEach(card => {
                        const docNameText = card.querySelector('.doctorName')?.innerText || '';
                        const dateText = card.querySelector('.visitDateTime')?.innerText || '';
                        const isPreferred = whitelist.some(name => docNameText.includes(name));
                        if (isPreferred && dateText !== '') {
                            results.push({ doctor: docNameText, dateStr: dateText });
                        }
                    });
                    return results;
                }, preferredDoctors);

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

                // בדיקת דף הבא לפי ה-Title "הבא" שזיהית
                const nextBtn = await target.$('a[title="הבא"]');
                if (nextBtn) {
                    console.log("➡️ עובר לדף הבא...");
                    await nextBtn.click();
                    await page.waitForTimeout(6000); 
                    pageNum++;
                } else {
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