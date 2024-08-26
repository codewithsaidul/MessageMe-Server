const dotenv = require("dotenv");
require('dotenv').config();
const mailjet = require('node-mailjet').apiConnect(process.env.MJ_API_KEY, process.env.MJ_API_SECRET);

const sendMJMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
    const from = "saidulislamr333@gmail.com"; // Replace with your verified Mailjet sender

    const msg = {
      "Messages":[
        {
          "From": {
            "Email": from,
            "Name": sender // Optionally, include the sender's name
          },
          "To": [
            {
              "Email": to,
              "Name": to // Optionally, include the recipient's name
            }
          ],
          "Subject": subject,
          "TextPart": text, // Text version of the email
          "HTMLPart": html, // HTML version of the email
          "Attachments": attachments ? attachments.map((attachment) => ({
            "ContentType": attachment.contentType,
            "Filename": attachment.filename,
            "Base64Content": attachment.content.toString('base64')
          })) : undefined
        }
      ]
    };

    return mailjet.post("send", {'version': 'v3.1'}).request(msg);
  } catch (error) {
    console.log(error);
  }
};

exports.sendEmail = async (args) => {
  if (!process.env.NODE_ENV === "development") {
    return Promise.resolve();
  } else {
    return sendMJMail(args);
  }
};
