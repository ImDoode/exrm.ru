const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.APP_PORT || 3000);
const HOST = process.env.APP_IP || '127.0.0.1';
const PUBLIC_DIR = __dirname;
const CONTACT_EMAIL = 'imdoode@gmail.com';
const SMARTCAPTCHA_SERVER_KEY = process.env.SMARTCAPTCHA_SERVER_KEY || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// SMTP
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  const remoteIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
  return remoteIp.startsWith('::ffff:') ? remoteIp.slice(7) : remoteIp;
}

function checkCaptcha(token, ip, callback) {
  if (!SMARTCAPTCHA_SERVER_KEY || !token) {
    callback(false);
    return;
  }

  const options = {
    hostname: 'smartcaptcha.yandexcloud.net',
    port: 443,
    path: '/validate?' + querystring.stringify({
      secret: SMARTCAPTCHA_SERVER_KEY,
      token,
      ip,
    }),
    method: 'GET',
  };

  const req = https.request(options, (res) => {
    const chunks = [];

    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      try {
        if (res.statusCode !== 200) {
          console.error(`SmartCaptcha validation failed: status=${res.statusCode}; body=${Buffer.concat(chunks).toString()}`);
          callback(false);
          return;
        }

        const payload = JSON.parse(Buffer.concat(chunks).toString());
        callback(payload.status === 'ok');
      } catch (error) {
        console.error('SmartCaptcha parse error:', error);
        callback(false);
      }
    });
  });

  req.on('error', (error) => {
    console.error('SmartCaptcha request error:', error);
    callback(false);
  });

  req.end();
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;

      // Максимум 100 KB
      if (size > 100 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

async function handleContactForm(req, res) {
  try {
    const data = await readRequestBody(req);

    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').trim();
    const email = String(data.email || '').trim();
    const description = String(data.description || '').trim();
    const captchaToken = String(data['smart-token'] || data.captchaToken || data.token || '').trim();

    if (!name || !phone || !email || !description) {
      sendJson(res, 400, {
        success: false,
        message: 'Заполните все поля',
      });
      return;
    }

    if (!captchaToken) {
      sendJson(res, 400, {
        success: false,
        message: 'Подтвердите, что вы не робот',
      });
      return;
    }

    const captchaPassed = await new Promise((resolve) => {
      checkCaptcha(captchaToken, getClientIp(req), resolve);
    });

    if (!captchaPassed) {
      sendJson(res, 400, {
        success: false,
        message: 'Капча не пройдена. Попробуйте ещё раз.',
      });
      return;
    }

    // Простая проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      sendJson(res, 400, {
        success: false,
        message: 'Некорректный email',
      });
      return;
    }

    await mailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.CONTACT_EMAIL || CONTACT_EMAIL,
      replyTo: email,
      subject: `Новая заявка с сайта — ${name}`,
      text: `
Новая заявка с сайта.

Имя: ${name}
Телефон: ${phone}
Email: ${email}

Описание объекта:
${description}
      `.trim(),
      html: `
        <h2>Новая заявка с сайта</h2>

        <p><strong>Имя:</strong> ${escapeHtml(name)}</p>
        <p><strong>Телефон:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>

        <h3>Описание объекта:</h3>
        <p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>
      `,
    });

    sendJson(res, 200, {
      success: true,
      message: 'Заявка успешно отправлена',
    });
  } catch (error) {
    console.error('Contact form error:', error);

    sendJson(res, 500, {
      success: false,
      message: 'Не удалось отправить заявку'
    });
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const server = http.createServer(async (req, res) => {
  // API формы
  if (req.method === 'POST' && req.url === '/api/contact') {
    await handleContactForm(req, res);
    return;
  }

  // Главная страница и статика
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  const filePath = path.resolve(PUBLIC_DIR, `.${urlPath}`);

  // Защита от выхода за пределы PUBLIC_DIR
  if (
    filePath !== PUBLIC_DIR &&
    !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)
  ) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
      });

      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});