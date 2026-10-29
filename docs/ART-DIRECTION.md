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
8. **Abertura sem loading.** O aglomerado aparece primeiro, pulsando; depois as letras entram em sequência com squash, impacto e rebote curto; o botão acompanha. Curvas criadas com Remotion e exportadas para Web Animations (sem player no runtime). Respeitar reduced-motion. Título próximo ao topo e botão logo abaixo do núcleo central. Só nome + botão.
9. **Pós cobre tudo.** Granulado, scanlines e faixa rolante ficam no overlay `#screen-fx`, por cima da cena e da UI; a UI ganha brilho e franja cromática proporcionais aos sliders.
10. **Nada escrito durante a obra.** Com a interface oculta, nenhum texto na tela (nem etiqueta, nem versão).
11. **Feedback só por escala.** Golpes, nascimento, perturbação e ondas são escala das próprias partículas. Sem anéis, faíscas ou overlays desenhados.
12. **Movimento.** Transições de UI 150 ms ease-out (`--pop-ease`); respeitar `prefers-reduced-motion`.

## Adaptação de desempenho
- Antes do Start: testar carga isolada de CPU/GPU, mantendo o núcleo visível. Mensagem curta abaixo do botão; não liberar a explosão durante o teste. Partida com até 120 partículas, crescendo somente com folga medida.
- Preservar criaturas formadas, identidades e silhuetas. Em níveis econômicos, reduzir gradualmente partículas soltas para aliviar a física, sem reset; o controle mantém a população desejada. O alvo de 60 fps tem prioridade sobre resolução, passos de bloom, granulado/VHS animados e rastros em aparelhos lentos.
- O perfil inicial limita os efeitos sem sobrescrever os controles salvos do usuário; permanece fixo após Start.
- Resultado da calibração fica no painel de controles, sem adicionar texto sobre a obra em modo wallpaper.

## Interface
- Linhas e textos sobre o fundo escuro: creme `#f3ead6` (secundário `#b9b2a2`). Destaques: amarelo `#ffde0b`. Ação principal: coral `#ff4f6d`.
- Cartões: branco, contorno 4 px tinta, sombra dura `4px 4px 0` tinta, raio 22 px. Botões: pílula/16 px, contorno 3 px, sombra dura que "afunda" no clique.
- Título de abertura: grande, em duas linhas (Particle / & Dash Life), com contraste reduzido e sem brilho para manter o núcleo e o Start como focos. Letras alternam as mesmas seis cores vivas do contorno do botão Start, acompanhando as mudanças de paleta. O título não recebe glow próprio. Após a entrada, cada letra pulsa em escala com duração, fase e amplitude independentes; a pulsação para ao iniciar a simulação e respeita reduced-motion.
- Tipografia: **Nunito variável**, embarcada em `dist/fonts/` (SIL Open Font License), com formas arredondadas. Peso 900 para títulos e 800 para ações; leitura regular nos textos de apoio. Sem dependência de serviços de fontes externos.
- Grade de 8 px. Texto mínimo 11 px. Tipografia pesada em caixa alta só para títulos e rótulos curtos.
- Contraste mínimo AA (4,5:1) para texto.

## Não fazer
- Círculos ou pontos dentro dos corpos/peixes.
- Glow/halo por forma, gradientes, anéis/strokes vazios, faíscas (bloom só como pós global).
- Cores fora da paleta ou saturação no fundo.
- Quebrar a proporção 60-30-10 (ex.: dar a cor de destaque a uma espécie comum).

## Calibração inicial e interação
- O benchmark CPU/GPU ocorre antes do Start. Qualidade e limite de população ficam fixos depois; não há ajuste de FPS durante a simulação. A população nasce gradualmente até esse limite, sujeita ao ciclo ecológico.
- O título usa duas linhas com a mesma largura, formando um retângulo. A segunda linha tem letras menores para acomodar & Dash Life.
- Nenhum texto ou elemento pode ser selecionado. No celular os controles e Mostrar controles ficam ocultos.

## Logo de abertura
- A abertura usa o PNG fornecido pelo Raff em images/particle-and-dash-life.png, preservando cores, transparência e proporção. O logo fica centralizado acima do núcleo, compondo um único grupo com o Start, limitado por largura e altura da tela. Entrada curta com o spring existente; não recriar as letras em HTML.

## Assinatura e idioma
- Logo centralizado acima do núcleo, com até 210px e tamanho limitado a 52vw/25vh. A distância até o núcleo varia de 30 a 60px para manter a composição unida e funcionar em telas baixas. Somente o status do benchmark fica no canto inferior direito; botão permanece na posição original.
- Toda a interface, status e descrições públicas usam inglês.
- Após o benchmark, a população inicial usa o orçamento seguro medido (com a margem do teste), em vez de limitar todos os aparelhos a 120. O núcleo provisório anterior ao teste continua leve. Qualidade e orçamento permanecem fixos após Start.

- Start Simulation pulsa brevemente a cada 6,5s após a entrada e a liberação pelo benchmark: antecipação curta, expansão de 7,5% e assentamento. Usa somente scale, sem loop JS; respeita reduced-motion e para ao iniciar.

- A coluna visual da abertura é compartilhada entre logo e botão: min(78vw,260px,42vh). As margens transparentes do PNG (bounds alpha 49,59–1264,1126) são compensadas apenas no layout, preservando o arquivo; a arte visível alinha com as laterais do botão. Núcleo fica no mesmo eixo. Em telas baixas, toda a coluna reduz e o texto do botão acompanha para não cortar.

- O núcleo inicial, o charge e a explosão usam desde o primeiro frame a paleta ativa do botão. Não há mais substituição pelas cores ColorAtlas na abertura; movimento e bloom continuam seguindo o charge. As cores permanecem contínuas ao iniciar e acompanham a rotação de matiz salva.

- Após 15s de espera, a abertura passa a 30fps, bloom com no máximo três níveis e granulado estático. Logo, botão e paleta mantêm o desenho; Start restaura o perfil escolhido antes do charge. Sem mudanças de qualidade durante a simulação.
- Sessões longas: snapshots com uma única mensagem em trânsito, eventos recentes limitados, cache de cores com 1.024 entradas e corpos limitados ao orçamento normal + quatro vagas de reserva. Fragmentos excedentes permanecem como matéria livre; logs automáticos de FPS desativados.

- Perseguições alternam esforço e recuperação, com curvas suaves de velocidade por organismo. Fuga tem desvios leves; caçadores interceptam adiante do alvo. Arrancadas curtas podem vencer impasses e abrir contato, sem teleporte nem multiplicação de partículas. A escala e o número de patas continuam penalizando velocidade.
