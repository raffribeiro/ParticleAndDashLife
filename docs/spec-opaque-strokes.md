---
title: Traços com preenchimento opaco
type: fix
created: 2026-10-23
status: done
route: one-shot
---
# Traços com preenchimento opaco

## Intent
**Problem:** Energia, humor e nascimento ainda reduziam o alpha do corpo dos traços.
**Approach:** Material sólido usa alpha 1 no interior, com cobertura suave somente na borda. O halo continua separado. Inclui traços livres e anatomia de criaturas.

## Suggested Review Order
- [Material e geometria](../dist/creature-mesh.js): shader e strips opacos.
- [Verificação](../tests/stroke-opacity.test.js): variações de estado e alpha do shader.

Validation: 190 tests passed; local WebGL visual inspection without console errors; independent review found no introduced bugs.
