// netlify/functions/notify-lead.js

// Length-first, then a XOR accumulation over every character so the loop
// never short-circuits on the first mismatch. Cheap to do, and it costs
// nothing to not leak timing.
function secretMatches(given, expected) {
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

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

  // Shared secret — checked before the honeypot and before any Twilio work,
  // so an unauthorised caller can never reach the send path. While
  // LEAD_ALERT_SECRET is unset the endpoint stays open, so adding the
  // variable is what switches protection on rather than what un-breaks it.
  const secret = process.env.LEAD_ALERT_SECRET;
  if (secret) {
    const headers = event.headers || {};
    const given = headers["x-lead-secret"] || headers["X-Lead-Secret"];
    if (!secretMatches(given, secret)) {
      return { statusCode: 401, body: "Unauthorized" };
    }
  } else {
    console.warn(
      "notify-lead: LEAD_ALERT_SECRET is not set — endpoint is unprotected."
    );
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
