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

// is.gd / v.gd OpenAPI 호출 (JSONP 방식: 브라우저 CORS 제한을 피함)
function requestShortUrl(service, longUrl) {
    return new Promise((resolve, reject) => {
        const callbackName = 'shortCb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const script = document.createElement('script');
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('응답 시간이 초과되었습니다.'));
        }, 8000);

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

    try {
        let shortUrl;
        try {
            shortUrl = await requestShortUrl('is.gd', url);
        } catch (firstError) {
            shortUrl = await requestShortUrl('v.gd', url); // 예비 API
        }
        shortOutput.value = shortUrl;
        copyBtn.disabled = false;
        toQr.href = '../url2qr/index.html?url=' + encodeURIComponent(shortUrl);
        toQr.classList.remove('hidden');
        showMessage('URL이 단축되었습니다.', 'ok');
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
