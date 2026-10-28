// 🧮 MATHS « EXACTES » (pour les parties en ligne)
// En ligne, chaque navigateur calcule la même partie de son côté (voir net.js) : il faut donc que tous trouvent
// EXACTEMENT les mêmes nombres. Les additions, multiplications, divisions et racines carrées donnent partout le même
// résultat (c'est une règle des ordinateurs : la norme IEEE 754) ; mais Math.sin, Math.cos, Math.atan2, Math.pow,
// Math.exp, Math.log ou Math.hypot peuvent différer d'un navigateur à l'autre, au tout dernier chiffre près. Assez
// pour que, des milliers de tours plus tard, les deux parties ne se ressemblent plus !
// DMath les recalcule avec seulement des additions et des multiplications : le même résultat partout.
// (règle à suivre dans game.js, ai.js et la génération des cartes : DMath.sin, jamais Math.sin ; Game.rand(),
//  jamais Math.random : le hasard d'une partie vient de sa graine, voir mulberry32 dans map.js)

const DMath = {
  PI: 3.141592653589793,

  // Sinus et cosinus : on ramène l'angle entre -π/4 et π/4, puis un polynôme (assez précis pour le jeu : 1e-15)
  sin(x) { return this.sincos(x, 0); },
  cos(x) { return this.sincos(x, 1); },
  sincos(x, shift) {
    if (!isFinite(x)) return NaN;
    const k = Math.round(x / (this.PI / 2)); // (le quart de tour le plus proche)
    // (x − k·π/2, en deux morceaux pour garder la précision : π/2 = A + B)
    const r = (x - k * 1.5707963267341256) - k * 6.077100506506192e-11;
    const q = (((k + shift) % 4) + 4) % 4, r2 = r * r;
    const s = r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 / 6227020800))))));
    const c = 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320 + r2 * (-1 / 3628800 + r2 / 479001600)))));
    return q === 0 ? s : q === 1 ? c : q === 2 ? -s : -c;
  },

  // Arc tangente (atan2(y, x) : l'angle du point (x, y), entre -π et π)
  atan(x) {
    if (x < 0) return -this.atan(-x);
    if (x > 1) return this.PI / 2 - this.atan(1 / x);
    // (au-delà de tan(π/12), on se ramène plus près de 0 : atan(x) = π/6 + atan((x − t) / (1 + x·t)), t = 1/√3)
    let off = 0;
    if (x > 0.2679491924311227) { const t = 0.5773502691896257; x = (x - t) / (1 + x * t); off = this.PI / 6; }
    const x2 = x * x;
    let sum = 0;
    for (let n = 19; n >= 0; n--) sum = sum * -x2 + 1 / (2 * n + 1);
    return off + x * sum;
  },
  atan2(y, x) {
    if (x > 0) return this.atan(y / x);
    if (x < 0) return y >= 0 ? this.atan(y / x) + this.PI : this.atan(y / x) - this.PI;
    return y > 0 ? this.PI / 2 : y < 0 ? -this.PI / 2 : 0;
  },

  // Longueur de l'hypoténuse : √(a² + b²) (la racine carrée, elle, est la même partout)
  hypot(a, b) { return Math.sqrt(a * a + b * b); },

  // Exponentielle et logarithme : on se ramène à un petit nombre (en multipliant ou divisant par 2, ce qui est exact)
  exp(x) {
    if (x > 700) return Infinity;
    if (x < -700) return 0;
    const LN2 = 0.6931471805599453, k = Math.round(x / LN2), r = x - k * LN2;
    let term = 1, sum = 1;
    for (let n = 1; n < 22; n++) { term = term * r / n; sum += term; }
    let p = 1;
    for (let i = 0; i < Math.abs(k); i++) p *= 2;
    return k >= 0 ? sum * p : sum / p;
  },
  log(x) {
    if (!(x > 0)) return x === 0 ? -Infinity : NaN;
    let k = 0;
    while (x >= 2) { x /= 2; k++; }
    while (x < 1) { x *= 2; k--; }
    // (ln x = 2·atanh((x − 1)/(x + 1)), pour x entre 1 et 2)
    const z = (x - 1) / (x + 1), z2 = z * z;
    let term = z, sum = 0;
    for (let n = 1; n < 60; n += 2) { sum += term / n; term *= z2; }
    return 2 * sum + k * 0.6931471805599453;
  },
  // Puissance : un exposant entier se calcule par multiplications ; sinon exp(y · ln x)
  pow(x, y) {
    if (y === Math.floor(y) && Math.abs(y) < 1e6) {
      let r = 1, b = x, n = Math.abs(y);
      while (n > 0) { if (n & 1) r *= b; b *= b; n = Math.floor(n / 2); }
      return y < 0 ? 1 / r : r;
    }
    if (x === 0) return 0;
    return this.exp(y * this.log(x));
  },
};
