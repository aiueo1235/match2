// 全体の読み込みが終わってから実行（GitHub Pages対策）
document.addEventListener('DOMContentLoaded', () => {
    const days = ['月', '火', '水', '木', '金'];
    let myData = JSON.parse(localStorage.getItem('studySyncPro') || '{"slots":[], "tasks":"", "loc":"図書館 📚"}');

    const grid = document.getElementById('timetable-grid');
    const taskInput = document.getElementById('task-input');
    const locInput = document.getElementById('location-input');

    // --- 1. グリッド生成 ---
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

    taskInput.value = myData.tasks;
    locInput.value = myData.loc;
    [taskInput, locInput].forEach(el => el.oninput = save);

    function save() {
        myData = {
            slots: Array.from(document.querySelectorAll('.slot.selected')).map(s => s.dataset.id),
            tasks: taskInput.value,
            loc: locInput.value
        };
        localStorage.setItem('studySyncPro', JSON.stringify(myData));
    }

    // --- 2. QR生成ロジック ---
    document.getElementById('generate-btn').onclick = () => {
        // GitHub Pagesの階層構造に対応したURL取得
        const currentUrl = window.location.href.split('?')[0];
        const dataStr = encodeURIComponent(JSON.stringify(myData));
        const fullUrl = `${currentUrl}?data=${dataStr}`;
        
        const container = document.getElementById("qrcode-container");
        container.innerHTML = ""; // 初期化
        
        try {
            new QRCode(container, {
                text: fullUrl,
                width: 220,
                height: 220,
                correctLevel: QRCode.CorrectLevel.L
            });
            toggleScreen('qr-screen');
        } catch (e) {
            console.error("QR生成エラー:", e);
            alert("QRコードの生成に失敗しました。");
        }
    };

    // --- 3. マッチング処理 ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('data')) {
        try {
            const friendData = JSON.parse(decodeURIComponent(urlParams.get('data')));
            showResults(friendData);
        } catch (e) {
            console.error("データ解析失敗", e);
        }
    }

    function showResults(friend) {
        toggleScreen('match-screen');
        document.getElementById('res-loc').textContent = friend.loc;
        
        const common = friend.slots.filter(s => myData.slots.includes(s));
        document.getElementById('res-slots').innerHTML = common.length > 0 
            ? common.map(id => `【${days[id % 5]}${Math.floor(id / 5) + 1}】`).join(' ') 
            : "合う時間がないようです😢";

        const myT = myData.tasks.split(',').map(t => t.trim().toLowerCase());
        const taskHTML = friend.tasks.split(',').map(t => t.trim()).filter(t => t).map(t => {
            const isUrgent = t.includes('!');
            const cleanT = t.replace('!', '');
            const isCommon = myT.includes(cleanT.toLowerCase());
            return `
            <div class="task-item ${isUrgent ? 'urgent' : ''}">
                <span>${isCommon ? '🤝' : '📄'} ${cleanT} ${isUrgent ? '⚠️' : ''}</span>
                <button class="done-btn" onclick="finish(this)">完了</button>
            </div>`;
        }).join('');
        document.getElementById('res-tasks').innerHTML = taskHTML || "課題リストなし";
    }

    // --- 4. スキャン機能 ---
    const video = document.getElementById("video");
    const vContainer = document.getElementById("video-container");
    let scanning = false;

    document.getElementById("scan-start-btn").onclick = () => {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
            scanning = true; video.srcObject = stream; video.play();
            vContainer.style.display = "block";
            requestAnimationFrame(tick);
        }).catch(() => alert("カメラを起動できません（HTTPSが必要です）"));
    };

    document.getElementById("scan-cancel-btn").onclick = stopScan;
    function stopScan() {
        scanning = false;
        if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
        vContainer.style.display = "none";
    }

    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA && scanning) {
            const canvas = document.createElement("canvas");
            canvas.height = video.videoHeight; canvas.width = video.videoWidth;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code) {
                const data = new URL(code.data).searchParams.get("data");
                if (data) { stopScan(); showResults(JSON.parse(decodeURIComponent(data))); return; }
            }
        }
        if (scanning) requestAnimationFrame(tick);
    }
});

function toggleScreen(id) {
    ['setup-screen', 'qr-screen', 'match-screen'].forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function finish(btn) {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    btn.parentElement.style.opacity = "0.3";
    btn.remove();
}
