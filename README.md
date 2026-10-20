# Agenda da Sala de Reunião

Site simples (HTML + CSS + JavaScript, sem build) para reservar a sala de reunião:
cada pessoa informa **nome, assunto, data e horário**, e todos veem a ocupação da
semana. O sistema bloqueia reservas em horários que se sobrepõem.

## Arquivos

| Arquivo      | O que faz                                                 |
|--------------|-----------------------------------------------------------|
| `index.html` | Página                                                    |
| `style.css`  | Visual (com modo escuro automático)                       |
| `app.js`     | Grade semanal, formulário, validação e conflitos          |
| `storage.js` | Onde as reservas ficam salvas (Firebase ou navegador)     |
| `config.js`  | Horário de funcionamento e configuração do Firebase       |

## Observações

- Qualquer pessoa com o link pode criar e cancelar reservas (não há login). Para
  uso interno de uma equipe isso costuma ser suficiente; o cancelamento sempre pede
  confirmação.
- As reservas aparecem em tempo real para todos quando o Firebase está configurado.
