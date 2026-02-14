import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendSubscriptionEmail(subscriberEmail) {
    return resend.emails.send({
        from: process.env.MESSAGE_FROM,
        to: process.env.MESSAGE_TO,
        subject: "New Newsletter Subscriber",
        text: `New subscriber: ${subscriberEmail}`
    })
};

export default sendSubscriptionEmail;