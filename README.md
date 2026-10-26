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
