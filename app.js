const STORAGE_KEY = 'passvault_data';
let entries = [];
let currentFilter = 'all';
let editingId = null;
let viewingEntry = null;

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    entries = stored ? JSON.parse(stored) : [];
}

function generatePassword(length = 16, options = {}) {
    const {
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = true
    } = options;

    let chars = '';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, x => chars[x % chars.length]).join('');
}

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak', text: 'Weak', class: 'weak' };
    if (score <= 3) return { level: 'fair', text: 'Fair', class: 'fair' };
    if (score <= 4) return { level: 'good', text: 'Good', class: 'good' };
    return { level: 'strong', text: 'Strong', class: 'strong' };
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return null;
    }
}

function renderEntries() {
    const grid = document.getElementById('password-grid');
    const emptyState = document.getElementById('empty-state');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();

    let filtered = entries;

    if (currentFilter === 'favorites') {
        filtered = filtered.filter(e => e.favorite);
    } else if (currentFilter !== 'all') {
        filtered = filtered.filter(e => e.category === currentFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(e =>
            e.name.toLowerCase().includes(searchTerm) ||
            e.username.toLowerCase().includes(searchTerm) ||
            (e.url && e.url.toLowerCase().includes(searchTerm))
        );
    }

    document.getElementById('total-count').textContent = entries.length;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map((entry, index) => `
        <div class="password-card" data-id="${entry.id}" style="animation-delay: ${index * 0.05}s">
            <div class="card-header">
                <div class="card-icon">
                    ${getFaviconUrl(entry.url)
                        ? `<img src="${getFaviconUrl(entry.url)}" alt="" style="width: 24px; height: 24px;" onerror="this.parentElement.textContent='${entry.name.charAt(0)}'">`
                        : entry.name.charAt(0)}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn favorite-btn ${entry.favorite ? 'favorited' : ''}" data-id="${entry.id}" title="${entry.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <svg viewBox="0 0 24 24" fill="${entry.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="card-name">${escapeHtml(entry.name)}</div>
            <div class="card-username">${escapeHtml(entry.username)}</div>
            <div class="card-footer">
                <span class="card-category">${entry.category}</span>
                <div class="card-password">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    ••••••••
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.password-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) return;
            const id = card.dataset.id;
            viewEntry(id);
        });
    });

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            toggleFavorite(id);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleFavorite(id) {
    const entry = entries.find(e => e.id === id);
    if (entry) {
        entry.favorite = !entry.favorite;
        saveToStorage();
        renderEntries();
    }
}

function viewEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    viewingEntry = entry;
    document.getElementById('view-name').textContent = entry.name;
    document.getElementById('view-url').textContent = entry.url || 'N/A';
    document.getElementById('view-url').href = entry.url || '#';
    document.getElementById('view-username').textContent = entry.username;
    document.getElementById('view-password').textContent = '••••••••••••';
    document.getElementById('view-password').classList.add('masked');

    const notesItem = document.getElementById('view-notes-item');
    if (entry.notes) {
        document.getElementById('view-notes').textContent = entry.notes;
        notesItem.style.display = 'block';
    } else {
        notesItem.style.display = 'none';
    }

    document.getElementById('view-password').dataset.password = entry.password;
    openModal('view-modal');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add Password';
    document.getElementById('entry-name').value = '';
    document.getElementById('entry-url').value = '';
    document.getElementById('entry-username').value = '';
    document.getElementById('entry-password').value = '';
    document.getElementById('entry-category').value = 'other';
    document.getElementById('entry-notes').value = '';
    document.getElementById('password-strength').classList.remove('visible');
    document.getElementById('strength-fill').className = 'strength-fill';
    document.getElementById('strength-text').textContent = '';
    openModal('password-modal');
}

function showEditModal(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    editingId = id;
    document.getElementById('modal-title').textContent = 'Edit Password';
    document.getElementById('entry-name').value = entry.name;
    document.getElementById('entry-url').value = entry.url || '';
    document.getElementById('entry-username').value = entry.username;
    document.getElementById('entry-password').value = entry.password;
    document.getElementById('entry-category').value = entry.category;
    document.getElementById('entry-notes').value = entry.notes || '';

    const strength = getPasswordStrength(entry.password);
    const strengthEl = document.getElementById('password-strength');
    const fillEl = document.getElementById('strength-fill');
    const textEl = document.getElementById('strength-text');
    strengthEl.classList.add('visible');
    fillEl.className = `strength-fill ${strength.class}`;
    textEl.textContent = strength.text;

    closeModal('view-modal');
    openModal('password-modal');
}

async function saveEntry() {
    const name = document.getElementById('entry-name').value.trim();
    const url = document.getElementById('entry-url').value.trim();
    const username = document.getElementById('entry-username').value.trim();
    const password = document.getElementById('entry-password').value;
    const category = document.getElementById('entry-category').value;
    const notes = document.getElementById('entry-notes').value.trim();

    if (!name || !username || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (editingId) {
        const index = entries.findIndex(e => e.id === editingId);
        if (index !== -1) {
            entries[index] = {
                ...entries[index],
                name,
                url,
                username,
                password,
                category,
                notes,
                updatedAt: Date.now()
            };
        }
        showToast('Password updated successfully!');
    } else {
        entries.push({
            id: crypto.randomUUID(),
            name,
            url,
            username,
            password,
            category,
            notes,
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        showToast('Password saved successfully!');
    }

    saveToStorage();
    closeModal('password-modal');
    renderEntries();
}

async function deleteEntry() {
    entries = entries.filter(e => e.id !== viewingEntry.id);
    saveToStorage();
    closeModal('view-modal');
    renderEntries();
    showToast('Password deleted', 'info');
    viewingEntry = null;
}

function initEventListeners() {
    document.getElementById('add-btn').addEventListener('click', showAddModal);

    document.getElementById('save-btn').addEventListener('click', saveEntry);

    document.getElementById('cancel-btn').addEventListener('click', () => {
        closeModal('password-modal');
        editingId = null;
    });

    document.getElementById('delete-btn').addEventListener('click', deleteEntry);

    document.getElementById('edit-btn').addEventListener('click', () => {
        if (viewingEntry) {
            showEditModal(viewingEntry.id);
        }
    });

    document.getElementById('view-close-btn').addEventListener('click', () => {
        closeModal('view-modal');
        viewingEntry = null;
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                editingId = null;
                viewingEntry = null;
            }
        });
    });

    document.getElementById('search-input').addEventListener('input', renderEntries);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            document.getElementById('section-title').textContent = btn.textContent.trim();
            renderEntries();
        });
    });

    document.getElementById('toggle-entry-password').addEventListener('click', () => {
        const input = document.getElementById('entry-password');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('entry-password').addEventListener('input', (e) => {
        const password = e.target.value;
        const strengthEl = document.getElementById('password-strength');
        const fillEl = document.getElementById('strength-fill');
        const textEl = document.getElementById('strength-text');

        if (password) {
            const strength = getPasswordStrength(password);
            strengthEl.classList.add('visible');
            fillEl.className = `strength-fill ${strength.class}`;
            textEl.textContent = strength.text;
        } else {
            strengthEl.classList.remove('visible');
            fillEl.className = 'strength-fill';
            textEl.textContent = '';
        }
    });

    document.getElementById('generate-inline-btn').addEventListener('click', () => {
        const password = generatePassword(20);
        document.getElementById('entry-password').value = password;
        document.getElementById('entry-password').type = 'text';
        const strength = getPasswordStrength(password);
        const strengthEl = document.getElementById('password-strength');
        const fillEl = document.getElementById('strength-fill');
        const textEl = document.getElementById('strength-text');
        strengthEl.classList.add('visible');
        fillEl.className = `strength-fill ${strength.class}`;
        textEl.textContent = strength.text;
    });

    document.getElementById('generate-btn').addEventListener('click', () => {
        updateGeneratedPassword();
        openModal('generator-modal');
    });

    document.getElementById('regenerate-btn').addEventListener('click', updateGeneratedPassword);

    document.getElementById('generator-close-btn').addEventListener('click', () => {
        closeModal('generator-modal');
    });

    document.getElementById('copy-generated-btn').addEventListener('click', () => {
        const password = document.getElementById('generated-password').textContent;
        copyToClipboard(password);
    });

    document.getElementById('password-length').addEventListener('input', (e) => {
        document.getElementById('length-value').textContent = e.target.value;
    });

    ['opt-uppercase', 'opt-lowercase', 'opt-numbers', 'opt-symbols'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateGeneratedPassword);
    });

    document.getElementById('toggle-view-password').addEventListener('click', () => {
        const passwordEl = document.getElementById('view-password');
        const isMasked = passwordEl.classList.contains('masked');
        if (isMasked) {
            passwordEl.textContent = passwordEl.dataset.password;
            passwordEl.classList.remove('masked');
        } else {
            passwordEl.textContent = '••••••••••••';
            passwordEl.classList.add('masked');
        }
    });

    document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.copy;
            if (type === 'username') {
                copyToClipboard(document.getElementById('view-username').textContent);
            } else if (type === 'password') {
                copyToClipboard(document.getElementById('view-password').dataset.password);
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
            editingId = null;
            viewingEntry = null;
        }
    });
}

function updateGeneratedPassword() {
    const length = parseInt(document.getElementById('password-length').value);
    const options = {
        uppercase: document.getElementById('opt-uppercase').checked,
        lowercase: document.getElementById('opt-lowercase').checked,
        numbers: document.getElementById('opt-numbers').checked,
        symbols: document.getElementById('opt-symbols').checked
    };
    const password = generatePassword(length, options);
    document.getElementById('generated-password').textContent = password;
}

function init() {
    initEventListeners();
    loadFromStorage();
    renderEntries();
}

document.addEventListener('DOMContentLoaded', init);
