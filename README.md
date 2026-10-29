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
