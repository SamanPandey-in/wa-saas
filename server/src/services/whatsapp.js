import https from 'https';
import fetch from 'node-fetch';

const BASE_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}`;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Low-level POST to Meta Graph API
 */
async function graphPost(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Graph API error: ${response.status}`);
  }
  return data;
}

/**
 * Send a template message to a single phone number
 *
 * @param {string} to - E.164 phone number without '+'
 * @param {string} templateName - Approved template name in Meta
 * @param {string} languageCode - e.g. 'en_US'
 * @param {Array<string>} components - variable values for template body
 * @returns {object} Meta API response
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en_US', components = []) {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components.length > 0
        ? [
            {
              type: 'body',
              parameters: components.map((val) => ({
                type: 'text',
                text: String(val),
              })),
            },
          ]
        : [],
    },
  };

  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

/**
 * Send a free-form text message (only allowed in 24h customer service window)
 * Use this for quick dev testing only — production requires templates for outbound
 */
async function sendTextMessage(to, text) {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

/**
 * Mark a message as read
 */
async function markRead(messageId) {
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

export default { sendTemplateMessage, sendTextMessage, markRead };
