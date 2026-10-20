-- Dados de EXEMPLO ILUSTRATIVO. Nomes e valores inventados.
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

insert into crm_produtos (id, nome, valor_centavos) values
 ('00000000-0000-0000-0000-0000000000a1', 'Programa de acompanhamento (exemplo)', 240000)
on conflict (id) do nothing;

insert into crm_funis (nome, canal, produto_id) values
 ('Perpétuo', 'Anúncio + formulário', '00000000-0000-0000-0000-0000000000a1'),
 ('Live semanal', 'Aula aberta', '00000000-0000-0000-0000-0000000000a1'),
 ('Evento', 'Evento presencial', '00000000-0000-0000-0000-0000000000a1');

insert into crm_contatos (id, nome, empresa, segmento, cidade, telefone, nota_pergunta_matadora, dono, handoff_pendente) values
 ('00000000-0000-0000-0000-0000000000c1', 'Mariana Rocha', 'Clínica Exemplo Vida', 'Saúde', 'Cidade Exemplo', '(00) 90000-0001', 9, 'robo', true),
 ('00000000-0000-0000-0000-0000000000c2', 'Paulo Mendes', 'Mendes Engenharia (exemplo)', 'Serviços', 'Cidade Exemplo', '(00) 90000-0002', 10, 'humano', false)
on conflict do nothing;

insert into crm_oportunidades (contato_id, produto_id, etapa_id, valor_centavos, proximo_passo, briefing) values
 ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'handoff', 240000, 'Assumir e ligar para o briefing', null),
 ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'briefing', 240000, 'Enviar proposta', '{"dor":"Orçamentos espalhados","meta":"Responder em 1 dia útil","data":"30/11"}');
