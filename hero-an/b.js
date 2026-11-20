// B案：音の波（白い縦の棒）と FM の目盛り。針は指・マウスについてくる。触っていない間はゆっくり行き来する
(function () {
	var cv = document.getElementById('wave'), freq = document.getElementById('freq');
	if (!cv) return;
	var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, px = null, needle = 0.3, t0 = performance.now();
	var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
	function draw(now) {
		var t = still ? 4 : (now - t0) / 1000, gap = W < 700 ? 9 : 13, n = Math.floor(W / gap), dial = 46, top = H - dial;
		var target = px === null ? 0.5 + 0.34 * Math.sin(t * 0.35) : px / W;
		needle += (target - needle) * (still ? 1 : 0.08);
		ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fff';
		for (var i = 0; i <= n; i++) {
			var x = i * gap + (W - n * gap) / 2, u = i / n;
			var v = 0.5 + 0.5 * Math.sin(i * 0.33 + t * 1.6) * Math.sin(i * 0.071 - t * 0.9) + 0.25 * Math.sin(i * 1.7 + t * 3.1);
			var near = Math.exp(-Math.pow((u - needle) * 7, 2));
			var h = Math.max(3, (0.1 + 0.3 * Math.abs(v) + 0.62 * near * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.9 + t * 5)))) * (top - 10));
			ctx.globalAlpha = 0.34 + 0.66 * near;
			ctx.fillRect(x - 1.5, top - h, 3, h);
			ctx.globalAlpha = 1;
			ctx.fillRect(x - 0.5, top + 8, 1, i % 5 === 0 ? 12 : 6);
		}
		ctx.font = '600 11px "Inter Tight", sans-serif'; ctx.textAlign = 'center';
		var step = W < 700 ? 4 : 2;
		for (var f = 76; f <= 94; f += step) { ctx.fillText(String(f), (f - 76) / 18 * (W - 80) + 40, top + 38); }
		var nx = needle * W;
		ctx.fillRect(nx - 1, 0, 2, H);
		if (freq) freq.textContent = (76 + needle * 18).toFixed(1) + ' MHz';
		if (!still) requestAnimationFrame(draw);
	}
	function move(e) { var r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; px = Math.min(Math.max(p.clientX - r.left, 0), W); }
	window.addEventListener('mousemove', move, { passive: true });
	window.addEventListener('touchmove', move, { passive: true });
	document.addEventListener('mouseleave', function () { px = null; });
	window.addEventListener('resize', function () { size(); if (still) draw(0); });
	size(); requestAnimationFrame(draw);
})();
