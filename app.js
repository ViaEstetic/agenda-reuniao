import { AGENDA } from './config.js';
import { criarStore } from './storage.js';

const SLOT_MIN = 30;   // cada linha da grade = 30 minutos
const SLOT_PX = 28;    // altura de cada linha em pixels
const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CHAVE_NOME = 'agenda-sala-meu-nome';
const CHAVE_COR = 'agenda-sala-minha-cor';
// Cores disponíveis para o card (matiz HSL).
const CORES = [
  { h: 325, nome: 'Magenta' },
  { h: 280, nome: 'Roxo' },
  { h: 235, nome: 'Índigo' },
  { h: 205, nome: 'Azul' },
  { h: 175, nome: 'Turquesa' },
  { h: 140, nome: 'Verde' },
  { h: 40, nome: 'Âmbar' },
  { h: 12, nome: 'Coral' },
];
const NOMES_DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

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
// Cor do card: a escolhida pela pessoa ou, em reservas antigas, uma estável por nome.
function corDe(r) {
  if (Number.isInteger(r.cor)) return r.cor;
  let h = 0;
  for (const c of r.nome.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return CORES[h % CORES.length].h;
}
function lerCorSalva() {
  try { return Number(localStorage.getItem(CHAVE_COR)) || CORES[3].h; } catch { return CORES[3].h; }
}
function salvarCor(h) {
  try { localStorage.setItem(CHAVE_COR, h); } catch { /* ignora */ }
}
function diaDaSemana(data) {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
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
let editandoId = null;   // id da reserva sendo editada (null = nova reserva)
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
      b.style.setProperty('--h', corDe(r));
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
    b.style.setProperty('--h', corDe(r));
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
const paleta = $('#paleta');

for (const c of CORES) {
  const rotulo = el('label', 'cor');
  rotulo.title = c.nome;
  rotulo.style.setProperty('--h', c.h);
  const input = el('input');
  Object.assign(input, { type: 'radio', name: 'cor', value: c.h });
  input.setAttribute('aria-label', c.nome);
  rotulo.append(input);
  paleta.append(rotulo);
}

// Prévia do card enquanto a pessoa preenche o formulário.
function atualizarPrevia() {
  const previa = $('#previa');
  previa.style.setProperty('--h', form.cor.value);
  previa.querySelector('strong').textContent = form.assunto.value.trim() || 'Reunião';
  previa.querySelector('span').textContent =
    `${form.inicio.value || '--:--'}–${form.fim.value || '--:--'} · ${form.nome.value.trim() || 'Seu nome'}`;
}
form.addEventListener('input', atualizarPrevia);

function abrirNova(data = fmtData(new Date()), minIni = null) {
  if (minIni == null) {
    const m = Math.ceil(minAgora() / SLOT_MIN) * SLOT_MIN;
    minIni = Math.min(Math.max(m, AGENDA.horaInicio * 60), AGENDA.horaFim * 60 - 60);
  }
  prepararForm(null, 'Nova reserva', 'Salvar reserva');
  form.nome.value = lerNomeSalvo();
  form.data.value = data;
  form.inicio.value = deMin(minIni);
  form.fim.value = deMin(Math.min(minIni + 60, AGENDA.horaFim * 60));
  form.cor.value = lerCorSalva();
  atualizarPrevia();
  dlgReserva.showModal();
  (form.nome.value ? form.assunto : form.nome).focus();
}

function abrirEdicao(r) {
  prepararForm(r.id, 'Editar reserva', 'Salvar alterações');
  form.nome.value = r.nome;
  form.assunto.value = r.assunto || '';
  form.data.value = r.data;
  form.inicio.value = r.inicio;
  form.fim.value = r.fim;
  form.cor.value = corDe(r);
  atualizarPrevia();
  dlgReserva.showModal();
  form.assunto.focus();
}

function prepararForm(id, titulo, textoBotao) {
  editandoId = id;
  form.reset();
  erroForm.hidden = true;
  form.data.min = fmtData(new Date());
  form.querySelector('h2').textContent = titulo;
  form.querySelector('[type=submit]').textContent = textoBotao;
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
    o.id !== editandoId && o.data === r.data && ini < paraMin(o.fim) && fim > paraMin(o.inicio));
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
    cor: Number(form.cor.value),
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
    if (editandoId) {
      await store.atualizar(editandoId, { ...reserva, editadoEm: new Date().toISOString() });
    } else {
      await store.adicionar({ ...reserva, criadoEm: new Date().toISOString() });
      salvarNome(reserva.nome);
    }
    salvarCor(reserva.cor);
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
  const duracao = paraMin(r.fim) - paraMin(r.inicio);
  const textoDuracao = duracao >= 60
    ? `${Math.floor(duracao / 60)}h${duracao % 60 ? pad(duracao % 60) : ''}`
    : `${duracao} min`;
  $('#detCabeca').style.setProperty('--h', corDe(r));
  $('#detAssunto').textContent = r.assunto || 'Reunião';
  $('#detNome').textContent = r.nome;
  $('#detData').textContent = `${NOMES_DIAS_LONGOS[diaDaSemana(r.data)]}, ${dataBR(r.data)}`;
  $('#detHorario').textContent = `${r.inicio} às ${r.fim} (${textoDuracao})`;
  dlgDetalhe.showModal();
}

$('#btnEditar').addEventListener('click', () => {
  dlgDetalhe.close();
  abrirEdicao(reservaAberta);
});

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
