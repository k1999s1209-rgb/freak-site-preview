/**
 * wpp-blank ─ 画面の動きの「骨」だけ。演出そのものは何も入っていない。
 *
 * ★残してあるのは罠対策の型（wpp/themes/wpp-tatsumi/VARIATION.md §1・§5、
 *   wpp/guide/03-build-theme.md §7）。演出を足すときは、この型の中に足す。
 *   1) JS が動いていることを html.js で示す（CSS はこれを見て初めて要素を隠す）
 *   2) 「動きを減らす」設定を尊重する（reduce）
 *   3) 外部ライブラリが無くても壊れない（typeof で確かめてから使う）
 *   4) 6秒たっても現れていない「画面の中の」要素は見せる（ローディング・出現演出の取り残しを防ぐ）
 *      ★ページ全体を一度に見せない：まだ見ていない下の場面の出る動きまで先に終わってしまう（2026-09-28 nine-co の指摘）
 *   5) スマホ用メニューの開閉（ライブラリ非依存）
 * ★実装例（ローディング演出・なめらかスクロール・行の出現・写真の拡大復元・横スクロール）は
 *   wpp/themes/wpp-tatsumi/assets/main.js を参照専用で読む。見た目は写さない。
 */
(function () {
	'use strict';

	var html = document.documentElement;
	html.classList.add('js'); // 1) JS が動いた印。これが無い＝CSSは何も隠さない

	var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; // 2)
	var hasGSAP = typeof gsap !== 'undefined'; // 3) 使うなら wp_enqueue_script してから

	// 4) 罠2対策：6秒たったら、その時「画面に入っている」のに現れていない要素だけを見せる。
	//    以後もスクロールのたびに同じことをする（IntersectionObserver が動かない環境の保険）。
	//    ★ページ全体を一度に見せない（下の場面の出る動きが、見る前に終わってしまう。2026-09-28）
	setTimeout(function () {
		html.classList.add('js-timeout');
		var showInView = function () {
			var vh = innerHeight;
			document.querySelectorAll('.reveal:not(.is-in)').forEach(function (el) {
				var r = el.getBoundingClientRect();
				if (r.top < vh && r.bottom > 0) el.classList.add('is-in');
			});
		};
		showInView();
		addEventListener('scroll', showInView, { passive: true });
	}, 6000);

	/* ---------- 5) スマホ用メニュー ---------- */
	var menuBtn = document.getElementById('menuBtn');
	var mnav = document.getElementById('mnav');
	if (menuBtn && mnav) {
		menuBtn.addEventListener('click', function () {
			var open = mnav.classList.toggle('open');
			menuBtn.classList.toggle('open', open);
			menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		mnav.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', function () {
				mnav.classList.remove('open');
				menuBtn.classList.remove('open');
				menuBtn.setAttribute('aria-expanded', 'false');
			});
		});
	}

	/* ---------- 現れる演出の受け皿（.reveal に is-in を付けるだけ） ----------
	   見た目（どう現れるか）は CSS 側で .reveal / .reveal.is-in に書く。
	   reduce のときは何もしない（CSS 側で最初から見えている）。 */
	if (!reduce && 'IntersectionObserver' in window) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) {
				if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
			});
		}, { threshold: 0.15 });
		document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
	} else {
		document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
	}

	/* ---------- Freak：開いたとき（約 3 秒）----------
	   ①タイムコードが 0.9 秒で 00:00:02:24 まで進む ②四隅の角がファインダーへ縮む（0.9 秒）
	   ③幕が上→下へ通り抜ける（1.8 秒・power1.inOut 相当）④幕が画面を覆った瞬間に下の画面へ切り替え、キャッチが行ごとに出る
	   ★load のあとに始める。6 秒の保険で必ず抜ける。reduce なら何もしない。 */
	var body = document.body;
	var intro = document.getElementById('intro');
	var ready = function () { body.classList.add('is-ready'); };
	var finish = function () { ready(); if (intro) { intro.classList.add('is-open', 'is-gone'); } };
	if (!intro || reduce) {
		finish();
	} else {
		var started = false;
		var timeEl = document.getElementById('introTime');
		var pad = function (n) { return (n < 10 ? '0' : '') + n; };
		var run = function () {
			if (started) return; started = true;
			var t0 = performance.now();
			var tick = function (now) {
				var p = Math.min(1, Math.max(0, (now - t0) / 900));
				var f = Math.round(p * 72); // 72 コマ＝ 3 秒（24fps）
				if (timeEl) timeEl.textContent = '00:00:' + pad(Math.floor(f / 24)) + ':' + pad(f % 24);
				if (p < 1) requestAnimationFrame(tick); else if (timeEl) timeEl.textContent = '00:00:03:00';
			};
			requestAnimationFrame(tick);
			// ② 四隅の角をファインダーの位置へ
			setTimeout(function () {
				var vf = document.getElementById('vf');
				if (!vf) return;
				var r = vf.getBoundingClientRect();
				var W = innerWidth, H = innerHeight, m = 24, s = 44;
				var set = function (sel, x, y) { var c = intro.querySelector(sel); if (c) c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
				set('.c-tl', r.left - m, r.top - m);
				set('.c-tr', r.right - (W - m), r.top - m);
				set('.c-bl', r.left - m, r.bottom - (H - m));
				set('.c-br', r.right - (W - m), r.bottom - (H - m));
			}, 900);
			// ③ 幕
			setTimeout(function () {
				var cur = document.getElementById('introCurtain');
				if (cur) cur.classList.add('is-run');
			}, 1600);
			// ④ 幕が画面を覆った瞬間（1.6 + 0.9 秒）に切り替え
			setTimeout(function () { intro.classList.add('is-open'); ready(); }, 2500);
			setTimeout(function () { intro.classList.add('is-gone'); }, 3500);
		};
		if (document.readyState === 'complete') { setTimeout(run, 150); } else { addEventListener('load', function () { setTimeout(run, 150); }); }
		setTimeout(run, 2500);   // 写真が遅いときも 2.5 秒で始める
		setTimeout(finish, 6500); // 保険
	}

	/* ---------- ヘッダーの線（スクロールしたら下線）---------- */
	var onScroll = function () { body.classList.toggle('is-scrolled', scrollY > 40); };
	addEventListener('scroll', onScroll, { passive: true }); onScroll();

	/* ---------- ファインダーの写真送り（走査線で上から下へ切り替える・6.5 秒ごと。最初は 9 秒後）---------- */
	var shots = [].slice.call(document.querySelectorAll('.vf-shot'));
	var scan = document.querySelector('.vf-scan');
	var noEl = document.getElementById('vfNo');
	var vfTime = document.getElementById('vfTime');
	if (shots.length > 1 && !reduce) {
		var idx = 0;
		var next = function () {
			var prev = shots[idx];
			idx = (idx + 1) % shots.length;
			var cur = shots[idx];
			shots.forEach(function (s) { s.classList.remove('is-prev', 'is-wipe'); });
			prev.classList.remove('is-cur'); prev.classList.add('is-prev');
			void cur.offsetWidth;
			cur.classList.add('is-cur', 'is-wipe');
			if (scan) { scan.style.setProperty('--vfh', scan.parentNode.offsetHeight + 'px'); scan.classList.remove('is-run'); void scan.offsetWidth; scan.classList.add('is-run'); }
			if (noEl) noEl.textContent = String(idx + 1);
			setTimeout(function () { prev.classList.remove('is-prev'); }, 1200);
		};
		setTimeout(function () { next(); setInterval(next, 6500); }, 9000);
	}
	if (vfTime && !reduce) {
		var vt0 = performance.now();
		var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
		setInterval(function () {
			var f = Math.floor((performance.now() - vt0) / 1000 * 24) + 72;
			var sec = Math.floor(f / 24), min = Math.floor(sec / 60);
			vfTime.textContent = '00:' + pad2(min % 60) + ':' + pad2(sec % 60) + ':' + pad2(f % 24);
		}, 1000 / 12);
	}

	/* ---------- 進め方：スクロール量で線が伸びる ---------- */
	var tl = document.getElementById('tl');
	if (tl) {
		var ruler = tl.querySelector('.tl-ruler');
		var upd = function () {
			var r = tl.getBoundingClientRect();
			var p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.55)));
			tl.style.setProperty('--p', reduce ? 1 : p.toFixed(3));
			if (ruler) tl.style.setProperty('--tlw', ruler.offsetWidth + 'px');
		};
		addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
	}

	/* ---------- ここから下に、この案件の演出を足す ----------
	   例）hasGSAP && !reduce のときだけ GSAP の演出を組む。無いときは上の受け皿だけで動く。 */
})();
