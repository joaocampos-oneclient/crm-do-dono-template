-- Dados de EXEMPLO ILUSTRATIVO. Nomes e valores inventados. Rode depois de schema.sql.
-- Para carregar o estado completo do CRM local (JSON exportado em Integrações → Dados), veja docs/banco-de-dados.md.

insert into crm_config (id, nome_empresa, nome_robo) values (true, 'IA para Donos', 'Cláudio')
on conflict (id) do nothing;

insert into crm_etapas (id, ordem, nome, objetivo, validacao, prazo_minutos, meta_conversao, automatica, dono_padrao) values
 ('novo', 1, 'Lead novo', 'Chegou de qualquer origem', 'nome + WhatsApp + origem gravados', 5, 70, false, 'robo'),
 ('conversa', 2, 'Em conversa', 'Despertar interesse e qualificar', 'respondeu e deu nota de 0 a 10', 1440, 35, false, 'robo'),
 ('handoff', 3, 'Handoff', 'O humano assume', 'o humano respondeu no mesmo chat', 120, 80, false, 'humano'),
 ('briefing', 4, 'Briefing feito', 'Entender dor, meta e data', 'dor, meta e data na ficha', 2880, 80, false, 'humano'),
 ('proposta', 5, 'Proposta aberta', 'Mostrar a solução com a dor dele', 'o contato abriu a proposta', 2880, 85, true, 'humano'),
 ('oferta', 6, 'Oferta com condição', 'Decisão com prazo', 'link de pagamento enviado, com condição e validade', 2880, 45, false, 'humano'),
 ('pago', 7, 'Pago', 'Pagamento confirmado', 'pedido pago', 0, 95, true, 'sistema'),
 ('dentro', 8, 'Dentro', 'Entrou e passou da garantia', 'primeiro acesso e plano de entrada', 10080, 100, true, 'sistema')
on conflict (id) do nothing;

insert into crm_operadores (id, nome, papel, tipo, email) values
 ('00000000-0000-0000-0000-00000000a001', 'João (dono)', 'dono', 'humano', 'dono@exemplo.com'),
 ('00000000-0000-0000-0000-00000000a002', 'Otávio', 'vendedor', 'humano', 'otavio@exemplo.com'),
 ('00000000-0000-0000-0000-00000000a003', 'Cláudio', 'vendedor', 'ia', null),
 ('00000000-0000-0000-0000-00000000a004', 'Grokbot (leitura)', 'leitura', 'ia', null),
 ('00000000-0000-0000-0000-00000000a005', 'Bot de testes (navegador)', 'bot', 'ia', null)
on conflict (id) do nothing;
update crm_config set robo_operador_id = '00000000-0000-0000-0000-00000000a003';
-- Depois de criar os usuários no Supabase Auth, ligue cada humano:
-- update crm_operadores set user_id = '<uuid do auth.users>' where email = 'otavio@exemplo.com';

insert into crm_produtos (id, nome, valor_centavos, parcelas, descricao, gatilhos) values
 ('00000000-0000-0000-0000-0000000000a1', 'Comunidade IA para Donos', 199700, '12x R$ 197', 'Encontros semanais, templates e suporte no grupo.', array['Sessão fechada de quinta: entra até sexta e participa', 'Bônus do evento: diagnóstico do João (3 dias)']),
 ('00000000-0000-0000-0000-0000000000a2', 'Imersão presencial', 497000, '10x R$ 497', 'Dois dias presenciais, turma pequena.', array['Vaga com desconto de lote até o fim do mês']),
 ('00000000-0000-0000-0000-0000000000a3', 'Mentoria individual', 1200000, '12x R$ 1.000', 'Um a um, 6 meses.', array['Só 2 vagas por trimestre']),
 ('00000000-0000-0000-0000-0000000000a4', 'Diagnóstico presencial', 250000, 'à vista', 'Meio dia na sua empresa.', '{}')
on conflict (id) do nothing;

insert into crm_funis (id, nome, canal, produto_id) values
 ('perpetuo', 'Perpétuo', 'Anúncio + formulário', '00000000-0000-0000-0000-0000000000a1'),
 ('live', 'Live semanal', 'Aula aberta de quarta, 14h', '00000000-0000-0000-0000-0000000000a1'),
 ('evento', 'Evento quinzenal', 'Evento presencial ou live especial', '00000000-0000-0000-0000-0000000000a1')
on conflict (id) do nothing;

insert into crm_criativos (funil_id, nome, plataforma) values
 ('perpetuo', 'Vídeo · ''Perco paciente no WhatsApp''', 'Meta Ads'),
 ('perpetuo', 'Imagem · Diagnóstico gratuito', 'Meta Ads'),
 ('live', 'Convite · Aula de quarta', 'Meta Ads');

insert into crm_templates (nome, canal, assunto, texto) values
 ('Convite para a sessão fechada', 'whatsapp', null, '{nome}, quinta às 19h tem a sessão fechada da {empresa}. Vou te mostrar na prática como {produto} resolve o que você me contou. Posso te mandar o link?'),
 ('Follow-up sem pressão', 'whatsapp', null, '{nome}, passando para saber se ficou alguma dúvida sobre a proposta. Se preferir, te ligo em 5 minutos.'),
 ('Convite para sessão fechada (e-mail)', 'email', 'Convite: sessão fechada de quinta', E'Olá, {nome}.\n\nQuinta-feira às 19h fazemos uma sessão fechada para quem está decidindo entrar na {empresa}.\n\nQuer participar? Responda este e-mail que eu mando o link.\n\n{operador}');

insert into crm_contatos (id, nome, empresa, segmento, cidade, telefone, email, funil_origem_id, nota_pergunta_matadora, dono, operador_id, handoff_pendente, handoff_desde) values
 ('00000000-0000-0000-0000-0000000000c1', 'Mariana Rocha', 'Clínica Exemplo Vida', 'Saúde', 'Goiânia', '(62) 90000-0001', 'mariana@exemplo.com', 'perpetuo', 9, 'robo', null, true, now() - interval '22 minutes'),
 ('00000000-0000-0000-0000-0000000000c2', 'Paulo Mendes', 'Mendes Engenharia', 'Serviços', 'Anápolis', '(62) 90000-0002', 'paulo@exemplo.com', 'live', 10, 'humano', '00000000-0000-0000-0000-00000000a002', false, null)
on conflict do nothing;

insert into crm_oportunidades (id, contato_id, produto_id, etapa_id, valor_centavos, proximo_passo, briefing) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'handoff', 199700, 'Assumir e ligar para o briefing', null),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'briefing', 199700, 'Enviar proposta', '{"dor":"Orçamentos espalhados","meta":"Responder em 1 dia útil","data":"30/11"}')
on conflict do nothing;

insert into crm_movimentos (oportunidade_id, de_etapa, para_etapa, por, em) values
 ('00000000-0000-0000-0000-0000000000d1', null, 'novo', 'sistema', now() - interval '95 minutes'),
 ('00000000-0000-0000-0000-0000000000d1', 'novo', 'conversa', 'robo', now() - interval '60 minutes'),
 ('00000000-0000-0000-0000-0000000000d1', 'conversa', 'handoff', 'robo', now() - interval '22 minutes'),
 ('00000000-0000-0000-0000-0000000000d2', null, 'novo', 'sistema', now() - interval '26 hours'),
 ('00000000-0000-0000-0000-0000000000d2', 'novo', 'conversa', 'robo', now() - interval '25 hours'),
 ('00000000-0000-0000-0000-0000000000d2', 'conversa', 'handoff', 'robo', now() - interval '24 hours'),
 ('00000000-0000-0000-0000-0000000000d2', 'handoff', 'briefing', '00000000-0000-0000-0000-00000000a002', now() - interval '90 minutes');

insert into crm_mensagens (contato_id, autor, texto, em) values
 ('00000000-0000-0000-0000-0000000000c1', 'contato', 'Oi, vi o anúncio. Perco paciente no WhatsApp toda semana.', now() - interval '60 minutes'),
 ('00000000-0000-0000-0000-0000000000c1', 'robo', 'Entendi. Colocar um atendimento organizado para funcionar na clínica é prioridade agora? De 0 a 10, qual a nota?', now() - interval '59 minutes'),
 ('00000000-0000-0000-0000-0000000000c1', 'contato', '9. E quanto custa?', now() - interval '23 minutes'),
 ('00000000-0000-0000-0000-0000000000c1', 'robo', 'Faz sentido, Mariana. Vou te passar para Otávio, que cuida disso.', now() - interval '22 minutes');

insert into crm_gastos_midia (funil_id, data, valor_centavos, visitas)
select 'perpetuo', d::date, 3500 + (extract(day from d)::int % 5) * 300, 40 + (extract(day from d)::int % 7) * 3
from generate_series(current_date - 29, current_date, interval '1 day') d;
