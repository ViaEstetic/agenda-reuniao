import { AGENDA } from './config.js';
import { criarStore } from './storage.js';

const SLOT_MIN = 30;   // cada linha da grade = 30 minutos
const SLOT_PX = 28;    // altura de cada linha em pixels
const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CHAVE_NOME = 'agenda-sala-meu-nome';

const $ = sel => document.querySelector(sel);
const pad = n => String(n).padStart(2, '0');
const fmtData = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataBR = s => s.split('-').reverse().join('/');
const paraMin = h => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
const deMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const minAgora = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

function segundaDaSemana(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function somarDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}
// Cor estável por pessoa, para facilitar a leitura da grade.
function matiz(nome) {
  let h = 0;
  for (const c of nome.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function lerNomeSalvo() {
  try { return localStorage.getItem(CHAVE_NOME) || ''; } catch { return ''; }
}
function salvarNome(nome) {
  try { localStorage.setItem(CHAVE_NOME, nome); } catch { /* ignora */ }
}

let reservas = [];
let inicioSemana = segundaDaSemana(new Date());
let reservaAberta = null;
let store;

/* ---------- Grade semanal ---------- */

function renderGrade() {
  const nDias = AGENDA.mostrarFimDeSemana ? 7 : 5;
  const dias = Array.from({ length: nDias }, (_, i) => somarDias(inicioSemana, i));
  const hoje = fmtData(new Date());
  const minInicio = AGENDA.horaInicio * 60;
  const minFim = AGENDA.horaFim * 60;
  const altura = (minFim - minInicio) / SLOT_MIN * SLOT_PX;
  const topo = min => (min - minInicio) / SLOT_MIN * SLOT_PX;

  const opc = { day: '2-digit', month: 'short' };
  $('#tituloSemana').textContent =
    `${dias[0].toLocaleDateString('pt-BR', opc)} – ${dias.at(-1).toLocaleDateString('pt-BR', { ...opc, year: 'numeric' })}`;

  const grade = $('#grade');
  grade.style.setProperty('--dias', nDias);
  grade.style.setProperty('--slot', `${SLOT_PX}px`);
  grade.replaceChildren();

  grade.append(el('div', 'canto'));
  for (const d of dias) {
    const cab = el('div', 'cab-dia' + (fmtData(d) === hoje ? ' hoje' : ''));
    cab.append(el('span', null, NOMES_DIAS[d.getDay()]), el('strong', null, d.getDate()));
    grade.append(cab);
  }

  const horas = el('div', 'horas');
  horas.style.height = `${altura}px`;
  for (let h = AGENDA.horaInicio; h < AGENDA.horaFim; h++) {
    const r = el('div', 'hora', `${pad(h)}:00`);
    r.style.top = `${topo(h * 60)}px`;
    horas.append(r);
  }
  grade.append(horas);

  for (const d of dias) {
    const ds = fmtData(d);
    const col = el('div', 'dia' + (ds === hoje ? ' hoje' : '') + (ds < hoje ? ' passado' : ''));
    col.style.height = `${altura}px`;
    col.addEventListener('click', e => {
      if (e.target !== col || ds < hoje) return;
      const min = minInicio + Math.floor(e.offsetY / SLOT_PX) * SLOT_MIN;
      abrirNova(ds, min);
    });

    for (const r of reservas.filter(r => r.data === ds)) {
      const ini = Math.max(paraMin(r.inicio), minInicio);
      const fim = Math.min(paraMin(r.fim), minFim);
      if (fim <= ini) continue;
      const b = el('button', 'reserva');
      b.type = 'button';
      b.style.top = `${topo(ini)}px`;
      b.style.height = `${(fim - ini) / SLOT_MIN * SLOT_PX - 2}px`;
      b.style.setProperty('--h', matiz(r.nome));
      b.append(
        el('strong', null, r.assunto || 'Reunião'),
        el('span', null, `${r.inicio}–${r.fim} · ${r.nome}`),
      );
      b.title = `${r.assunto || 'Reunião'}\n${r.inicio}–${r.fim}\n${r.nome}`;
      b.addEventListener('click', () => abrirDetalhe(r));
      col.append(b);
    }

    if (ds === hoje && minAgora() >= minInicio && minAgora() < minFim) {
      const linha = el('div', 'agora');
      linha.style.top = `${topo(minAgora())}px`;
      col.append(linha);
    }
    grade.append(col);
  }
}

/* ---------- Lista de próximas reservas ---------- */

function renderProximas() {
  const hoje = fmtData(new Date());
  const agora = deMin(minAgora());
  const proximas = reservas
    .filter(r => r.data > hoje || (r.data === hoje && r.fim > agora))
    .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))
    .slice(0, 15);

  const ul = $('#listaProximas');
  ul.replaceChildren();
  if (!proximas.length) {
    ul.append(el('li', 'vazio', 'Nenhuma reserva futura.'));
    return;
  }
  for (const r of proximas) {
    const li = el('li');
    const b = el('button', 'item');
    b.type = 'button';
    b.style.setProperty('--h', matiz(r.nome));
    const [y, m, d] = r.data.split('-').map(Number);
    const dia = new Date(y, m - 1, d);
    b.append(
      el('span', 'quando', `${NOMES_DIAS[dia.getDay()]} ${dataBR(r.data)} · ${r.inicio}–${r.fim}`),
      el('span', 'oque', r.assunto || 'Reunião'),
      el('span', 'quem', r.nome),
    );
    b.addEventListener('click', () => abrirDetalhe(r));
    li.append(b);
    ul.append(li);
  }
}

function render() {
  renderGrade();
  renderProximas();
}

/* ---------- Formulário de nova reserva ---------- */

const dlgReserva = $('#dlgReserva');
const form = $('#formReserva');
const erroForm = $('#erroForm');

function abrirNova(data = fmtData(new Date()), minIni = null) {
  if (minIni == null) {
    const m = Math.ceil(minAgora() / SLOT_MIN) * SLOT_MIN;
    minIni = Math.min(Math.max(m, AGENDA.horaInicio * 60), AGENDA.horaFim * 60 - 60);
  }
  form.reset();
  erroForm.hidden = true;
  form.nome.value = lerNomeSalvo();
  form.data.value = data;
  form.data.min = fmtData(new Date());
  form.inicio.value = deMin(minIni);
  form.fim.value = deMin(Math.min(minIni + 60, AGENDA.horaFim * 60));
  dlgReserva.showModal();
  (form.nome.value ? form.assunto : form.nome).focus();
}

function validar(r) {
  const ini = paraMin(r.inicio);
  const fim = paraMin(r.fim);
  const hoje = fmtData(new Date());
  if (!r.nome) return 'Informe seu nome.';
  if (fim <= ini) return 'O horário de fim deve ser depois do início.';
  if (ini < AGENDA.horaInicio * 60 || fim > AGENDA.horaFim * 60)
    return `A sala pode ser reservada entre ${pad(AGENDA.horaInicio)}:00 e ${pad(AGENDA.horaFim)}:00.`;
  if (r.data < hoje || (r.data === hoje && fim <= minAgora())) return 'Esse horário já passou.';
  const conflito = reservas.find(o =>
    o.data === r.data && ini < paraMin(o.fim) && fim > paraMin(o.inicio));
  if (conflito)
    return `Conflito: a sala já está reservada das ${conflito.inicio} às ${conflito.fim} por ${conflito.nome}.`;
  return null;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const reserva = {
    nome: form.nome.value.trim(),
    assunto: form.assunto.value.trim(),
    data: form.data.value,
    inicio: form.inicio.value,
    fim: form.fim.value,
    criadoEm: new Date().toISOString(),
  };
  const erro = validar(reserva);
  if (erro) {
    erroForm.textContent = erro;
    erroForm.hidden = false;
    return;
  }
  const botao = form.querySelector('[type=submit]');
  botao.disabled = true;
  try {
    await store.adicionar(reserva);
    salvarNome(reserva.nome);
    dlgReserva.close();
    // Leva a grade para a semana da reserva recém-criada.
    const [y, m, d] = reserva.data.split('-').map(Number);
    inicioSemana = segundaDaSemana(new Date(y, m - 1, d));
    render();
  } catch (err) {
    console.error(err);
    erroForm.textContent = 'Não foi possível salvar. Tente novamente.';
    erroForm.hidden = false;
  } finally {
    botao.disabled = false;
  }
});

/* ---------- Detalhe / cancelamento ---------- */

const dlgDetalhe = $('#dlgDetalhe');

function abrirDetalhe(r) {
  reservaAberta = r;
  $('#detAssunto').textContent = r.assunto || 'Reunião';
  $('#detNome').textContent = r.nome;
  $('#detQuando').textContent = `${dataBR(r.data)}, das ${r.inicio} às ${r.fim}`;
  dlgDetalhe.showModal();
}

$('#btnExcluir').addEventListener('click', async () => {
  const r = reservaAberta;
  if (!r) return;
  if (!confirm(`Cancelar a reserva de ${r.nome} em ${dataBR(r.data)} (${r.inicio}–${r.fim})?`)) return;
  try {
    await store.remover(r.id);
    dlgDetalhe.close();
  } catch (err) {
    console.error(err);
    alert('Não foi possível cancelar. Tente novamente.');
  }
});

/* ---------- Navegação e inicialização ---------- */

document.querySelectorAll('[data-fechar]').forEach(b =>
  b.addEventListener('click', () => b.closest('dialog').close()));
// Fecha o diálogo ao clicar fora dele.
document.querySelectorAll('dialog').forEach(d =>
  d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('#btnNova').addEventListener('click', () => abrirNova());
$('#btnHoje').addEventListener('click', () => { inicioSemana = segundaDaSemana(new Date()); render(); });
$('#btnAnterior').addEventListener('click', () => { inicioSemana = somarDias(inicioSemana, -7); render(); });
$('#btnProxima').addEventListener('click', () => { inicioSemana = somarDias(inicioSemana, 7); render(); });

// Atualiza a linha do "agora" e a lista de próximas a cada minuto.
setInterval(render, 60_000);

render();
store = await criarStore(lista => { reservas = lista; render(); });
$('#avisoLocal').hidden = store.modo !== 'local';
