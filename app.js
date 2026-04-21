// --- Estado y Configuración ---
let tasks = JSON.parse(localStorage.getItem('priority_tasks')) || [];
let notificationsEnabled = false;
let alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

const colors = {
    1: '#FF3333', // Urgente e Importante
    2: '#00FFCC', // Importante
    3: '#FFCC00', // Urgente
    4: '#B026FF'  // Backburner
};

// --- Referencias DOM ---
const lists = {
    1: document.getElementById('list-q1'),
    2: document.getElementById('list-q2'),
    3: document.getElementById('list-q3'),
    4: document.getElementById('list-q4')
};

const alertsContainer = document.getElementById('alerts-container');
const btnEnableNotif = document.getElementById('btn-enable-notif');
const notifIcon = document.getElementById('notif-icon');
const taskModal = document.getElementById('task-modal');
const btnAddTask = document.getElementById('btn-add-task');
const btnCancelTask = document.getElementById('btn-cancel-task');
const taskForm = document.getElementById('task-form');

// Nav & Views
const slideMenu = document.getElementById('slide-menu');
const menuOverlay = document.getElementById('menu-overlay');
const btnMenu = document.getElementById('btn-menu');
const btnCloseMenu = document.getElementById('btn-close-menu');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

// Notes
const notebook = document.getElementById('notebook');
const notesStatus = document.getElementById('notes-status');

// Calendar
let calendar = null;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    initSortable();
    renderTasks();
    checkNotificationPermissions();
    startAlertEngine();
    initNotes();
});

// --- Navegación (Slide Menu & Tabs) ---
btnMenu.addEventListener('click', () => {
    slideMenu.classList.add('open');
    menuOverlay.classList.add('active');
});

function closeSlideMenu() {
    slideMenu.classList.remove('open');
    menuOverlay.classList.remove('active');
}

btnCloseMenu.addEventListener('click', closeSlideMenu);
menuOverlay.addEventListener('click', closeSlideMenu);

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Actualizar UI del menú
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Cambiar vista
        const target = item.dataset.target;
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === target) view.classList.add('active');
        });

        // Acciones específicas de la vista
        if (target === 'view-calendar') {
            initCalendar();
        }

        // En pantallas pequeñas, cerrar el menú al hacer clic en un link
        if (window.innerWidth <= 768) {
            closeSlideMenu();
        }
    });
});

// --- Cuaderno de Notas ---
function initNotes() {
    const savedNotes = localStorage.getItem('focus_notes') || '';
    notebook.value = savedNotes;

    let saveTimeout;
    notebook.addEventListener('input', () => {
        notesStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        notesStatus.style.color = 'var(--text-muted)';
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('focus_notes', notebook.value);
            notesStatus.innerHTML = '<i class="fa-solid fa-check-double"></i> Guardado';
            notesStatus.style.color = 'var(--q2-color)';
            
            setTimeout(() => {
                notesStatus.innerHTML = '<i class="fa-solid fa-check"></i> Guardado automático';
                notesStatus.style.color = 'var(--text-muted)';
            }, 2000);
        }, 800);
    });
}

// --- Calendario ---
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    // Si ya existe, solo actualizar eventos
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(getCalendarEvents());
        calendar.render();
        return;
    }

    // Crear por primera vez
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: getCalendarEvents(),
        eventClick: function(info) {
            alert('Proyecto: ' + info.event.title);
        },
        height: '100%',
        locale: 'es'
    });
    calendar.render();
}

function getCalendarEvents() {
    return tasks.filter(t => t.deadline).map(t => ({
        id: t.id,
        title: t.title,
        start: t.deadline,
        backgroundColor: colors[t.quadrant],
        borderColor: colors[t.quadrant]
    }));
}

// --- SortableJS ---
function initSortable() {
    Object.values(lists).forEach(list => {
        new Sortable(list, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const taskId = evt.item.dataset.id;
                const newQuadrant = evt.to.dataset.quadrant;
                
                const taskIndex = tasks.findIndex(t => t.id === taskId);
                if (taskIndex > -1) {
                    tasks[taskIndex].quadrant = parseInt(newQuadrant);
                    saveTasks();
                    renderAlerts();
                    // Si el calendario está inicializado, recargarlo invisiblemente
                    if (calendar) {
                        calendar.removeAllEvents();
                        calendar.addEventSource(getCalendarEvents());
                    }
                }
            },
        });
    });
}

// --- Renderizado de Tareas ---
function renderTasks() {
    Object.values(lists).forEach(list => list.innerHTML = '');

    tasks.forEach(task => {
        const el = createTaskElement(task);
        if (lists[task.quadrant]) {
            lists[task.quadrant].appendChild(el);
        }
    });
    
    renderAlerts();
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-card';
    div.dataset.id = task.id;

    let metaHtml = '';
    if (task.deadline) {
        const dateObj = new Date(task.deadline);
        const dateStr = dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isUrgent = (dateObj.getTime() - Date.now()) < 86400000 && (dateObj.getTime() - Date.now()) > 0;
        
        metaHtml = `
            <div class="task-meta ${isUrgent ? 'urgent' : ''}">
                <i class="fa-regular fa-clock"></i> ${dateStr}
            </div>
        `;
    }

    div.innerHTML = `
        <div class="task-card-header">
            <div class="task-title">${escapeHTML(task.title)}</div>
            <button class="btn-delete-task" onclick="deleteTask('${task.id}')" title="Eliminar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        ${metaHtml}
    `;
    return div;
}

// --- CRUD Tareas ---
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value;
    const deadline = document.getElementById('task-deadline').value;

    const newTask = {
        id: 't_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
        title: title,
        deadline: deadline || null,
        quadrant: 2
    };

    tasks.push(newTask);
    saveTasks();
    renderTasks();
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(getCalendarEvents());
    }
    closeModal();
});

window.deleteTask = function(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(getCalendarEvents());
    }
};

function saveTasks() {
    localStorage.setItem('priority_tasks', JSON.stringify(tasks));
}

// --- Modal ---
btnAddTask.addEventListener('click', () => {
    taskForm.reset();
    taskModal.classList.add('active');
    document.getElementById('task-title').focus();
    // Si se agrega desde el menú lateral móvil, cerrarlo
    closeSlideMenu();
});
btnCancelTask.addEventListener('click', closeModal);
function closeModal() { taskModal.classList.remove('active'); }
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeModal(); });

// --- Alertas ---
function renderAlerts() {
    const q1Tasks = tasks.filter(t => t.quadrant === 1 && t.deadline);
    const upcoming = q1Tasks.filter(t => {
        const diff = new Date(t.deadline).getTime() - Date.now();
        return diff > -3600000;
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (upcoming.length === 0) {
        alertsContainer.innerHTML = '<div class="empty-alerts">Todo tranquilo por ahora</div>';
        return;
    }

    alertsContainer.innerHTML = upcoming.map(task => {
        const diffMs = new Date(task.deadline).getTime() - Date.now();
        const diffMins = Math.floor(diffMs / 60000);
        
        let timeStr = '';
        if (diffMins < 0) timeStr = '¡Expiró!';
        else if (diffMins < 60) timeStr = `En ${diffMins} min`;
        else timeStr = `En ${Math.floor(diffMins/60)}h ${diffMins%60}m`;

        return `
            <div class="alert-card">
                <h4>${escapeHTML(task.title)}</h4>
                <p><i class="fa-solid fa-hourglass-half"></i> ${timeStr}</p>
            </div>
        `;
    }).join('');
}

function startAlertEngine() {
    setInterval(renderAlerts, 60000);
    setInterval(() => {
        if (!notificationsEnabled) return;
        const now = Date.now();
        tasks.forEach(task => {
            if (task.quadrant === 1 && task.deadline && !task.notified) {
                const diffMs = new Date(task.deadline).getTime() - now;
                if (diffMs > 0 && diffMs <= 15 * 60000) {
                    triggerNotification(task);
                    task.notified = true;
                    saveTasks();
                }
            }
        });
    }, 10000);
}

function checkNotificationPermissions() {
    if (!("Notification" in window)) {
        btnEnableNotif.style.display = 'none';
        return;
    }
    if (Notification.permission === "granted") enableNotificationsUI(false);
}

btnEnableNotif.addEventListener('click', () => {
    if (!("Notification" in window)) { alert("Tu navegador no soporta notificaciones."); return; }
    if (Notification.permission === "granted") {
        notificationsEnabled = !notificationsEnabled;
        updateNotifUI();
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") enableNotificationsUI(true);
        });
    }
});

function enableNotificationsUI(test = true) {
    notificationsEnabled = true;
    updateNotifUI();
    if (test) {
        new Notification("¡Alertas Activadas!", { body: "Te avisaremos de los proyectos Urgentes e Importantes.", icon: "assets/logo.png" });
    }
}

function updateNotifUI() {
    if (notificationsEnabled) {
        notifIcon.className = "fa-solid fa-bell";
        btnEnableNotif.classList.add('active');
        btnEnableNotif.title = "Notificaciones Activas";
    } else {
        notifIcon.className = "fa-solid fa-bell-slash";
        btnEnableNotif.classList.remove('active');
        btnEnableNotif.title = "Activar Notificaciones";
    }
}

function triggerNotification(task) {
    try { alertSound.play().catch(e => {}); } catch(e) {}
    const notification = new Notification("🔥 Proyecto Prioritario", {
        body: `El proyecto "${task.title}" está próximo a vencer. ¡Enfócate!`,
        icon: "assets/logo.png",
        requireInteraction: true
    });
    notification.onclick = function() { window.focus(); this.close(); };
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));
}
