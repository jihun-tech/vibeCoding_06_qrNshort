const form = document.getElementById('url-form');
const input = document.getElementById('url-input');
const stage = document.getElementById('stage');
const qrSection = document.getElementById('qr-section');
const qrBox = document.getElementById('qrcode');
const errorText = document.getElementById('error');

// 마우스 위치에 따라 그라데이션 색상 위치 변경
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty('--mx', x + '%');
    document.documentElement.style.setProperty('--my', y + '%');
});

// 주소창에서 ?url=... 로 넘어온 경우 자동 입력
const params = new URLSearchParams(location.search);
if (params.get('url')) {
    input.value = params.get('url');
}

// URL 형식 확인 (https:// 생략 시 자동 보정)
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

// QR코드 생성
form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorText.textContent = '';

    const url = normalizeUrl(input.value);
    if (!url) {
        errorText.textContent = '올바른 URL을 입력해 주세요.';
        return;
    }
    if (typeof QRCode === 'undefined') {
        errorText.textContent = 'QR코드 생성 중 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.';
        return;
    }

    input.value = url;
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
        text: url,
        width: 240,
        height: 240,
        colorDark: '#111827',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    qrSection.classList.remove('hidden');
    stage.classList.add('done');
});

// QR코드 클릭 → JPG 다운로드
qrBox.addEventListener('click', () => {
    const qrCanvas = qrBox.querySelector('canvas');
    if (!qrCanvas) return;

    // 흰 여백을 넣은 JPG로 저장
    const pad = 20;
    const canvas = document.createElement('canvas');
    canvas.width = qrCanvas.width + pad * 2;
    canvas.height = qrCanvas.height + pad * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrCanvas, pad, pad);

    const link = document.createElement('a');
    link.download = 'qrcode.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
});
