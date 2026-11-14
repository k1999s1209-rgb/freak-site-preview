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
				// スマホではファインダーが画面の下にある → 同じ大きさの枠を画面の真ん中に置いて寄せる（角と文字が画面の外へ出ないように）
				if (r.top < m || r.bottom > H - m) {
					var t = Math.max(m, (H - r.height) / 2);
					r = { left: r.left, right: r.right, top: t, bottom: t + Math.min(r.height, H - m * 2) };
				}
				var set = function (sel, x, y) { var c = intro.querySelector(sel); if (c) c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
				set('.c-tl', r.left - m, r.top - m);
				set('.c-tr', r.right - (W - m), r.top - m);
				set('.c-bl', r.left - m, r.bottom - (H - m));
				set('.c-br', r.right - (W - m), r.bottom - (H - m));
				// 時刻の文字も角と一緒にファインダーの真ん中へ（2026-11-14 依頼者「文字の位置と寄ってくる位置がずれている」）
				var tc = intro.querySelector('.intro-tc');
				if (tc) tc.style.transform = 'translate(calc(-50% + ' + ((r.left + r.right) / 2 - W / 2) + 'px), calc(-50% + ' + ((r.top + r.bottom) / 2 - H / 2) + 'px))';
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

	/* ---------- お問い合わせ：フォーム 2 種の切り替え（2026-11-14） ---------- */
	var ctTabs = Array.prototype.slice.call(document.querySelectorAll('.ct-tab'));
	if (ctTabs.length) {
		var ctShow = function (tab, focus) {
			ctTabs.forEach(function (t) {
				var on = t === tab;
				t.setAttribute('aria-selected', on ? 'true' : 'false');
				t.tabIndex = on ? 0 : -1;
				var pn = document.getElementById(t.getAttribute('aria-controls'));
				if (pn) pn.hidden = !on;
			});
			if (focus) tab.focus();
		};
		ctTabs.forEach(function (t, i) {
			t.addEventListener('click', function () { ctShow(t); });
			t.addEventListener('keydown', function (e) {
				if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
					e.preventDefault();
					ctShow(ctTabs[(i + (e.key === 'ArrowRight' ? 1 : ctTabs.length - 1)) % ctTabs.length], true);
				}
			});
		});
	}
	/* 試作のフォーム（data-demo）は送信せず、必須の空欄に印を付けて案内だけ出す */
	Array.prototype.slice.call(document.querySelectorAll('form.ct-fields[data-demo]')).forEach(function (f) {
		f.addEventListener('submit', function (e) {
			e.preventDefault();
			var ng = null;
			Array.prototype.slice.call(f.querySelectorAll('[required]')).forEach(function (el) {
				var bad = !el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()));
				el.classList.toggle('is-ng', bad);
				if (bad && !ng) ng = el;
			});
			var note = f.querySelector('.ct-note');
			if (ng) { ng.focus(); if (note) { note.classList.add('is-on'); note.textContent = '必須の項目を入力してください。'; } return; }
			var to = f.getAttribute('data-to');
			if (!to) { if (note) { note.classList.add('is-on'); note.textContent = '試作のため、まだ送信されません（本番では担当者に届きます）。'; } return; }
			/* 届け先があるとき：入力内容を本文にしたメールの下書きを開く */
			var lines = [], seen = {};
			Array.prototype.slice.call(f.querySelectorAll('input, textarea')).forEach(function (el) {
				var nm = el.name; if (!nm || seen[nm]) return;
				var box = el.closest('fieldset'), lb = box ? box.querySelector('legend') : el.closest('label').querySelector('.ct-lb');
				var head = lb ? lb.textContent.replace('必須', '').trim() : nm, val;
				if (el.type === 'checkbox' || el.type === 'radio') {
					seen[nm] = 1;
					val = Array.prototype.slice.call(f.querySelectorAll('[name="' + nm + '"]:checked')).map(function (c) { return c.value; }).join('、');
				} else { val = el.value.trim(); }
				lines.push('■' + head + '\n' + (val || '（未入力）'));
			});
			location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(f.getAttribute('data-subject') || 'ホームページからのお問い合わせ') + '&body=' + encodeURIComponent(lines.join('\n\n'));
			if (note) { note.classList.add('is-on'); note.textContent = 'メールが開きました。内容を確かめて、そのまま送信してください。'; }
		});
	});

	/* ---------- ここから下に、この案件の演出を足す ----------
	   例）hasGSAP && !reduce のときだけ GSAP の演出を組む。無いときは上の受け皿だけで動く。 */
})();
