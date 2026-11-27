# Particle & Dash Life

Um ecossistema visual interativo de partículas e criaturas, com alimentação, evolução, reprodução e batalhas. Feito para observar como um wallpaper vivo, com fundo procedural e glow.

**Abrir:** https://raffribeiro.github.io/ParticleAndDashLife/

## Controles

A interface começa oculta. Pressione **F** para mostrar ou esconder os controles. Em telas de toque, use “Mostrar controles”. Duplo clique na cena alterna tela cheia. Clique em **Start Simulation** para iniciar o charge e a explosão. Espaço pausa; clicar na cena cria um distúrbio local e arrastar uma criatura move seu corpo e as partes ligadas a ele. Soltar uma criatura não dispara outro distúrbio.

## Executar localmente

Requer Python 3 e, para testes, Node.js.

```sh
npm start
# http://localhost:4173
npm test
```

A pasta `dist/` contém o aplicativo estático, sem dependências externas. WebGL desenha a cena e um Web Worker executa a simulação. O alvo é 60 fps; a taxa depende do dispositivo e da configuração.

No GitHub Pages, as preferências são salvas neste navegador. O servidor local opcional `serve.py` também permite gravar as preferências em arquivo.

## Desempenho automático

“Priorizar 60 fps” vem ligado. Antes de liberar Start, o app testa uma cena isolada com partículas, peixes e corpos articulados no worker e mede o custo real de renderização na GPU, incluindo rastros já preenchidos e a cadência dos frames do navegador. Aumenta a carga até faltar folga, reserva 20% de margem e prepara um modo leve se necessário. O núcleo da abertura é redesenhado antes de cada apresentação; o teste não inicia a simulação real. Se o teste falhar, libera uma partida conservadora.

Antes do teste, o núcleo provisório usa até 120 partículas. Após o teste, a partida usa a população segura medida para o aparelho, com a margem de segurança do benchmark. Qualidade, resolução, efeitos e limite de população permanecem fixos durante a sessão; o FPS continua visível para consulta, sem disparar ajustes.

O teste escolhe entre sete níveis de qualidade, reduzindo resolução, passes de bloom, textura, rastros e população conforme a capacidade medida. Corpos já formados, peixes e projéteis são preservados pelo controle ecológico. As preferências salvas não são sobrescritas.

No desktop, F abre os controles. O ajuste de desempenho só pode ser alterado antes do Start. A medição é local, sem envio do benchmark. 60 fps é uma meta e pode variar com aquecimento, economia de energia e outras cargas no aparelho.

## Animação da abertura

As letras e o botão usam curvas de `spring()` e `interpolate()` do Remotion, pré-calculadas em `dist/opening-motion-data.js`. O navegador reproduz os keyframes com Web Animations; o botão permanece HTML interativo e a simulação não carrega React nem um player de vídeo. A entrada respeita a preferência por movimento reduzido.

Para recriar as curvas após editar `scripts/build-opening-motion.mjs`:

```sh
npm ci
npm run build:opening
```

## Gatilhos de áudio locais

O áudio é opcional e vem desligado: `dist/audio-map.js` exporta um mapa vazio, portanto a página não cria `AudioContext` nem requisita arquivos de som. Para usar sons próprios, crie `dist/audio/`, copie os arquivos locais para essa pasta e associe caminhos relativos no objeto `audioMap`, por exemplo:

```js
export const audioMap=Object.freeze({
  'world.big-bang':'audio/big-bang.ogg',
  'world.pulse':'audio/pulse.ogg'
});
```

IDs disponíveis: `ui.start`, `world.big-bang`, `world.pulse`, `creature.birth`, `creature.death`, `creature.assemble` e `creature.break`. Não há mídia incluída no projeto. Quando o mapa tem arquivos, a página cria o `AudioContext` antes do gesto e prepara a mídia sem chamar `resume()` nem criar source; no Chrome desktop ele normalmente permanece suspenso pela autoplay policy. O primeiro clique aceito em **Start Simulation** desbloqueia o contexto e toca `ui.start` uma vez se seu buffer já estiver pronto. O Start nunca aguarda áudio. Em carregamento frio, arquivo ausente ou decode inválido, o evento daquele instante é descartado e não toca atrasado quando a mídia termina; eventos futuros podem usar buffers que ficarem prontos. A reprodução usa no máximo quatro vozes e descarta excessos, sem fila tardia.

`dist/audio-factory.js` é o único ponto de composição do áudio na app. `createAppAudio()` sempre envolve a factory com o gate do contrato; não conecte middleware diretamente em `app.js`. O gate valida revisão e geração do envelope, revisão e sequência monotônica de cada evento, deduplica por high-water da partida e descarta eventos incompatíveis com pausa ou aba oculta antes de chamar qualquer adaptador. Reset e mudanças de geração atualizam essa fronteira sem reabrir replay antigo. O WebAudio mantém proteções próprias apenas como defesa de playback; elas não substituem o gate.

Para trocar Web Audio por um middleware, mantenha `app.js`, o worker e a simulação intactos e injete a `factory` em `createAppAudio`. O adaptador deve ser passivo quanto ao contrato e expor a lifecycle síncrona `prepare()`, `acceptStart(event)`, `setState(state)`, `handle(message)` e `stop()`: não invente IDs, não filtre revisão e não deduplique. `prepare()` não pode tocar som. No primeiro gesto aceito, a app cria explicitamente `{id:'ui.start', origin:'app', revision, generation}`; `setupAudioStart()` atualiza o estado e passa esse mesmo objeto a `acceptStart(event)` ainda na pilha síncrona do clique. `handle()` recebe, na ordem original e sem conversão, somente eventos do worker aprovados pelo gate, preservando `x`, `y`, `species`, `origin`, `revision` e `sequence`. A policy de vozes, buffers, falhas de mídia e reprodução tardia pertence ao adaptador. Mesmo se `handle()` descartar o lote ou lançar, a app envia em `finally` o ACK do envelope original, com o `sequence` original, evitando bloquear o canal do worker.

## Licença

Copyright © 2026 raffribeiro.

Gratuito para **uso não comercial**, incluindo uso pessoal, estudo e modificação conforme a [PolyForm Noncommercial 1.0.0](LICENSE.md). Uso comercial exige autorização separada do titular. Esta é uma licença de código disponível com restrição comercial, não uma licença open source aprovada pela OSI.

Inspirado conceitualmente em Particle Life; esta implementação não incorpora código do projeto de referência.

### Calibração na abertura
O teste de desempenho ocorre antes de Start Simulation. O resultado fixa a qualidade e o limite de população para a sessão; não há mudanças automáticas de qualidade durante a simulação. A partida começa com até 120 partículas e o ciclo de vida preenche gradualmente o limite escolhido. O teste busca 60 fps com margem, sem garantir essa taxa em toda condição de hardware.

### Sessões prolongadas
A comunicação com a tela mantém no máximo um snapshot em trânsito; quadros atrasados são substituídos pelo estado mais recente. Eventos recentes, efeitos, rastros e cache de cores têm limites fixos. Fragmentações respeitam o orçamento de corpos, mantendo o restante como partículas livres. O app não envia mais logs automáticos de FPS para um arquivo local.
Após 15 segundos na abertura, a renderização cai para 30 fps, com até três níveis de bloom e textura estática. Start restaura imediatamente o perfil medido e a meta de 60 fps; nenhuma recalibração acontece durante a simulação.

### Ritmo de perseguição
Criaturas em confronto alternam arrancadas curtas e recuperação, com fases próprias e resistência influenciada por seus traços. Quem persegue antecipa a trajetória do alvo; quem foge faz leves desvios e perde a vantagem de velocidade permanente. Corpos maiores e com mais patas mantêm seus custos de locomoção. O estado de perseguição tem tamanho fixo por criatura, sem histórico de alvos nem timers adicionais.
