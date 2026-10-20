# CRM do dono · template educacional

Template do encontro **Trabalhe Comigo #10 · Seu time comercial em uma tela** (IA para Donos).

## O que isto é, e o que não é

| Parte | Estado |
| --- | --- |
| Telas navegáveis (Hoje, Funil, Contatos, Playbook, Números) | **Pronto** para você ver e mexer |
| Regras de negócio (nota 0–10, prazo, categoria, trava do robô, conta reversa) | **Pronto**, com testes |
| Schema SQL com RLS (`supabase/schema.sql`) | **Pronto** para rodar em projeto novo seu |
| Dados | **Exemplo ilustrativo** (nomes, empresas e valores inventados) |
| WhatsApp, pagamento, telefonia, transcrição, copiloto | **Simulados** (`src/adapters/mock.ts`). Nada sai do navegador |
| Login, CRUD salvando no banco | **Não incluso**. É o seu próximo passo |

Não é um produto pronto para produção. É um ponto de partida para você construir o seu, com o Cursor.

## Rodar em 2 minutos

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # 12 testes das regras
npm run build
```

Precisa de Node 20 ou mais novo.

## Como o CRM é pensado

1. **Contato** é a pessoa. **Oportunidade** é uma chance de vender um produto para ela. Um contato pode ter várias.
2. **Categoria** (lead, prospect, cliente) é calculada pelas oportunidades. Ninguém edita.
3. **Funil de venda com 8 etapas** (`src/domain/funil.ts`). Cada etapa tem um **Canvas**: objetivo, como validar, prazo, meta, quem move e motivos de perda. O card só anda quando o critério foi cumprido.
4. **Pergunta Matadora**: uma pergunta por etapa que decide o próximo passo. Na primeira, o contato dá uma nota de 0 a 10: de 0 a 6 você nutre, 7 e 8 convida, 9 e 10 passa para o humano.
5. **Handoff**: o robô qualifica, o humano fecha. A troca de mão sempre avisa o contato.
6. **Ligação**: gravada com aviso, vira transcrição com trechos marcados (dor, meta, prazo, objeção, decisão) e follow-ups. O termômetro é do vendedor; a leitura da IA fica ao lado.
7. **Regra de ouro do robô**: nunca fala preço, desconto, parcela ou condição (`podeRoboEnviar`). A trava está no código, não só no prompt.

## Mapa das pastas

```
src/ds/         design system (componentes e tokens)
src/domain/     tipos e regras puras (copie para o backend quando precisar)
src/data/       dados de exemplo
src/adapters/   portas de integração (interfaces + simulações)
src/screens/    as telas
supabase/       schema.sql e seed.sql
tests/          testes das regras
```

## Continuar no Cursor

1. Abra esta pasta no Cursor.
2. Crie um projeto novo no Supabase (seu, de teste). Rode `supabase/schema.sql` e depois `supabase/seed.sql` no editor SQL.
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave **anon**. Nunca coloque a chave `service_role` no front-end.
4. Cole este prompt no Cursor e vá **uma etapa por vez**:

```text
Você vai me ajudar a evoluir este CRM educacional. Eu sou empreendedor, não programador:
explique em português simples e entregue em passos pequenos.

Contexto: leia README.md, src/domain/types.ts, src/domain/funil.ts, src/domain/rules.ts
e supabase/schema.sql. Os dados em src/data/demo.ts são de exemplo.

Regras:
- Não mude o modelo (Contato -> Oportunidades) nem o schema sem me perguntar antes.
- Toda regra nova entra em src/domain/rules.ts com teste em tests/.
- Integrações novas entram como adaptador em src/adapters/, com a mesma interface do mock.
- Nunca coloque segredo no código. Use .env.local.
- Antes de cada mudança, me diga o que vai fazer e o que pode dar errado.

Passo 1: ligue a lista de Contatos ao Supabase (leitura), com login por link mágico,
mantendo os dados de exemplo como alternativa quando não houver .env.local.
Mostre o resultado e espere eu aprovar para o passo 2 (mover card de etapa gravando em crm_movimentos).
```

Ordem sugerida: 1) ler contatos do banco, 2) mover card gravando o histórico, 3) mensagens, 4) tarefas e notas, 5) ligações e transcrição (por último; é a mais cara e a mais sensível), 6) trocar o robô de exemplo por um real.

## Antes de usar com cliente de verdade

- Troque as etapas, metas e a Pergunta Matadora pelas **suas**. Os números aqui são exemplo.
- Avise o contato quando a conversa for gravada. Sem aviso, não grave.
- Guarde áudio em bucket privado, com URL assinada.
- Revise LGPD: finalidade, retenção e quem acessa.
- Teste num projeto separado antes de colocar dado real.

## Licença

MIT. O design system (Design System 2027) e as fontes Geist (licença OFL, via `@fontsource`) acompanham o template.
