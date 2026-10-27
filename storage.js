import { firebaseConfig } from './config.js?v=20261028';

const FIREBASE_VERSAO = '10.12.2';
const COLECAO = 'reservas';
const CHAVE_LOCAL = 'agenda-sala-reservas';

// Cria o armazenamento de reservas. `aoMudar(lista)` é chamado sempre que a
// lista de reservas muda (inclusive quando outra pessoa reserva, no Firebase).
export async function criarStore(aoMudar) {
  return firebaseConfig ? storeFirebase(aoMudar) : storeLocal(aoMudar);
}

async function storeFirebase(aoMudar) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const fs = await import(`${base}/firebase-firestore.js`);

  const db = fs.getFirestore(initializeApp(firebaseConfig));
  const col = fs.collection(db, COLECAO);

  fs.onSnapshot(
    col,
    snap => aoMudar(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    erro => {
      console.error(erro);
      alert('Não foi possível carregar as reservas. Verifique a configuração do Firebase.');
    },
  );

  return {
    modo: 'firebase',
    adicionar: reserva => fs.addDoc(col, reserva),
    atualizar: (id, dados) => fs.updateDoc(fs.doc(db, COLECAO, id), dados),
    remover: id => fs.deleteDoc(fs.doc(db, COLECAO, id)),
  };
}

function storeLocal(aoMudar) {
  const ler = () => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || [];
    } catch {
      return [];
    }
  };
  const gravar = lista => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista));
    aoMudar(lista);
  };

  // Mantém abas abertas do mesmo navegador sincronizadas.
  window.addEventListener('storage', e => {
    if (e.key === CHAVE_LOCAL) aoMudar(ler());
  });
  queueMicrotask(() => aoMudar(ler()));

  return {
    modo: 'local',
    adicionar: async reserva => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      gravar([...ler(), { id, ...reserva }]);
    },
    atualizar: async (id, dados) => gravar(ler().map(r => (r.id === id ? { ...r, ...dados } : r))),
    remover: async id => gravar(ler().filter(r => r.id !== id)),
  };
}
