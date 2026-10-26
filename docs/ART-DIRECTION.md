# Direção de arte — Particle & Dash Life (Pop)

Referência única para qualquer mudança visual (Claude e Codex). Tokens CSS em `dist/style.css` (`--pop-*`); paleta da cena em `dist/color.js` (`makePopPalette`).

## Princípios
1. **Figura sobre fundo.** O fundo é escuro e quase neutro (`#1d1d28`, OKLCH .235/.022/285). Toda a cor vive nas partículas e nos traços.
2. **60-30-10 por população.** Espécies 0-1 (60%): azul `#3f93f7` + ciano `#00b8d6` — base fria. Espécies 2-3 (30%): coral `#ff4f6d` + rosa `#ff4fb2` — contraste quente. Espécies 4-5 (10%): amarelo `#ffde0b` + lima `#8def46` — os mais claros, destaque. O slider de matiz gira as seis em OKLCH; fundo e tinta nunca giram.
3. **Forma chapada + contorno de tinta.** Preenchimento sem gradiente nem glow por forma. Contorno em tinta (`#111`) separa formas que se sobrepõem. Contorno das partículas = 24% do raio (partículas minúsculas ficam praticamente sem contorno, para não virar mancha preta).
4. **Traços arredondados.** Todo traço sólido tem extremidades e junções redondas (discos em cada vértice). Nada de pontas cortadas ou quinas abertas.
5. **Hierarquia de espessura.** Corpo > membros > detalhes. Contorno sempre +1,9 px além do traço.
6. **Pós-processamento.** Bloom e granulado são aplicados à imagem inteira (camada de pós), controlados pelos sliders Bloom e Granulado. No Pop o bloom roda a 55% da intensidade do slider, sem compressão de realces (as cores chapadas ficam com saturação total) e com vinheta leve. O fundo entra no composite como cor chapada.
7. **Textura de tela.** Efeito TV/VHS opcional (slider "Linhas de TV"): scanlines, faixa rolante, tracking, franja cromática e jitter leve de matiz/saturação — sempre sutil, nunca a ponto de esconder as formas.
8. **Abertura sem loading.** O aglomerado aparece primeiro, pulsando; depois o nome e depois o botão, cada um de estalo (sem fade). Só nome + botão.
9. **Pós cobre tudo.** Granulado, scanlines e faixa rolante ficam no overlay `#screen-fx`, por cima da cena e da UI; a UI ganha brilho e franja cromática proporcionais aos sliders.
10. **Nada escrito durante a obra.** Com a interface oculta, nenhum texto na tela (nem etiqueta, nem versão).
11. **Feedback só por escala.** Golpes, nascimento, perturbação e ondas são escala das próprias partículas. Sem anéis, faíscas ou overlays desenhados.
12. **Movimento.** Transições de UI 150 ms ease-out (`--pop-ease`); respeitar `prefers-reduced-motion`.

## Interface
- Linhas e textos sobre o fundo escuro: creme `#f3ead6` (secundário `#b9b2a2`). Destaques: amarelo `#ffde0b`. Ação principal: coral `#ff4f6d`.
- Cartões: branco, contorno 4 px tinta, sombra dura `4px 4px 0` tinta, raio 22 px. Botões: pílula/16 px, contorno 3 px, sombra dura que "afunda" no clique.
- Grade de 8 px. Texto mínimo 11 px. Tipografia pesada em caixa alta só para títulos e rótulos curtos.
- Contraste mínimo AA (4,5:1) para texto.

## Não fazer
- Círculos ou pontos dentro dos corpos/peixes.
- Glow/halo por forma, gradientes, anéis/strokes vazios, faíscas (bloom só como pós global).
- Cores fora da paleta ou saturação no fundo.
- Quebrar a proporção 60-30-10 (ex.: dar a cor de destaque a uma espécie comum).
