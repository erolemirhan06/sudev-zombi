// Elements
const joinFormCard = document.getElementById('joinFormCard');
const joinForm = document.getElementById('joinForm');
const instagramInput = document.getElementById('instagramInput');
const nameInput = document.getElementById('nameInput');
const btnSubmit = document.getElementById('btnSubmit');
const alertBox = document.getElementById('alertBox');

const ticketCard = document.getElementById('ticketCard');
const ticketBadge = document.getElementById('ticketBadge');
const ticketPosition = document.getElementById('ticketPosition');
const ticketStatusCard = document.getElementById('ticketStatusCard');
const ticketStatusIcon = document.getElementById('ticketStatusIcon');
const ticketStatusTitle = document.getElementById('ticketStatusTitle');
const ticketStatusDesc = document.getElementById('ticketStatusDesc');
const ticketInstagram = document.getElementById('ticketInstagram');
const ticketName = document.getElementById('ticketName');
const btnLeaveQueue = document.getElementById('btnLeaveQueue');

// State
let socket = null;
let currentParticipant = null;
let pollTimer = null;

// Local Storage Key
const STORAGE_KEY = 'oyun_bilet_kayit';

// Alert Helper
function showAlert(message) {
  alertBox.textContent = message;
  alertBox.style.display = 'block';
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 4500);
}

// Initialize Mobile View
async function init() {
  // Always register form listeners immediately so UI is interactive
  setupEventListeners();

  const isNewRegistration = new URLSearchParams(window.location.search).get('register') === '1';
  if (isNewRegistration) {
    showFormView();
    initSocket();
    return;
  }

  // Check saved ticket in localStorage
  let savedData = null;
  try {
    savedData = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Yerel bilet kaydı okunamadı:', err);
  }
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      if (parsed && parsed.id) {
        await checkTicketStatus(parsed.id);
      }
    } catch (e) {
      clearSavedTicket();
    }
  }

  // Initialize real-time updates safely
  initSocket();
}

function saveTicket(participant) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(participant));
  } catch (err) {
    console.warn('Bilet bu cihazda kaydedilemedi:', err);
  }
}

function clearSavedTicket() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Bu cihazdaki bilet kaydı silinemedi:', err);
  }
}

// Start polling fallback (guarantees updates even if websockets are blocked or asleep)
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (currentParticipant) {
      refreshStatus();
    }
  }, 3500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Check participant status on server
async function checkTicketStatus(id) {
  try {
    const res = await fetch(`/api/status/${id}`);
    if (res.ok) {
      const data = await res.json();
      currentParticipant = data.participant;
      showTicketView(currentParticipant, data.position, data.aheadCount);
      startPolling();
    } else {
      // Participant was deleted or doesn't exist
      clearSavedTicket();
      stopPolling();
      showFormView();
    }
  } catch (err) {
    console.error('Durum sorgulanamadı:', err);
  }
}

// Safe Socket Setup
function initSocket() {
  try {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO kütüphanesi yok, HTTP yoklama modu aktif.');
      startPolling();
      return;
    }

    socket = io({
      reconnectionAttempts: 10,
      timeout: 8000
    });

    socket.on('connect', () => {
      console.log('Sunucuyla canlı bağlantı kuruldu.');
    });

    socket.on('disconnect', () => {
      console.log('Canlı bağlantı koptu, yoklama modu devrede.');
      startPolling();
    });

    // Live status updates
    socket.on('participant:updated', (data) => {
      if (currentParticipant && data.participant.id === currentParticipant.id) {
        currentParticipant = data.participant;
        refreshStatus();
      } else if (currentParticipant) {
        refreshStatus();
      }
    });

    // Called event
    socket.on('participant:called', (data) => {
      if (currentParticipant && data.participant.id === currentParticipant.id) {
        currentParticipant = data.participant;
        refreshStatus();

        // Vibration notification on mobile
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([300, 150, 300, 150, 400]);
          } catch (e) {}
        }
      } else if (currentParticipant) {
        refreshStatus();
      }
    });

    socket.on('participant:deleted', (data) => {
      if (currentParticipant && data.id === currentParticipant.id) {
        clearSavedTicket();
        currentParticipant = null;
        stopPolling();
        showFormView();
        showAlert('Sıra kaydınız listeden kaldırıldı.');
      } else if (currentParticipant) {
        refreshStatus();
      }
    });

    socket.on('participant:added', () => {
      if (currentParticipant) {
        refreshStatus();
      }
    });

    socket.on('list:cleared', (data) => {
      if (currentParticipant) {
        const exists = (data.allParticipants || []).some(p => p.id === currentParticipant.id);
        if (!exists) {
          clearSavedTicket();
          currentParticipant = null;
          stopPolling();
          showFormView();
          showAlert('Katılımcı listesi yönetici tarafından temizlendi.');
        }
      }
    });
  } catch (err) {
    console.warn('Socket.IO başlatılamadı:', err);
    startPolling();
  }
}

// Refresh position from server
async function refreshStatus() {
  if (!currentParticipant) return;
  try {
    const res = await fetch(`/api/status/${currentParticipant.id}`);
    if (res.ok) {
      const data = await res.json();
      currentParticipant = data.participant;
      showTicketView(currentParticipant, data.position, data.aheadCount);
    }
  } catch (err) {
    console.error('Yenileme hatası:', err);
  }
}

// Render Form View
function showFormView() {
  joinFormCard.style.display = 'block';
  ticketCard.style.display = 'none';
  btnSubmit.disabled = false;
  btnSubmit.innerHTML = '<span>Sıraya Katıl 🚀</span>';
}

// Render Ticket View
function showTicketView(participant, position, aheadCount) {
  joinFormCard.style.display = 'none';
  ticketCard.style.display = 'block';

  ticketInstagram.textContent = '@' + participant.instagram;
  ticketName.textContent = participant.name ? `(${participant.name})` : '';

  // Update styles based on status
  ticketBadge.className = `ticket-badge status-${participant.status}`;
  ticketStatusCard.className = `ticket-status-card status-${participant.status}`;

  if (participant.status === 'waiting') {
    ticketBadge.textContent = '⏳ Sırada Bekleniyor';
    ticketPosition.textContent = `#${position > 0 ? position : participant.ticketNumber}`;
    ticketStatusIcon.textContent = '⏳';
    ticketStatusTitle.textContent = position === 1 ? 'Sıradaki Sizsiniz!' : 'Sıradasınız';
    
    if (aheadCount === 0) {
      ticketStatusDesc.textContent = 'Hazır olun! Sıradaki ilk kişi sizsiniz.';
    } else {
      ticketStatusDesc.textContent = `Önünüzde ${aheadCount} kişi var. Lütfen sıranızı bekleyin.`;
    }
  } else if (participant.status === 'playing') {
    ticketBadge.textContent = '🟢 SIRANIZ GELDİ!';
    ticketPosition.textContent = '🎮';
    ticketStatusIcon.textContent = '🎉';
    ticketStatusTitle.textContent = 'Sıranız Geldi!';
    ticketStatusDesc.textContent = 'Lütfen oyun alanına / masaya geçiniz!';
  } else if (participant.status === 'completed') {
    ticketBadge.textContent = '⚪ Katılım Tamamlandı';
    ticketPosition.textContent = '✓';
    ticketStatusIcon.textContent = '✅';
    ticketStatusTitle.textContent = 'Oyununuz Tamamlandı';
    ticketStatusDesc.textContent = 'Katılımınız için teşekkür ederiz!';
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Auto-clean input
  if (instagramInput) {
    instagramInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/^@+/, '').replace(/\s+/g, '');
      e.target.value = val;
    });
  }

  // Submit Form
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const instagram = instagramInput.value.trim().replace(/^@+/, '');
      const name = nameInput ? nameInput.value.trim() : '';

      if (!instagram || instagram.length < 2) {
        showAlert('Lütfen geçerli bir Instagram kullanıcı adı girin.');
        instagramInput.focus();
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Kayıt yapılıyor... ⏳</span>';

      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instagram, name })
        });

        const data = await res.json();

        if (res.ok) {
          currentParticipant = data.participant;
          // Save to localStorage
          saveTicket(currentParticipant);

          showTicketView(currentParticipant, data.position, data.aheadCount || 0);
          startPolling();

          if (data.alreadyJoined) {
            showAlert(data.message || 'Zaten sıradasınız!');
          }
        } else {
          showAlert(data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Sıraya Katıl 🚀</span>';
        }
      } catch (err) {
        showAlert('Bağlantı hatası: Sunucuya ulaşılamadı.');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Sıraya Katıl 🚀</span>';
      }
    });
  }

  // Leave Queue Button
  if (btnLeaveQueue) {
    btnLeaveQueue.addEventListener('click', async () => {
      if (!currentParticipant) return;

      if (!confirm('Sıradan ayrılmak istediğinize emin misiniz?')) {
        return;
      }

      try {
        const res = await fetch(`/api/participants/${currentParticipant.id}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          clearSavedTicket();
          currentParticipant = null;
          stopPolling();
          showFormView();
          if (joinForm) joinForm.reset();
        } else {
          showAlert('Sıradan çıkılamadı.');
        }
      } catch (err) {
        showAlert('Hata: ' + err.message);
      }
    });
  }
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
