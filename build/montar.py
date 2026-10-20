"""Monta o app a partir do código do artefato Banco CBR (fonte/), aplicando as trocas do app.
Uso: python build/montar.py  -> gera index.html e app.js na raiz. Não editar index.html/app.js à mão: editar aqui ou em fonte/."""
import os, re
R = os.path.join(os.path.dirname(__file__), "..")
VERSAO = "1.0.0"
js = open(f"{R}/fonte/artefato-app.js", encoding="utf8").read()
js = js.split("<script>", 1)[1].rsplit("</script>", 1)[0]
head = open(f"{R}/fonte/artefato-head.html", encoding="utf8").read()

def troca(a, b, n=1):
    global js
    c = js.count(a)
    assert c == n, f"esperava {n}x, achei {c}x: {a[:80]}"
    js = js.replace(a, b)

# imagens do repositório privado (servidas pelo sw.js)
troca("const imgSrc=u=>String(u).startsWith('u:')?",
      "const imgSrc=u=>String(u).startsWith('gh:')?'./img/'+encodeURIComponent(String(u).slice(3)):String(u).startsWith('u:')?")
# número da questão = número no Notion
troca("const posDe=q=>+q.id.slice(1);", "const posDe=q=>q.n??1e5;")
troca("Notion #${posDe(q)%1000}${q.n!=null?' · Q'+q.n+'/'+q.grupo:''}", "Notion #${q.n??'—'}")
# comentário do curso + do Claude em cada alternativa
troca("${fb&&q.coment[l]?`<div class=\"mut md cm\" style=\"margin-top:6px\">${md(q.coment[l])}</div>`:''}", "${fb?comentAlt(q,l):''}")
# ponto de ensino do curso antes do CCQ do Claude
troca("${pontoBloco(q)}${iaBloco(q)}", "${cursoBloco(q)}${pontoBloco(q)}${iaBloco(q)}")
# IA = Gemini
troca("'CCQ e resumo rápido com o Claude ('+keyLab('ia')+')'", "'CCQ e resumo rápido com IA ('+keyLab('ia')+')'")
troca("toast('O Claude não está disponível nesta janela.')", "toast('Cole a chave do Gemini em Banco › Chaves deste aparelho.')")
troca("toast(e&&e.code==='not_granted'?'Permissão negada para usar o Claude.':'Não consegui gerar agora. Tente de novo.')",
      "toast(e&&e.code==='not_granted'?'Cole a chave do Gemini em Banco › Chaves deste aparelho.':'Não consegui gerar agora. Tente de novo.')")
# texto da sincronização
js = js.replace("Seu progresso é salvo automaticamente na sua conta e aparece igual em todos os aparelhos que abrirem este link.",
                "Seu progresso é salvo automaticamente no GitHub (banco-cbr-app) e aparece igual em todos os aparelhos.")

# aba Banco nova: igual ao Notion (todas, numeradas, em toggle)
ini = js.index("let bq='';\nfunction vBanco(){")
fim = js.index("let cfgTab='geral';")
js = js[:ini] + open(f"{R}/build/banco.js", encoding="utf8").read() + "\n\n" + js[fim:]

open(f"{R}/app.js", "w", encoding="utf8").write(f"// Banco CBR app {VERSAO} — gerado por build/montar.py a partir do artefato (não editar à mão)\n" + js)

css = open(f"{R}/build/extra.css", encoding="utf8").read()
pwa = ('<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><link rel="apple-touch-icon" href="icon.svg">'
       '<meta name="theme-color" content="#0f172a"><meta name="apple-mobile-web-app-capable" content="yes">')
head = head.replace("<style>", pwa + "<style>", 1).replace("</style>", css + "</style>", 1)
open(f"{R}/index.html", "w", encoding="utf8").write(head + f'\n<script>window.BCBR_VERSAO="{VERSAO}"</script><script src="shim.js?v={VERSAO}"></script>\n</body></html>\n')
print("ok: app.js", len(js), "bytes · index.html", VERSAO)
