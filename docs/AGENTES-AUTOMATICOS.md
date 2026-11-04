# Agentes que trabalham sozinhos

Por padrão, nenhum agente manda mensagem sem você. Este guia explica o que você pode ligar, os freios que já vêm no código e como testar.

Tudo aqui é opcional. Com tudo desligado, o CRM se comporta como antes.

## O que existe

| Recurso | O que faz | Liga com | Padrão |
| --- | --- | --- | --- |
| Auto-atendimento | Quando o contato responde no WhatsApp, o Scout classifica a conversa e o Cláudio responde, ou passa para você | `CRM_CLAUDIO_AUTO_REPLY=1` | Desligado |
| Pilot | Acha contatos parados de 1 a 14 dias e prepara um follow-up | `CRM_PILOT_AUTO=1` para enviar | Só sugere |
| Registro | Guarda cada decisão (responder, passar ao humano, calar, sugerir, enviar) | Sempre que um recurso roda | Ligado |

## O que precisa para o auto-atendimento funcionar

Os três juntos. Faltando um, o código não faz nada e não registra nada.

1. `CRM_CLAUDIO_AUTO_REPLY=1`
2. Chave de IA (Anthropic) configurada. Sem IA o Cláudio não responde, para não mandar texto pronto genérico.
3. Sessão do WhatsApp conectada (WPP Engine com chave e sessão, ou WAHA).

Quando o Relance (Ember) já tratou a mensagem, o auto-atendimento não roda para ela.

## Os freios (não dá para desligar pela configuração)

- **Pediu para parar** ou disse que não tem interesse: o robô cala. Opt-out registrado vale para sempre ou até expirar.
- **Falou de preço, desconto, parcela ou condição**: passa para o humano. O Cláudio nunca fala preço, e o texto final dele é conferido de novo antes de enviar.
- **Pediu para falar com uma pessoa**, ou respondeu nota 9 ou 10 na Pergunta Matadora: passa para o humano.
- **Um humano já respondeu**, ou o contato está esperando o humano: o robô não atravessa. Isso vale até um humano responder depois.
- **Horário**: só responde em dia útil, das 8h às 20h (horário de São Paulo). De madrugada e no fim de semana, o robô cala.
- **Anti-loop**: depois de 3 respostas automáticas seguidas sem nenhum humano no meio, passa para o humano.
- **Cooldown do Pilot**: no máximo uma mensagem automática a cada 48 horas por contato, e nada depois de 14 dias parado.
- **Limite por rodada**: o Pilot aciona no máximo 5 contatos por vez (você pode baixar com `limite`).
- Se o envio falhar, nada é reenviado.

Passar para o humano significa marcar o contato como "esperando humano" e deixar o robô calado. Com Supabase, a marca vai para o contato no banco (o que alimenta Hoje e Conversas). Sem Supabase (demo), a marca fica só num arquivo local e vale para o robô, mas não aparece nas telas.

## Pilot: como funciona

1. Uma rotina chama `/api/agents/pilot/tick` (por exemplo, uma vez por hora).
2. O Pilot olha os contatos, descarta quem está em cooldown, pediu para parar, está com humano ou parou há menos de 1 dia ou mais de 14.
3. Para os que sobram, gera um follow-up sem preço.
4. **Padrão**: salva como sugestão em `data/pilot-sugestoes.json` e não envia nada. Você vê em `/api/agents/pilot/sugestoes`.
5. Com `CRM_PILOT_AUTO=1`, chave de IA, sessão WhatsApp e horário comercial, ele envia em vez de sugerir. Fora disso, volta a só sugerir.

As sugestões ficam só em arquivo local. Não existe tabela no Supabase para elas ainda. Em hospedagem sem disco persistente (como a Vercel), o arquivo some entre execuções: lá, use o Pilot só em modo teste ou rode o CRM em uma máquina sua.

## Variáveis

| Variável | Para que serve |
| --- | --- |
| `CRM_CLAUDIO_AUTO_REPLY` | `1` liga o auto-atendimento do Cláudio |
| `CRM_PILOT_AUTO` | `1` deixa o Pilot enviar sozinho (sem isso, só sugere) |
| `CRON_SECRET` | Senha das rotas automáticas. Em produção, sem ela as rotas respondem 401 |
| `AGENTES_DATA_DIR` | Pasta dos logs e sugestões (padrão `./data`) |

Veja o `.env.example`. Nunca coloque valores reais em arquivos que vão para o Git.

## Como testar (sem mandar nada)

Pilot só sugerindo, com o CRM rodando em `localhost:3000`:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/agents/pilot/tick?limite=3"
```

Resposta com contadores: `avaliados`, `sugeridos`, `enviados`, `ignorados` e `motivos` (o porquê de cada contato ter sido ignorado).

Ver o que ele preparou e o que decidiu:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/agents/pilot/sugestoes
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/agents/log?limite=20"
```

Sem `CRON_SECRET` no seu computador (fora de produção), pode omitir o cabeçalho.

O registro (`data/agentes-log.json`, últimos 500) guarda só o telefone mascarado, o motivo e os 80 primeiros caracteres da mensagem.

Para testar o auto-atendimento de ponta a ponta, mande uma mensagem de outro número para a sessão conectada, em dia útil e no horário comercial, e confira `/api/agents/log`. Faça isso primeiro com um número seu.

## Riscos (leia antes de ligar)

- **Banimento**: WhatsApp não oficial pode ser limitado ou banido pela plataforma. Respostas automáticas e follow-ups aumentam o risco. Comece com poucos contatos e acompanhe.
- **LGPD**: você é o controlador dos dados. O robô respeita pedido de parar, mas avise seus contatos de que há atendimento automatizado. O auto-atendimento não faz esse aviso por conta própria.
- **IA errando**: a trava de preço está em código, mas o modelo pode escrever algo estranho que não é preço. Por isso o Pilot vem só sugerindo e o auto-atendimento vem desligado. Leia o registro nos primeiros dias.
- **Dados para terceiros**: com a chave de IA ligada, trechos das conversas vão para o provedor dessa chave.
