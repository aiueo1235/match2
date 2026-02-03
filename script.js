const days = ['月', '火', '水', '木', '金'];
let myData = JSON.parse(localStorage.getItem('studySyncPro') || '{"slots":[], "tasks":"", "loc":"図書館 📚"}');

// --- グリッドとデータの初期化 ---
const grid = document.getElementById('timetable-grid');
for (let i = 0; i < 25; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (myData.slots.includes(String(i)) ? ' selected' : '');
    slot.innerHTML = `<b>${days[i % 5]}</b>${Math.floor(i / 5) + 1}`;
    slot.onclick = () => {
        slot.classList.toggle('selected');
        save();
    };
    slot.dataset.id = i;
    grid.appendChild(slot);
}

document.getElementById('task-input').value = myData.tasks;
document.getElementById('location-input').value = myData.loc;

document.querySelectorAll('input, select').forEach(el => {
    el.oninput = save;
});

function save() {
    myData = {
        slots: Array.from(document.querySelectorAll('.slot.selected')).map(s => s.dataset.id),
        tasks: document.getElementById('task-input').value,
        loc: document.getElementById('location-input').value
    };
    localStorage.setItem('studySyncPro', JSON.stringify(myData));
}

// --- 画面切り替えロジック ---
function toggleScreen(id) {
    ['setup-screen', 'qr-screen', 'match-screen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

// --- QRコード表示 ---
document.getElementById('generate-btn').onclick = () => {
    const dataStr = encodeURIComponent(JSON.stringify(myData));
    const url = `${window.location.origin}${window.location.pathname}?data=${dataStr}`;
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = ""; 
    new QRCode(qrContainer, { text: url, width: 220, height: 220 });
    toggleScreen('qr-screen');
};

// --- マッチング結果表示 ---
function showResults(friend) {
    toggleScreen('match-screen');
    document.getElementById('res-loc').textContent = friend.loc;
    
    const common = friend.slots.filter(s => myData.slots.includes(s));
    document.getElementById('res-slots').innerHTML = common.length > 0 
        ? common.map(id => `【${days[id % 5]}${Math.floor(id / 5) + 1}】`).join(' ') 
        : "重なる時間がありません😢";

    const myT = myData.tasks.split(',').map(t => t.trim().toLowerCase());
    const taskHTML = friend.tasks.split(',').map(t => t.trim()).filter(t => t).map(t => {
        const isUrgent = t.includes('!');
        const cleanT = t.replace('!', '');
        const isCommon = myT.includes(cleanT.toLowerCase());
        return `
        <div class="task-item ${isUrgent ? 'urgent' : ''}">
            <span>${isCommon ? '🤝' : '📄'} ${cleanT} ${isUrgent ? '⚠️' : ''}</span>
            <button class="done-btn" onclick="finishTask(this)">完了</button>
        </div>`;
    }).join('');
    
    document.getElementById('res-tasks').innerHTML = taskHTML || "課題なし";
}

function finishTask(btn) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    const parent = btn.parentElement;
    parent.style.opacity = "0.3";
    parent.style.textDecoration = "line-through";
    btn.remove();
}

// --- カメラ/スキャン機能 ---
const video = document.getElementById("video");
const videoContainer = document.getElementById("video-container");
let scanning = false;

document.getElementById("scan-start-btn").onclick = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
        scanning = true;
        video.srcObject = stream;
        video.play();
        videoContainer.style.display = "block";
        requestAnimationFrame(tick);
    }).catch(err => alert("カメラの起動に失敗しました。HTTPS環境か確認してください。"));
};

document.getElementById("scan-cancel-btn").onclick = stopScan;

function stopScan() {
    scanning = false;
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
    }
    videoContainer.style.display = "none";
}

function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && scanning) {
        const canvas = document.createElement("canvas");
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            try {
                const url = new URL(code.data);
                const data = url.searchParams.get("data");
                if (data) {
                    stopScan();
                    showResults(JSON.parse(decodeURIComponent(data)));
                    return;
                }
            } catch (e) {}
        }
    }
    if (scanning) requestAnimationFrame(tick);
}

// URLパラメータからの読み込み
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('data')) {
    showResults(JSON.parse(decodeURIComponent(urlParams.get('data'))));
}
