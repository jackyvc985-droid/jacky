const KEY = 'tareas-v1';
let tasks = JSON.parse(localStorage.getItem(KEY) || '[]');
let filter = 'all';
const $ = id => document.getElementById(id);

const save = () => localStorage.setItem(KEY, JSON.stringify(tasks));

function render() {
  const list = $('list');
  list.innerHTML = '';
  const shown = tasks.filter(t => filter === 'all' || (filter === 'done') === t.done);
  for (const t of shown) {
    const li = document.createElement('li');
    if (t.done) li.className = 'done';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = t.done;
    cb.onchange = () => { t.done = cb.checked; save(); render(); };
    const sp = document.createElement('span');
    sp.textContent = t.text;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.onclick = () => { tasks = tasks.filter(x => x !== t); save(); render(); };
    li.append(cb, sp, del);
    list.append(li);
  }
  const open = tasks.filter(t => !t.done).length;
  $('count').textContent = `${open} pendiente(s) de ${tasks.length}`;
}

$('form').onsubmit = e => {
  e.preventDefault();
  const text = $('input').value.trim();
  if (!text) return;
  tasks.push({ text, done: false });
  $('input').value = '';
  save(); render();
};

document.querySelectorAll('#filters button').forEach(b => b.onclick = () => {
  filter = b.dataset.f;
  document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('on', x === b));
  render();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
