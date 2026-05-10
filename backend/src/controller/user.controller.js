
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import { createContact } from '../../../chat-app/src/db/db.models.js';


const  RESEND_API_KEY = re_Xi2jrcMW_AzV4FP72DTXa8N7JWmBQWe4d //env file content
const resend = new Resend(RESEND_API_KEY);

export const signUp =async (req,res)=>{
    const { email , phoneNumber, firstName, lastName, photoUrl } = req.body;

    await createContact(phoneNumber,email, firstName, lastName, photoUrl);

    resend.emails.send({
            from: 'batshiditshiamo@gmail.com',
            to: email,
            subject: 'Hello World',
            html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
     });
    

}
