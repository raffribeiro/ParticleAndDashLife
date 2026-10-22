# Particle & Dash Life

Um ecossistema visual interativo de partículas e criaturas, com alimentação, evolução, reprodução e batalhas. Feito para observar como um wallpaper vivo, com fundo procedural e glow.

**Abrir:** https://raffribeiro.github.io/ParticleAndDashLife/

## Controles

A interface começa oculta. Pressione **F** para mostrar ou esconder os controles. Em telas de toque, use “Mostrar controles”. Duplo clique na cena alterna tela cheia. Espaço pausa; arrastar atrai e Shift + arrastar repele.

## Executar localmente

Requer Python 3 e, para testes, Node.js.

```sh
npm start
# http://localhost:4173
npm test
```

A pasta `dist/` contém o aplicativo estático, sem dependências externas. WebGL desenha a cena e um Web Worker executa a simulação. O alvo é 60 fps; a taxa depende do dispositivo e da configuração.

No GitHub Pages, as preferências são salvas neste navegador. O servidor local opcional `serve.py` também permite gravar as preferências em arquivo.

## Licença

Copyright © 2026 raffribeiro.

Gratuito para **uso não comercial**, incluindo uso pessoal, estudo e modificação conforme a [PolyForm Noncommercial 1.0.0](LICENSE.md). Uso comercial exige autorização separada do titular. Esta é uma licença de código disponível com restrição comercial, não uma licença open source aprovada pela OSI.

Inspirado conceitualmente em Particle Life; esta implementação não incorpora código do projeto de referência.
