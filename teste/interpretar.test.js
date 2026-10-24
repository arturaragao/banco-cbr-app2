// Testes de interpretarTarefa (build/interpretar.js). Uso: node teste/interpretar.test.js  (sai com código 1 se falhar)
const { interpretarTarefa, tituloIdeia } = require('../build/interpretar.js');
const H = '2026-10-23';   // sexta-feira
let falhas = 0, n = 0;
function t(nome, entrada, esperado) {
  n++;
  const r = interpretarTarefa(entrada, H);
  const obtido = JSON.stringify(r.map(x => ({ texto: x.texto, dia: x.dia, hora: x.hora, urg: x.urg, area: x.area })));
  const alvo = JSON.stringify(esperado.map(x => ({ texto: x.texto, dia: x.dia ?? null, hora: x.hora ?? null, urg: !!x.urg, area: x.area ?? null })));
  if (obtido !== alvo) { falhas++; console.log('FALHOU: ' + nome + '\n  entrada: ' + entrada + '\n  esperado: ' + alvo + '\n  obtido:   ' + obtido) }
}
t('sem data definida', 'lavar carro tarefa sem data definida', [{ texto: 'Lavar carro', dia: 'sem', area: 'tarefas' }]);
t('data + hora', 'consulta neurologista dia 30/10 11 horas', [{ texto: 'Consulta neurologista', dia: '2026-10-30', hora: '11:00' }]);
t('amanhã', 'estudar tórax amanhã', [{ texto: 'Estudar tórax', dia: '2026-10-24' }]);
t('depois de amanhã + 9h30', 'pagar conta depois de amanhã às 9h30', [{ texto: 'Pagar conta', dia: '2026-10-25', hora: '09:30' }]);
t('dia da semana (próxima ocorrência)', 'ligar para o Dr. Silva na sexta', [{ texto: 'Ligar para o Dr. Silva', dia: '2026-10-30' }]);
t('segunda + 14:30', 'reunião segunda 14:30', [{ texto: 'Reunião', dia: '2026-10-26', hora: '14:30' }]);
t('dia 5 já passou -> mês que vem', 'dia 5 comprar presente', [{ texto: 'Comprar presente', dia: '2026-11-05' }]);
t('dia 25 neste mês', 'dia 25 pagar boleto', [{ texto: 'Pagar boleto', dia: '2026-10-25' }]);
t('15/01 já passou -> ano seguinte', '15/01 renovar carteira', [{ texto: 'Renovar carteira', dia: '2027-01-15' }]);
t('data com ano', 'prova 30/10/2026', [{ texto: 'Prova', dia: '2026-10-30' }]);
t('urgente', 'comprar pão urgente', [{ texto: 'Comprar pão', urg: true }]);
t('tipo estudo no começo', 'estudo revisar RM de joelho', [{ texto: 'Revisar RM de joelho', area: 'estudo' }]);
t('tipo ferramenta no fim', 'montar script ferramenta', [{ texto: 'Montar script', area: 'ferramenta' }]);
t('várias tarefas', 'lavar carro próxima tarefa ligar pro João amanhã nova tarefa pagar luz', [
  { texto: 'Lavar carro' }, { texto: 'Ligar pro João', dia: '2026-10-24' }, { texto: 'Pagar luz' }]);
t('ponto e vírgula', 'comprar leite; pagar luz hoje', [{ texto: 'Comprar leite' }, { texto: 'Pagar luz', dia: H }]);
t('11 e meia', 'almoço 11 e meia hoje', [{ texto: 'Almoço', dia: H, hora: '11:30' }]);
t('às 11h', 'consulta às 11h hoje', [{ texto: 'Consulta', dia: H, hora: '11:00' }]);
t('3 da tarde', 'reunião 3 da tarde amanhã', [{ texto: 'Reunião', dia: '2026-10-24', hora: '15:00' }]);
t('quarta-feira', 'treino quarta-feira', [{ texto: 'Treino', dia: '2026-10-28' }]);
t('30 de outubro', '30 de outubro dentista', [{ texto: 'Dentista', dia: '2026-10-30' }]);
t('para hoje', 'entregar relatório para hoje', [{ texto: 'Entregar relatório', dia: H }]);
t('sem nada', 'comprar café', [{ texto: 'Comprar café' }]);
t('vazio', '   ', []);
// tituloIdeia (widget Ideia -> tarefa Ferramenta "💡 título")
function ti(nome, entrada, esperado) { n++; const o = tituloIdeia(entrada); if (o !== esperado) { falhas++; console.log('FALHOU: ' + nome + ' -> ' + o + ' (esperado ' + esperado + ')') } }
ti('ideia curta', '  versão do apk  no topo ', 'Versão do apk no topo');
ti('tira enrolação e corta em 7 palavras', 'quando eu tô gravando aqui esses áudios é pelo Google né Beleza mas se eu paro de falar ele para', 'Quando eu tô gravando aqui esses áudios');
ti('tira eu queria que', 'eu queria que o app de fotos abrisse em tela cheia. e mais coisas', 'O app de fotos abrisse em tela cheia');
ti('muletas no meio', 'tipo um botão né pra exportar o laudo', 'Um botão pra exportar o laudo');
ti('só enrolação usa o texto', 'né', 'Né');
console.log(falhas ? falhas + ' de ' + n + ' falharam' : 'ok: ' + n + ' casos');
process.exit(falhas ? 1 : 0);
