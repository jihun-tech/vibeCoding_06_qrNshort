const longInput = document.getElementById('long-url');
const shortenBtn = document.getElementById('shorten-btn');
const shortOutput = document.getElementById('short-url');
const copyBtn = document.getElementById('copy-btn');
const message = document.getElementById('message');
const toQr = document.getElementById('to-qr');

// 입력 필드가 비어 있으면 '단축하기' 버튼 비활성화
longInput.addEventListener('input', () => {
    shortenBtn.disabled = longInput.value.trim() === '';
});

// Enter 키로도 단축
longInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !shortenBtn.disabled) shortenBtn.click();
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = 'message ' + (type || '');
}

function normalizeUrl(value) {
    let url = value.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
        new URL(url);
        return url;
    } catch (e) {
        return null;
    }
}

const TIMEOUT_MS = 6000;

// 응답이 단축 URL 형태인지 확인
function checkShortUrl(text) {
    const s = (text || '').trim();
    if (/^https?:\/\/\S+$/i.test(s)) return s;
    throw new Error('잘못된 응답');
}

// 시간 제한이 있는 fetch
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res;
    } finally {
        clearTimeout(timer);
    }
}

// ① TinyURL OpenAPI
async function tinyUrl(longUrl) {
    const res = await fetchWithTimeout('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl));
    return checkShortUrl(await res.text());
}

// ② da.gd OpenAPI
async function daGd(longUrl) {
    const res = await fetchWithTimeout('https://da.gd/s?url=' + encodeURIComponent(longUrl));
    return checkShortUrl(await res.text());
}

// ③ spoo.me OpenAPI
async function spooMe(longUrl) {
    const body = new URLSearchParams({ url: longUrl });
    const res = await fetchWithTimeout('https://spoo.me/', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body
    });
    const data = await res.json();
    return checkShortUrl(data.short_url);
}

// ④ is.gd / v.gd OpenAPI (JSONP 방식)
function requestShortUrl(service, longUrl) {
    return new Promise((resolve, reject) => {
        const callbackName = 'shortCb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const script = document.createElement('script');
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('응답 시간이 초과되었습니다.'));
        }, TIMEOUT_MS);

        function cleanup() {
            clearTimeout(timer);
            delete window[callbackName];
            script.remove();
        }

        window[callbackName] = (data) => {
            cleanup();
            if (data && data.shorturl) resolve(data.shorturl);
            else reject(new Error((data && data.errormessage) || 'URL 단축에 실패했습니다.'));
        };

        script.onerror = () => {
            cleanup();
            reject(new Error('네트워크 오류가 발생했습니다.'));
        };

        script.src = `https://${service}/create.php?format=json&callback=${callbackName}&url=${encodeURIComponent(longUrl)}`;
        document.body.appendChild(script);
    });
}

// '단축하기' 클릭
shortenBtn.addEventListener('click', async () => {
    const url = normalizeUrl(longInput.value);
    if (!url) {
        showMessage('올바른 URL을 입력해 주세요.', 'error');
        return;
    }

    shortenBtn.disabled = true;
    shortenBtn.textContent = '단축 중...';
    showMessage('');
    shortOutput.value = '';
    copyBtn.disabled = true;
    toQr.classList.add('hidden');

    // 접속되는 OpenAPI를 찾을 때까지 차례로 시도
    const services = [
        { name: 'TinyURL', run: tinyUrl },
        { name: 'da.gd', run: daGd },
        { name: 'spoo.me', run: spooMe },
        { name: 'is.gd', run: (u) => requestShortUrl('is.gd', u) },
        { name: 'v.gd', run: (u) => requestShortUrl('v.gd', u) }
    ];

    try {
        let shortUrl = null;
        let usedService = '';
        for (const s of services) {
            try {
                shortUrl = await s.run(url);
                usedService = s.name;
                break;
            } catch (err) {
                console.warn(`[URL단축] ${s.name} 실패:`, err.message);
            }
        }
        if (!shortUrl) {
            throw new Error('모든 URL 단축 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }

        shortOutput.value = shortUrl;
        copyBtn.disabled = false;
        toQr.href = '../url2qr/index.html?url=' + encodeURIComponent(shortUrl);
        toQr.classList.remove('hidden');
        showMessage(`URL이 단축되었습니다. (사용 API: ${usedService})`, 'ok');
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        shortenBtn.textContent = '단축하기';
        shortenBtn.disabled = longInput.value.trim() === '';
    }
});

// '복사' 클릭 → 클립보드 복사 후 알림
copyBtn.addEventListener('click', async () => {
    const text = shortOutput.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        shortOutput.select();
        document.execCommand('copy');
    }
    alert('복사하였습니다');
});
