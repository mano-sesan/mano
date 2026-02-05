const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "mail-sesan.grita.fr",
  port: 25,
  // secure: true,
});

const sendEmail = async (address, subject, text, html) => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.NODE_ENV === "development") {
    console.log("Email sent to", address, "with subject", subject);
    console.log("Text:", text);
    console.log("Html:", html);
    return;
  }

  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: `"App Mano" <no-reply-mano@sesan.fr>`,
    to: address,
    subject, // Subject line
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  });
  console.log("Message sent: %s", info.messageId);
  return info;
};

const sendEmailWithAttachment = async (address, subject, text, html, attachments) => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.NODE_ENV === "development") {
    console.log("Email sent to", address, "with subject", subject);
    console.log("Text:", text);
    console.log("Html:", html);
    console.log("Attachments:", attachments?.map((a) => a.filename));
    return;
  }

  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: `"App Mano" <no-reply-mano@sesan.fr>`,
    to: address,
    subject, // Subject line
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    attachments,
  });
  console.log("Message sent: %s", info.messageId);
  return info;
};

module.exports = {
  sendEmail,
  sendEmailWithAttachment,
};
