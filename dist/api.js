import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * @what Loads the smooth-signature.js library from the local filesystem into a string variable.
 * @why To inject the library directly into the mobile HTML, thus avoiding Content Security Policy (CSP) errors and making the endpoint self-contained.
 * @who The Node.js server process.
 * @when This code runs once when the Directus server starts and loads the extension.
 * @where It reads the file from the same directory as this script (`dist/`).
 * @how It uses Node.js's `fs.readFileSync` to get the file content as a UTF-8 string.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let smoothSignatureLib = "";
try {
  const libPath = resolve(__dirname, "smooth-signature.js");
  smoothSignatureLib = readFileSync(libPath, "utf-8");
} catch (e) {
  console.error("[Signature Bridge] Failed to load smooth-signature.js:", e);
  smoothSignatureLib =
    'console.error("Signature library failed to load on server side.");';
}
/**
 * @what A simple in-memory key-value store for session management.
 * @why To temporarily store signature data from mobile devices before the PC client polls for it. It's lightweight and avoids database dependency for this transient data.
 * @who The endpoint handlers for submitting and checking signatures.
 * @how It's a standard JavaScript `Map` object.
 */
const sessionStore = new Map();
/**
 * @what A timer that periodically cleans up expired sessions from the `sessionStore`.
 * @why To prevent memory leaks by removing old, unclaimed signature sessions.
 * @how It uses `setInterval` to run every 30 seconds and deletes any session older than 5 minutes.
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessionStore.entries()) {
    if (now - data.createdAt > 300000) sessionStore.delete(id);
  }
}, 30000);
/**
 * @what A dictionary containing translations for the mobile UI.
 * @why To provide a localized experience on the mobile signing page based on the user's browser language.
 * @how It maps language codes (e.g., 'zh-CN', 'en') to objects containing translated strings.
 */
const mobileTranslations = {
  // 简体中文
  "zh-Hans": {
    title: "移动端签名",
    instruction: "请横屏签名",
    clear: "重写",
    submit: "提交签名",
    success: "签名已提交",
  },
  "zh-CN": {
    title: "移动端签名",
    instruction: "请横屏签名",
    clear: "重写",
    submit: "提交签名",
    success: "签名已提交",
  },
  // 繁体中文
  "zh-Hant": {
    title: "移動端簽名",
    instruction: "請橫屏簽名",
    clear: "重寫",
    submit: "提交簽名",
    success: "簽名已提交",
  },
  "zh-TW": {
    title: "移動端簽名",
    instruction: "請橫屏簽名",
    clear: "重寫",
    submit: "提交簽名",
    success: "簽名已提交",
  },
  "zh-HK": {
    title: "移動端簽名",
    instruction: "請橫屏簽名",
    clear: "重寫",
    submit: "提交簽名",
    success: "簽名已提交",
  },
  ja: {
    title: "モバイル署名",
    instruction: "横向きで署名してください",
    clear: "書き直し",
    submit: "署名を送信",
    success: "送信完了",
  },
  ko: {
    title: "모바일 서명",
    instruction: "가로 모드로 서명해 주세요",
    clear: "다시 쓰기",
    submit: "서명 제출",
    success: "제출 완료",
  },
  vi: {
    title: "Ký tên di động",
    instruction: "Vui lòng ký ở chế độ ngang",
    clear: "Viết lại",
    submit: "Gửi chữ ký",
    success: "Đã gửi thành công",
  },
  de: {
    title: "Mobile Signatur",
    instruction: "Bitte im Querformat unterschreiben",
    clear: "Löschen",
    submit: "Senden",
    success: "Erfolgreich gesendet",
  },
  fr: {
    title: "Signature Mobile",
    instruction: "Veuillez signer en mode paysage",
    clear: "Effacer",
    submit: "Envoyer",
    success: "Signature envoyée",
  },
  it: {
    title: "Firma Mobile",
    instruction: "Si prega di firmare in modalità orizzontale",
    clear: "Cancella",
    submit: "Invia firma",
    success: "Inviato con successo",
  },
  en: {
    title: "Mobile Signature",
    instruction: "Please sign in landscape mode",
    clear: "Clear",
    submit: "Submit",
    success: "Submitted",
  },
};
/**
 * @what A function that generates the complete HTML for the mobile signing page.
 * @why To dynamically create a self-contained, interactive webpage that can be sent to the user's mobile device.
 * @who The `/page/:sessionId` endpoint handler.
 * @when A user scans the QR code and their browser requests the page.
 * @param {string} sessionId - The unique ID for this signing session.
 * @param {string} [lang='en'] - The language code for localizing the UI.
 * @returns {string} A complete HTML document as a string.
 * @how It uses a template literal to construct the HTML, injecting the session ID, translations, and the pre-loaded `smoothSignatureLib` script.
 */
const getMobileHtml = (sessionId, lang = "en") => {
  const mainLang = lang.split("-")[0];
  let t = mobileTranslations[lang] || mobileTranslations[mainLang];
  if (!t && mainLang === "zh") t = mobileTranslations["zh-Hans"];
  if (!t) t = mobileTranslations["en"];

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>${t.title}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow: hidden; background: #f0f4f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; height: 100vh; width: 100vw; }
        
        /* 默认横屏布局 */
        #app-container { display: flex; flex-direction: column; height: 100%; width: 100%; }
        header { padding: 10px; text-align: center; background: #fff; flex-shrink: 0; }
        h2 { margin: 0; font-size: 16px; color: #333; }
        #canvas-container { flex: 1; position: relative; margin: 10px; background: #fff; border-radius: 8px; border: 1px solid #ddd; overflow: hidden; }
        canvas { display: block; width: 100%; height: 100%; }
        .footer { padding: 10px; display: flex; gap: 10px; background: #fff; flex-shrink: 0; }
        button { flex: 1; height: 40px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
        #undo { background: #e2e8f0; color: #475569; flex: 0.5; }
        #clear { background: #f1f5f9; color: #475569; }
        #submit { background: #6644ff; color: white; }
        /* --- 竖屏模式下的布局 --- */
        
        body.is-portrait #app-container {
            display: block;
        }
        /* 1. 标题栏 (右侧) */
        body.is-portrait header {
            position: absolute;
            right: 0; top: 0; bottom: 0; width: 45px;
            display: flex; align-items: center; justify-content: center;
            background: #fff;
            border-left: 1px solid #eee;
            z-index: 10;
        }
        body.is-portrait header h2 {
            white-space: nowrap;
            transform: rotate(90deg);
            font-size: 14px;
            margin: 0;
            padding: 0;
        }
        /* 2. 按钮栏 (左侧) */
        body.is-portrait .footer {
            position: absolute;
            left: 0; top: 0; bottom: 0; width: 65px;
            flex-direction: column;
            justify-content: space-around;
            align-items: center;
            padding: 10px 5px;
            background: #fff;
            border-right: 1px solid #eee;
            z-index: 10;
        }
        
        /* 3. 按钮本身 */
        body.is-portrait .footer button {
            width: 100%;
            height: auto;
            flex: 1;
            max-height: 120px;
            margin: 8px 0;
            padding: 5px;
            font-size: 16px;
            /* 关键修复：让按钮成为 flex 容器来居中内部的 span */
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden; /* 防止旋转后的内容溢出 */
        }
        body.is-portrait .footer button#undo {
            font-size: 24px;
            flex: 0.5;
            max-height: 60px;
        }
        /* 4. 按钮内的文字 SPAN */
        body.is-portrait .footer button span {
            display: block;
            white-space: nowrap; /* 强制不换行 */
            transform: rotate(90deg); /* 只旋转文字 */
        }
        /* 5. 画布区域 (中间) */
        body.is-portrait #canvas-container {
            position: absolute;
            top: 0; bottom: 0;
            left: 65px;
            right: 45px;
            margin: 0;
            border: none;
            border-radius: 0;
        }
    </style>
</head>
<body>
    <div id="app-container">
        <header><h2>${t.instruction}</h2></header>
        <div id="canvas-container"><canvas id="pad"></canvas></div>
        <div class="footer">
            <!-- 核心修改：将文字包裹在 span 中 -->
            <button id="undo"><span>↺</span></button>
            <button id="clear"><span>${t.clear}</span></button>
            <button id="submit"><span>${t.submit}</span></button>
        </div>
    </div>
    
    <script>
        // 注入库
        ${smoothSignatureLib}
    </script>
    <script>
        // JavaScript 逻辑完全不需要修改
        const canvas = document.getElementById('pad');
        const container = document.getElementById('canvas-container');
        let signature = null;
        let isPortrait = false;
        function checkOrientationAndInit() {
            isPortrait = window.innerHeight > window.innerWidth;
            document.body.classList.toggle('is-portrait', isPortrait);
            
            setTimeout(() => {
                const options = {
                    width: container.clientWidth,
                    height: container.clientHeight,
                    scale: window.devicePixelRatio || 2,
                    minWidth: 3,
                    maxWidth: 8,
                    color: '#000000',
                    bgColor: '#ffffff'
                };
                if (window.SmoothSignature) {
                    signature = new window.SmoothSignature(canvas, options);
                }
            }, 150);
        }
        window.addEventListener('resize', () => setTimeout(checkOrientationAndInit, 300));
        
        checkOrientationAndInit();
        document.getElementById('undo').onclick = () => signature && signature.undo();
        document.getElementById('clear').onclick = () => signature && signature.clear();
        document.getElementById('submit').onclick = async () => {
            if (!signature || signature.isEmpty()) {
                alert('Empty signature');
                return;
            }
            
            let base64;
            if (isPortrait) {
                const rotated = signature.getRotateCanvas(-90);
                base64 = rotated.toDataURL('image/png');
            } else {
                base64 = signature.getPNG();
            }
            const btn = document.getElementById('submit');
            btn.innerText = '...';
            btn.disabled = true;
            
            try {
                const res = await fetch('../submit/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signature: base64 })
                });
                if(res.ok) {
                    document.body.innerHTML = '<div style="display:flex;height:100vh;justify-content:center;align-items:center;color:#6644ff"><h2>${t.success}</h2></div>';
                }
            } catch(e) {
                alert('Error');
                btn.disabled = false;
            }
        };
    </script>
</body>
</html>
`;
};
/**
 * @what The main export that registers the API endpoints with Directus.
 * @why To expose the signature bridge functionality via HTTP routes.
 * @who The Directus extension loader.
 * @when The Directus server starts.
 * @how It uses the `handler` function which receives a router instance to define the GET and POST routes.
 */
var e0 = {
  id: "signature-bridge",
  handler: (router) => {
    /**
     * @what Endpoint to serve the mobile signing page.
     * @why To provide the UI for users who scan the QR code.
     * @how It detects the user's language, creates a new session in `sessionStore`, and sends the generated HTML from `getMobileHtml`.
     */
    router.get("/page/:sessionId", (req, res) => {
      const { sessionId } = req.params;
      const lang =
        req.acceptsLanguages([
          "zh-Hans",
          "zh-Hans",
          "ja",
          "ko",
          "vi",
          "de",
          "fr",
          "it",
          "en",
        ]) || "en";

      if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, {
          status: "pending",
          createdAt: Date.now(),
        });
      }
      res.send(getMobileHtml(sessionId, lang));
    });

    /**
     * @what Endpoint to receive the submitted signature from the mobile page.
     * @why To capture the signature data from the mobile device.
     * @how It receives a POST request with the Base64 image data and updates the corresponding session in `sessionStore` to 'completed'.
     */    router.post("/submit/:sessionId", (req, res) => {
      const { sessionId } = req.params;
      const { signature } = req.body;
      if (!signature) return res.status(400).send("Missing data");

      sessionStore.set(sessionId, {
        status: "completed",
        signature,
        createdAt: Date.now(),
      });
      res.json({ success: true });
    });

    /**
     * @what Endpoint for the PC interface to poll for the signature status.
     * @why To allow the PC client to know when the mobile signature is complete.
     * @how It checks the status of the session in `sessionStore`. If 'completed', it returns the signature data and deletes the session (read-once).
     */
      router.get("/check/:sessionId", (req, res) => {
      const { sessionId } = req.params;
      const session = sessionStore.get(sessionId);
      if (!session) return res.status(404).json({ status: "not_found" });

      if (session.status === "completed") {
        sessionStore.delete(sessionId); // 阅后即焚
        return res.json({ status: "completed", signature: session.signature });
      }
      res.json({ status: "pending" });
    });
  },
};

const hooks = [];const endpoints = [{name:'signature-bridge',config:e0}];const operations = [];

export { endpoints, hooks, operations };
