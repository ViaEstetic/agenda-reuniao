# Agenda de Espaços (Sala de Reunião e Instituto)

Site simples (HTML + CSS + JavaScript, sem build) para reservar a **Sala de Reunião**
e o **Instituto (auditório)**. Abas no topo escolhem qual agenda ver; cada pessoa informa **nome, assunto, data e horário**, e todos veem a ocupação da
semana. O sistema bloqueia reservas em horários que se sobrepõem.

## Arquivos

| Arquivo      | O que faz                                                 |
|--------------|-----------------------------------------------------------|
| `index.html` | Página                                                    |
| `style.css`  | Visual (com modo escuro automático)                       |
| `app.js`     | Grade semanal, formulário, validação e conflitos          |
| `storage.js` | Onde as reservas ficam salvas (Firebase ou navegador)     |
| `config.js`  | Horário de funcionamento e configuração do Firebase       |

## Por que precisa do Firebase?

O GitHub Pages só hospeda arquivos estáticos — ele não guarda dados. Sem um banco
de dados, cada pessoa veria apenas as próprias reservas. Por isso a agenda usa o
**Firebase Firestore** (gratuito para esse volume de uso) para compartilhar as reservas.

Enquanto o Firebase não estiver configurado, o site funciona em **modo demonstração**,
salvando só no navegador de quem usa.

## 1. Configurar o Firebase (uma vez, ~10 minutos)

1. Acesse <https://console.firebase.google.com> e clique em **Criar projeto**
   (pode desativar o Google Analytics).
2. No menu **Criação > Firestore Database**, clique em **Criar banco de dados**,
   escolha a região `southamerica-east1 (São Paulo)` e o **modo de produção**.
3. Na aba **Regras** do Firestore, cole as regras abaixo e clique em **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function valida(d) {
         return d.keys().hasOnly(['espaco','nome','assunto','data','inicio','fim','cor','criadoEm','editadoEm'])
           && d.nome is string && d.nome.size() > 0 && d.nome.size() <= 60
           && d.assunto is string && d.assunto.size() <= 100
           && d.data.matches('^\\d{4}-\\d{2}-\\d{2}$')
           && d.inicio.matches('^\\d{2}:\\d{2}$')
           && d.fim.matches('^\\d{2}:\\d{2}$')
           && (!('cor' in d) || (d.cor is int && d.cor >= 0 && d.cor < 360))
           && (!('espaco' in d) || d.espaco in ['sala', 'instituto']);
       }
       match /reservas/{id} {
         allow read, delete: if true;
         allow create, update: if valida(request.resource.data);
       }
     }
   }
   ```

4. Em **Configurações do projeto** (engrenagem) > **Seus apps**, clique no ícone
   **`</>`** (Web), dê um nome e registre. O Firebase mostrará um objeto
   `firebaseConfig`.
5. Copie esse objeto para o arquivo `config.js`, substituindo `null`:

   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

   > Essas chaves do Firebase Web **não são secretas** — elas ficam públicas em
   > qualquer site que usa Firebase. Quem protege os dados são as regras do passo 3.

## 2. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `agenda-reuniao`).
2. Envie os arquivos desta pasta para o repositório (pelo botão
   **Add file > Upload files** no site do GitHub, ou via `git push`).
3. No repositório, vá em **Settings > Pages**, em **Source** escolha
   **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/agenda-reuniao/`.

## Testar no computador

Abrir o `index.html` com dois cliques **não funciona** (o navegador bloqueia
módulos JavaScript em `file://`). Use um servidor local, por exemplo:

```bash
npx serve .
```

## Personalizar

Em `config.js`:

- `horaInicio` / `horaFim` — faixa de horário exibida e permitida para reservas.
- `mostrarFimDeSemana` — `true` para exibir sábado e domingo.
- `ESPACOS` — lista de espaços reserváveis. Para incluir um novo, adicione-o aqui
  **e** na regra do Firestore (`d.espaco in [...]`).

## QR Code, cartazes e links diretos

- `qrcode.svg` / `qrcode.png`: **um único QR Code** para os dois espaços. Ele abre a
  agenda, e a pessoa escolhe a Sala ou o Instituto nas abas.
- `cartaz.html?espaco=sala` e `cartaz.html?espaco=instituto`: cartaz A4 com o título de
  cada espaço (para colar na porta), ambos com o mesmo QR Code.
- `.../agenda-reuniao/?espaco=instituto` abre direto na agenda do Instituto (útil para
  mandar por mensagem).

## Observações

- Qualquer pessoa com o link pode criar, editar e cancelar reservas (não há login). Para
  uso interno de uma equipe isso costuma ser suficiente; o cancelamento sempre pede
  confirmação.
- As reservas aparecem em tempo real para todos quando o Firebase está configurado.
