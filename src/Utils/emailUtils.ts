import nodemailer from "nodemailer";
import { Config } from "../Config/config";

const transporter = nodemailer.createTransport({
    service: "googlemail.com",
    auth: {
        user: Config.EMAIL,
        pass: Config.EMAIL_PASSWORD,
    },
});

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
    try {
    const mailOptions = {
        from: Config.EMAIL,
        to: email,
        subject: "Password Reset",
        text: `You are receiving this email because you (or someone else) has requested a password reset for your account.

        Please click the following link, or paste it into your browser to complete the process:
        
        http://${Config.HOST_URL}/users/reset-password?resetToken=${resetToken}
        reset: ${resetToken}
        
        If you did not request this, please ignore this email and your password will remain unchanged.`,
    };


        await transporter.sendMail(mailOptions);
     console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Error sending password reset email')        
    }
};