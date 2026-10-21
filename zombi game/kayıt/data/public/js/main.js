// State variables
let socket = null;
let participants = [];
let currentFilter = 'all';
let searchQuery = '';
let soundEnabled = true;

// Web Audio API Sound Synthesizer (No external sound files required)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Notification Chime when someone joins
function playNewUserSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
  } catch (e) {
    console.error('Ses çalınamadı:', e);
  }
}

// Grand Chime when someone is called
function playCallNextSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.25, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });
  } catch (e) {
    console.error('Ses çalınamadı:', e);
  }
}

// Toast Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'call') icon = '📢';
  if (type === 'danger') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Time Formatting Helper (e.g. "2 dk önce" or "19:45")
function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 45) return 'Az önce';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// DOM Elements
const qrImage = document.getElementById('qrImage');
const qrLinkText = document.getElementById('qrLinkText');
const btnCopyLink = document.getElementById('btnCopyLink');
const btnOpenLink = document.getElementById('btnOpenLink');
const tunnelStatusBox = document.getElementById('tunnelStatusBox');
const tunnelStatusText = document.getElementById('tunnelStatusText');
const btnRestartTunnel = document.getElementById('btnRestartTunnel');
const btnCallNext = document.getElementById('btnCallNext');
const btnSoundToggle = document.getElementById('btnSoundToggle');
const soundIcon = document.getElementById('soundIcon');
const soundText = document.getElementById('soundText');
const btnFullscreen = document.getElementById('btnFullscreen');
const queueListContainer = document.getElementById('queueListContainer');
const searchInput = document.getElementById('searchInput');
const callBanner = document.getElementById('callBanner');
const callBannerName = document.getElementById('callBannerName');

// Stats Elements
const statTotal = document.getElementById('statTotal');
const statWaiting = document.getElementById('statWaiting');
const statPlaying = document.getElementById('statPlaying');
const statCompleted = document.getElementById('statCompleted');
const countAll = document.getElementById('countAll');
const countWaiting = document.getElementById('countWaiting');
const countPlaying = document.getElementById('countPlaying');
const countCompleted = document.getElementById('countCompleted');

// Modal Elements
const modalManualAdd = document.getElementById('modalManualAdd');
const btnOpenManualAdd = document.getElementById('btnOpenManualAdd');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const formManualAdd = document.getElementById('formManualAdd');
const manualInstagram = document.getElementById('manualInstagram');
const manualName = document.getElementById('manualName');
const btnClearCompleted = document.getElementById('btnClearCompleted');
const btnClearAll = document.getElementById('btnClearAll');

// Initialize App
async function init() {
  await loadServerInfo();
  await loadParticipants();
  initSocket();
  setupEventListeners();
}

// Load QR & Info
async function loadServerInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    renderServerInfo(data);
  } catch (err) {
    console.error('Bilgi alınırken hata:', err);
  }
}

function renderServerInfo(data) {
  if (data.qrCode) {
    qrImage.src = data.qrCode;
  } else {
    qrImage.removeAttribute('src');
  }
  if (data.joinUrl) {
    qrLinkText.textContent = data.joinUrl;
    qrLinkText.dataset.url = data.joinUrl;
    if (btnOpenLink) btnOpenLink.href = data.joinUrl;
  } else {
    qrLinkText.textContent = data.tunnelStatus === 'starting'
      ? 'İnternet bağlantısı hazırlanıyor...'
      : 'Geçerli bir katılım bağlantısı yok.';
    qrLinkText.dataset.url = '';
    if (btnOpenLink) {
      btnOpenLink.removeAttribute('href');
      btnOpenLink.setAttribute('aria-disabled', 'true');
    }
  }
  if (btnOpenLink && data.joinUrl) btnOpenLink.removeAttribute('aria-disabled');
  if (btnCopyLink) btnCopyLink.disabled = !data.joinUrl;

  // Update Tunnel Status Box
  if (tunnelStatusBox) {
    tunnelStatusBox.className = `tunnel-status-box status-${data.tunnelStatus || 'offline'}`;
    if (data.tunnelStatus === 'online') {
      tunnelStatusText.textContent = '🟢 İnternet bağlantısı aktif (Wi-Fi ve mobil internet)';
    } else if (data.tunnelStatus === 'starting') {
      tunnelStatusText.textContent = '🟡 İnternet Tüneli Hazırlanıyor... (Lütfen bekleyin)';
    } else if (data.tunnelStatus === 'error') {
      tunnelStatusText.textContent = '🔴 Tünel Açılamadı (' + (data.tunnelError || 'Hata') + ')';
    } else {
      tunnelStatusText.textContent = '⚪ Tünel Kapalı';
    }
  }

}

// Load participants from API
async function loadParticipants() {
  try {
    const res = await fetch('/api/participants');
    participants = await res.json();
    renderQueue();
    updateStats();
  } catch (err) {
    console.error('Katılımcılar alınırken hata:', err);
  }
}

// Socket.IO Setup
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Sunucuya gerçek zamanlı bağlandı.');
  });

  socket.on('initial:state', (data) => {
    if (data.participants) {
      participants = data.participants;
      renderQueue();
      updateStats();
    }
    if (typeof data.joinUrl === 'string') {
      renderServerInfo(data);
    }
  });

  socket.on('participant:added', (data) => {
    participants.push(data.participant);
    renderQueue();
    updateStats();
    playNewUserSound();
    showToast(`@${data.participant.instagram} sıraya katıldı! (#${data.position})`, 'success');
  });

  socket.on('participant:updated', (data) => {
    const idx = participants.findIndex(p => p.id === data.participant.id);
    if (idx !== -1) {
      participants[idx] = data.participant;
    } else {
      participants.push(data.participant);
    }
    renderQueue();
    updateStats();
  });

  socket.on('participant:called', (data) => {
    playCallNextSound();
    triggerCallBanner(data.participant.instagram);
    showToast(`📢 @${data.participant.instagram} sıraya çağrıldı!`, 'call');
  });

  socket.on('participant:deleted', (data) => {
    participants = participants.filter(p => p.id !== data.id);
    renderQueue();
    updateStats();
    showToast(`@${data.participant.instagram} listeden çıkarıldı.`, 'info');
  });

  socket.on('list:cleared', (data) => {
    participants = data.allParticipants || [];
    renderQueue();
    updateStats();
    showToast('Katılımcı listesi güncellendi.', 'info');
  });

  socket.on('settings:updated', (data) => {
    if (data && typeof data.joinUrl === 'string') {
      renderServerInfo(data);
    } else {
      loadServerInfo();
    }
  });
}

// Big Call Banner Animation
let bannerTimeout = null;
function triggerCallBanner(instagram) {
  callBannerName.textContent = '@' + instagram;
  callBanner.classList.add('show');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => {
    callBanner.classList.remove('show');
  }, 6000);
}

// Render the Queue List
function renderQueue() {
  // Filter participants
  let filtered = [...participants];

  if (currentFilter !== 'all') {
    filtered = filtered.filter(p => p.status === currentFilter);
  }

  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.instagram.toLowerCase().includes(query) ||
      (p.name && p.name.toLowerCase().includes(query))
    );
  }

  // Waiting users count for dynamic ranking
  const waitingUsers = participants.filter(p => p.status === 'waiting');

  if (filtered.length === 0) {
    queueListContainer.innerHTML = `
      <div class="queue-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p style="font-size: 16px; font-weight: 600;">Henüz bu filtrede kimse yok</p>
        <p style="font-size: 13px; margin-top: 4px;">QR kodu okutarak yeni oyuncular sıraya katılabilir.</p>
      </div>
    `;
    return;
  }

  let html = '';

  filtered.forEach(p => {
    // Determine rank in waiting queue if waiting
    let rankText = `#${p.ticketNumber}`;
    let rankClass = '';
    
    if (p.status === 'waiting') {
      const waitIndex = waitingUsers.findIndex(u => u.id === p.id);
      if (waitIndex === 0) {
        rankText = '1';
        rankClass = 'top-1';
      } else if (waitIndex === 1) {
        rankText = '2';
        rankClass = 'top-2';
      } else if (waitIndex === 2) {
        rankText = '3';
        rankClass = 'top-3';
      } else {
        rankText = `${waitIndex + 1}`;
      }
    } else if (p.status === 'playing') {
      rankText = '🎮';
    } else if (p.status === 'completed') {
      rankText = '✓';
    }

    // Status pill
    let statusPill = '';
    if (p.status === 'waiting') {
      statusPill = `<span class="p-status-pill status-pill-waiting">⏳ Bekliyor</span>`;
    } else if (p.status === 'playing') {
      statusPill = `<span class="p-status-pill status-pill-playing">🟢 Oynuyor</span>`;
    } else if (p.status === 'completed') {
      statusPill = `<span class="p-status-pill status-pill-completed">⚪ Tamamlandı</span>`;
    }

    const initial = (p.name || p.instagram).charAt(0).toUpperCase();

    html += `
      <div class="participant-row status-${p.status}" data-id="${p.id}">
        <div class="p-left">
          <div class="p-rank ${rankClass}" title="Sıra Numarası: ${p.ticketNumber}">${rankText}</div>
          <div class="p-avatar">${initial}</div>
          <div class="p-info">
            <a href="https://instagram.com/${p.instagram}" target="_blank" rel="noopener noreferrer" class="p-handle">
              @${p.instagram}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
            <div class="p-meta">
              ${p.name ? `<span style="color: #e2e8f0; font-weight: 500;">${p.name}</span> • ` : ''}
              <span>${formatTimeAgo(p.joinedAt)}</span>
              ${statusPill}
            </div>
          </div>
        </div>

        <div class="p-actions">
          ${p.status === 'waiting' ? `
            <button class="btn btn-primary" onclick="callParticipant('${p.id}')" style="padding: 7px 12px; font-size: 12.5px;">
              ⚡ Çağır / Oynat
            </button>
          ` : ''}

          ${p.status === 'playing' ? `
            <button class="btn btn-success" onclick="updateParticipantStatus('${p.id}', 'completed')" style="padding: 7px 12px; font-size: 12.5px;">
              ✅ Tamamla
            </button>
          ` : ''}

          ${p.status === 'completed' ? `
            <button class="btn btn-secondary" onclick="updateParticipantStatus('${p.id}', 'waiting')" style="padding: 7px 10px; font-size: 12px;">
              ↩ Geri Al
            </button>
          ` : ''}

          <button class="btn btn-danger btn-icon" onclick="deleteParticipant('${p.id}')" title="Listeden Sil">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  });

  queueListContainer.innerHTML = html;
}

// Update Header Stats
function updateStats() {
  const total = participants.length;
  const waiting = participants.filter(p => p.status === 'waiting').length;
  const playing = participants.filter(p => p.status === 'playing').length;
  const completed = participants.filter(p => p.status === 'completed').length;

  statTotal.textContent = total;
  statWaiting.textContent = waiting;
  statPlaying.textContent = playing;
  statCompleted.textContent = completed;

  countAll.textContent = total;
  countWaiting.textContent = waiting;
  countPlaying.textContent = playing;
  countCompleted.textContent = completed;
}

// Action: Call Next Waiting Participant
async function callNextParticipant() {
  try {
    const res = await fetch('/api/participants/call-next', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Bekleyen oyuncu bulunamadı.', 'info');
    }
  } catch (err) {
    showToast('Hata oluştu: ' + err.message, 'danger');
  }
}

// Action: Call Specific Participant
async function callParticipant(id) {
  try {
    await fetch(`/api/participants/${id}/call`, { method: 'POST' });
  } catch (err) {
    showToast('İşlem başarısız: ' + err.message, 'danger');
  }
}

// Action: Update Status
async function updateParticipantStatus(id, status) {
  try {
    await fetch(`/api/participants/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  } catch (err) {
    showToast('Durum güncellenemedi: ' + err.message, 'danger');
  }
}

// Action: Delete Participant
async function deleteParticipant(id) {
  if (!confirm('Bu katılımcıyı listeden kaldırmak istediğinize emin misiniz?')) return;
  try {
    await fetch(`/api/participants/${id}`, { method: 'DELETE' });
  } catch (err) {
    showToast('Silinemedi: ' + err.message, 'danger');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Call Next button
  btnCallNext.addEventListener('click', () => {
    getAudioContext(); // ensure audio context is active on user click
    callNextParticipant();
  });

  // Sound Toggle
  btnSoundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundText.textContent = soundEnabled ? 'Ses Açık' : 'Sessiz';
    if (soundEnabled) {
      getAudioContext();
      playNewUserSound();
    }
  });

  // Fullscreen Toggle
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  });

  // Copy QR Link
  btnCopyLink.addEventListener('click', () => {
    const url = qrLinkText.dataset.url || qrLinkText.textContent;
    if (!qrLinkText.dataset.url) {
      showToast('Kopyalanacak geçerli bir bağlantı henüz hazır değil.', 'danger');
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      showToast('Bağlantı panoya kopyalandı!', 'success');
    }).catch(() => {
      showToast('Kopyalanamadı, lütfen manuel kopyalayın.', 'danger');
    });
  });

  // Restart Tunnel
  if (btnRestartTunnel) {
    btnRestartTunnel.addEventListener('click', async () => {
      try {
        btnRestartTunnel.disabled = true;
        btnRestartTunnel.textContent = 'Yenileniyor...';
        await fetch('/api/tunnel/restart', { method: 'POST' });
        showToast('İnternet tüneli yenileniyor...', 'info');
        setTimeout(() => {
          btnRestartTunnel.disabled = false;
          btnRestartTunnel.textContent = '🔄 Yenile';
        }, 3000);
      } catch (err) {
        showToast('Tünel yenilenemedi: ' + err.message, 'danger');
        btnRestartTunnel.disabled = false;
        btnRestartTunnel.textContent = '🔄 Yenile';
      }
    });
  }

  // Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderQueue();
    });
  });

  // Search Input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderQueue();
  });

  // Modal: Manual Add
  btnOpenManualAdd.addEventListener('click', () => {
    modalManualAdd.classList.add('open');
    manualInstagram.focus();
  });

  const closeModal = () => {
    modalManualAdd.classList.remove('open');
    formManualAdd.reset();
  };

  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  formManualAdd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const instagram = manualInstagram.value.trim();
    const name = manualName.value.trim();

    if (!instagram) return;

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram, name })
      });
      const data = await res.json();
      if (res.ok) {
        closeModal();
      } else {
        alert(data.error || 'Katılımcı eklenemedi.');
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  });

  // Clear completed
  btnClearCompleted.addEventListener('click', async () => {
    if (!confirm('Tamamlanan tüm oyuncuları listeden silmek istiyor musunuz?')) return;
    try {
      await fetch('/api/participants/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'completed' })
      });
    } catch (err) {
      showToast('Hata: ' + err.message, 'danger');
    }
  });

  // Clear all
  btnClearAll.addEventListener('click', async () => {
    if (!confirm('DİKKAT: Listedeki TÜM kayıtlar silinecek. Emin misiniz?')) return;
    try {
      await fetch('/api/participants/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      });
    } catch (err) {
      showToast('Hata: ' + err.message, 'danger');
    }
  });
}

// Start on load
window.addEventListener('DOMContentLoaded', init);
