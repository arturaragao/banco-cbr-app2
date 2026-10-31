// Dados inteiramente fictícios; o modo --simulado nunca abre o repositório privado.
const hoje=new Date(),iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dia=n=>{const d=new Date(hoje);d.setDate(d.getDate()+n);return iso(d)};
module.exports={
  'dados/questoes.json':[],
  'semana/plano.json':{v:2,dias:{},tarefas:[
    {id:'teste-f',dia:dia(0),texto:'Ferramenta fictícia',area:'ferramenta',feito:false},
    {id:'teste-t',dia:dia(0),texto:'Tarefa fictícia',area:'tarefas',feito:false,urg:true,subtarefas:[{id:'etapa',texto:'Etapa fictícia',feito:false}]},
    {id:'teste-e',dia:dia(0),texto:'Estudo fictício',area:'estudo',feito:false,det:'Detalhes antigos sem formatação'},
    {id:'teste-amanha',dia:dia(1),texto:'Tarefa de amanhã',area:'tarefas',feito:false},
    {id:'teste-sem',dia:'sem',texto:'Tarefa sem data',area:'tarefas',feito:false},
    {id:'teste-fora',dia:dia(12),texto:'Fora da semana',area:'estudo',feito:false}
  ],notas:[]},
  'semana/agenda.json':{eventos:[],avisos:[]}
};
