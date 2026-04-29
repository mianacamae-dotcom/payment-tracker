// /api/drive-upload.js
// Serverless function: receives a file + company name and uploads to the right Google Drive folder.
// Returns the uploaded file's URL on success.

import { google } from 'googleapis';

// Map: company name -> Drive folder ID
// Keep this in sync with DRIVE_FOLDERS in index.html
const FOLDER_IDS = {
  'Vonston': '1quWmH6G6BmRKb5wXGfLk96YQ9FxZht3-',
  'Golden Mile': '15dbqoaK1L-U8gceHoB2BdJe7iLmp-ej1',
  'Época': '1TOxIkWZy10lpt8BY5Dl1__VGHcAMyFeq',
  'BAIES': '1thzKoit0_GjLxRWKA88y-R5ar7Sr3lG2',
  'Winner Direction': '1cOr208o6-xgVTqennyyGWAjTPfBjl8OR',
  'Manjerico Palaciano': '1TKQHKOCsfhFBAX9356jRdB9G0uVRV0be'
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsRaw) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set' });
  }

  let creds;
  try {
    creds = JSON.parse(credsRaw);
  } catch (e) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON' });
  }

  try {
    const { company, fileName, mimeType, fileBase64 } = req.body || {};

    if (!company || !fileName || !mimeType || !fileBase64) {
      return res.status(400).json({ error: 'Missing required fields: company, fileName, mimeType, fileBase64' });
    }

    const folderId = FOLDER_IDS[company];
    if (!folderId) {
      return res.status(400).json({ error: `Unknown company: ${company}` });
    }

    // Authenticate as the service account
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert base64 string -> Buffer -> Readable stream for Drive upload
    const buffer = Buffer.from(fileBase64, 'base64');
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);

    const result = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: mimeType,
        body: stream
      },
      fields: 'id, webViewLink, webContentLink'
    });

    return res.status(200).json({
      ok: true,
      fileId: result.data.id,
      webViewLink: result.data.webViewLink
    });
  } catch (error) {
    console.error('Drive upload error:', error);
    const msg = error?.message || String(error);
    return res.status(500).json({ error: msg });
  }
}
