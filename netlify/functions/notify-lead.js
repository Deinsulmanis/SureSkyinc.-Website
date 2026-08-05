// netlify/functions/notify-lead.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // Spam honeypot — silently accept and drop
  if (data._gotcha) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_PHONE_NUMBER: from,
    LEAD_ALERT_TO: to,
  } = process.env;

  if (!sid || !token || !from || !to) {
    return { statusCode: 500, body: "Missing Twilio configuration" };
  }

  const name = (data.name || "No name").toString().slice(0, 80);
  const phone = (data.phone || "No phone").toString().slice(0, 40);
  const service = (data.service_type || data.service || "Not specified").toString().slice(0, 80);
  const msg = (data.message || "").toString().slice(0, 300);

  const body =
    `New roofing lead — SureSky Homes\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}\n` +
    `Service: ${service}` +
    (msg ? `\n"${msg}"` : "");

  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    if (!res.ok) {
      console.error("Twilio error:", res.status, await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: false, sms: false }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, sms: true }) };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { statusCode: 200, body: JSON.stringify({ ok: false, sms: false }) };
  }
};
