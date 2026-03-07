require('dotenv').config();
const nodemailer = require('nodemailer');

// הגדרת השולח לפי ה-.env שלך
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function testEmail() {
    console.log("--- בדיקת הגדרות אימייל ---");
    console.log(`מנסה לשלוח דרך: ${process.env.EMAIL_SERVICE}`);
    console.log(`מכתובת: ${process.env.EMAIL_USER}`);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // שולח לעצמך לבדיקה
        subject: "בדיקה: בוט התורים של כללית",
        text: "אם ההודעה הזו הגיעה אליך, סיסמת האפליקציה של גוגל הוגדרה בהצלחה!"
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ הצלחה! המייל נשלח. בדוק את תיבת הדואר שלך.");
    } catch (error) {
        console.error("❌ תקלה בשליחת המייל:", error.message);
        console.log("\nטיפ: אם כתוב Invalid Login, וודא שסיסמת האפליקציה ב-.env היא ללא רווחים.");
    }
}

testEmail();