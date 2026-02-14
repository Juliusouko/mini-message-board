import sendSubscriptionEmail from "../services/resendService.js";

async function  subscribe(req, res) {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
        await sendSubscriptionEmail(email); 
        res.json({ message: "Subscription successful!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong." });
    }
}

export default subscribe;