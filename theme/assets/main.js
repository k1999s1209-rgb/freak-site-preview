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
		// 2026-11-15：スクロールのたびに位置を測ると引っかかる → 見張り（IntersectionObserver）が無い環境だけ
		if (!('IntersectionObserver' in window)) addEventListener('scroll', showInView, { passive: true });
	}, 6000);

	// 2026-11-15：写真を画面に出す準備（展開）を、スクロールを止めずに裏で行わせる
	[].slice.call(document.images).forEach(function (im) { if (!im.closest('.sec-fv')) im.decoding = 'async'; });

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
			// 2026-11-15：幕が抜ける直前に、最初の画面の写真の展開を裏で済ませておく（抜けた瞬間にまとめて展開して引っかかるのを防ぐ）
			var fvDecode = function () {
				[].slice.call(document.querySelectorAll('.sec-fv img')).forEach(function (im) {
					if (im.decode) im.decode().catch(function () {});
				});
			};
			fvDecode();
			// ④ 幕が画面を覆った瞬間（1.6 + 0.9 秒）に切り替え
			setTimeout(function () { intro.classList.add('is-open'); ready(); }, 2500);
			setTimeout(function () { intro.classList.add('is-gone'); }, 3500);
		};
		if (document.readyState === 'complete') { setTimeout(run, 150); } else { addEventListener('load', function () { setTimeout(run, 150); }); }
		setTimeout(run, 2500);   // 写真が遅いときも 2.5 秒で始める
		setTimeout(finish, 6500); // 保険
	}

	/* ---------- ヘッダーの線（スクロールしたら下線）---------- */
	/* 2026-11-15 依頼者「スクロールし始めがスムーズにならない」：
	   スクロールの合図のたびに位置を測って書く処理が 1 コマに何度も走り、そのたびに画面全体の配置を計算し直していた（実測 1 コマ 16〜33ms）。
	   → スクロール中の仕事は 1 コマに 1 回だけ（frameJobs）。測るのを先、書くのを後にまとめる。 */
	var frameJobs = [], framePending = false;
	var frameRun = function () { framePending = false; for (var i = 0; i < frameJobs.length; i++) frameJobs[i](); };
	var frameAsk = function () { if (!framePending) { framePending = true; requestAnimationFrame(frameRun); } };
	addEventListener('scroll', frameAsk, { passive: true });
	var wasScrolled = null;
	frameJobs.push(function () {
		var on = (window.pageYOffset || 0) > 40;
		if (on !== wasScrolled) { wasScrolled = on; body.classList.toggle('is-scrolled', on); }
	});
	frameRun();

	/* ---------- ファインダーの写真送り（走査線で上から下へ切り替える・6.5 秒ごと。最初は 9 秒後）---------- */
	var shots = [].slice.call(document.querySelectorAll('.vf-shot'));
	var scan = document.querySelector('.vf-scan');
	var noEl = document.getElementById('vfNo');
	var vfTime = document.getElementById('vfTime');
	/* 2026-11-15 依頼者「スクロールし始めがスムーズにならない」：開いて 9 秒後の最初の写真送りが、スクロールし始めと重なって引っかかっていた（実測 1 コマ 240〜330ms）。
	   → ①ファインダーが画面に見えていないときは送らない ②写真は 4 枚とも、開いた直後（幕で隠れている間）に展開と描画を済ませておく（CSS の .vf-img{will-change} と対） */
	var vfSeen = true;
	var vfBox = document.getElementById('vf') || (shots[0] && shots[0].parentNode);
	if (vfBox && 'IntersectionObserver' in window) {
		new IntersectionObserver(function (es) { vfSeen = es[es.length - 1].isIntersecting; }).observe(vfBox);
	}
	var shotImg = function (el) { return el && (el.tagName === 'IMG' ? el : el.querySelector('img')); };
	var shotReady = function (el, done) {
		var im = shotImg(el);
		if (im && im.decode) { im.decode().then(done, done); } else { done(); }
	};
	if (shots.length > 1 && !reduce) {
		var idx = 0;
		shots.forEach(function (el, i) { if (i) shotReady(el, function () {}); }); // 幕で隠れている間に済ませる
		var next = function () {
			if (!vfSeen || document.hidden) return;
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
		// 2026-11-15：見えていないときは書き換えない（書き換えのたびに配置の計算が要るため。vfSeen は上の写真送りと共用）
		setInterval(function () {
			if (!vfSeen || document.hidden) return;
			var f = Math.floor((performance.now() - vt0) / 1000 * 24) + 72;
			var sec = Math.floor(f / 24), min = Math.floor(sec / 60);
			vfTime.textContent = '00:' + pad2(min % 60) + ':' + pad2(sec % 60) + ':' + pad2(f % 24);
		}, 1000 / 12);
	}

	/* ---------- 進め方：スクロール量で線が伸びる ---------- */
	var tl = document.getElementById('tl');
	if (tl) {
		var ruler = tl.querySelector('.tl-ruler');
		// 2026-11-15：線の幅は大きさが変わったときだけ測る。伸び具合は、この場面が画面の近くにあるときだけ、1 コマに 1 回
		var tlNear = !('IntersectionObserver' in window), tlLast = '';
		// 線と先頭の印は、その 2 つだけを直接動かす（場面全体の変数を書き換えると、中の全部の見た目を計算し直すため）
		var tlBar = tl.querySelector('.tl-bar'), tlHead = tl.querySelector('.tl-head'), tlW = 0;
		var tlSize = function () { tlW = ruler ? ruler.offsetWidth : 0; tlLast = ''; };
		var upd = function () {
			if (!tlNear) return;
			var r = tl.getBoundingClientRect();
			var p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.55)));
			var v = reduce ? '1' : p.toFixed(3);
			if (v !== tlLast) {
				tlLast = v;
				if (tlBar) tlBar.style.transform = 'scaleX(' + v + ')';
				if (tlHead) tlHead.style.transform = 'translateX(' + (Number(v) * tlW).toFixed(1) + 'px)';
			}
		};
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(function (es) { tlNear = es[es.length - 1].isIntersecting; if (tlNear) frameAsk(); }, { rootMargin: '60% 0px 60% 0px' }).observe(tl);
		}
		frameJobs.push(upd);
		addEventListener('resize', function () { tlSize(); frameAsk(); });
		addEventListener('load', function () { tlSize(); frameAsk(); });
		tlSize(); tlNear = true; upd(); tlNear = !('IntersectionObserver' in window);
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
	/* フォーム（data-demo）：必須の空欄に印を付ける → 保存先（data-endpoint）があれば送って保存／無ければメールを開く or 案内だけ */
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
			/* 保存先があるとき（2026-11-15）：受付用の表（GAS）へ送って保存する。画面は動かさない */
			var ep = f.getAttribute('data-endpoint');
			if (ep) {
				if (f.getAttribute('data-busy')) return;
				var btn = f.querySelector('button[type="submit"]'), q = new URLSearchParams(), items = [];
				Array.prototype.slice.call(f.querySelectorAll('input, textarea')).forEach(function (el) {
					if (!el.name) return;
					if (el.type === 'checkbox') { if (el.checked) items.push(el.value); return; }
					if (el.type === 'radio') { if (el.checked) q.set(el.name, el.value); return; }
					q.set(el.name, el.value.trim());
				});
				q.set('items', items.join('、'));
				q.set('form', f.getAttribute('data-form') || '');
				q.set('page', location.origin + location.pathname);
				var say = function (t) { if (note) { note.classList.add('is-on'); note.textContent = t; } };
				var fail = function () { say('送信できませんでした。時間をおいてもう一度お試しいただくか、お電話でご連絡ください。'); };
				f.setAttribute('data-busy', '1'); if (btn) btn.disabled = true;
				say('送信しています…');
				fetch(ep, { method: 'POST', body: q })
					.then(function (r) { return r.json(); })
					.then(function (d) {
						if (d && d.ok) { f.reset(); f.classList.add('is-sent'); say('送信しました。ありがとうございます。担当者から折り返しご連絡します。'); }
						else if (d && d.error === 'required') { say('必須の項目を入力してください。'); }
						else { fail(); }
					})
					.catch(fail)
					.then(function () { f.removeAttribute('data-busy'); if (btn) btn.disabled = false; });
				return;
			}
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

/* 2026-11-17 絹の帯：最初の画面が見えていない間は流れを止める（見えない所で動かし続けない） */
(function () {
	var silk = document.querySelector('.fv-silk');
	if (!silk || !('IntersectionObserver' in window)) return;
	new IntersectionObserver(function (es) { silk.classList.toggle('is-off', !es[0].isIntersecting); }).observe(silk);
})();

/* 2026-11-17 事業内容の黒い背景＝光の点（E案）。26px おきの小さな四角で、明るさ＝ゆっくり動く波の重ね合わせ。いちばん明るい所だけ朱。
   場面が見えている間だけ描く（1 秒に 25 コマ）。動きを減らす設定の端末では止まった絵を 1 回だけ描く */
(function () {
	var sec = document.querySelector('.sec-service'), cv = sec && sec.querySelector('.svdots');
	if (!cv) return;
	var ctx = cv.getContext('2d'), W = 0, H = 0, raf = 0, last = 0, visible = !('IntersectionObserver' in window);
	var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	function size() { var d = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
	function draw(now) {
		raf = 0;
		if (!visible) return;
		if (!W || now - last > 40) {
			last = now;
			if (!W) size();
			var t = still ? 3 : now / 1000, g = W < 700 ? 20 : 26, k = W < 700 ? 0.5 : 1, x, y, v, r; // k＝スマホは文字の真後ろに来るので明るさを半分に
			ctx.clearRect(0, 0, W, H);
			for (y = g / 2; y < H; y += g) {
				for (x = g / 2; x < W; x += g) {
					v = Math.sin(x * 0.011 + t * 0.9) * Math.sin(y * 0.015 - t * 0.6) + Math.sin((x + y) * 0.006 + t * 0.45) + 0.6 * Math.sin((x - y) * 0.009 - t * 0.7);
					v = (v + 2.6) / 5.2; // 0〜1
					v = v * v * v;
					ctx.fillStyle = v > 0.62 ? 'rgba(255,75,31,' + (Math.min(0.85, v + 0.1) * k).toFixed(2) + ')' : 'rgba(237,235,230,' + ((0.07 + v * 0.9) * k).toFixed(2) + ')';
					r = 1.4 + v * 2.2 * k;
					ctx.fillRect(x - r, y - r, r * 2, r * 2);
				}
			}
		}
		if (!still) raf = requestAnimationFrame(draw);
	}
	function kick() { if (!raf) raf = requestAnimationFrame(draw); }
	window.addEventListener('resize', function () { W = 0; kick(); });
	if (visible) { kick(); return; }
	new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(sec);
})();

/* 2026-11-18 iPhone（Safari）で文章が言葉の途中で折れる対策。
   CSS の「文節で折る」指定（word-break:auto-phrase）は Chrome 系だけ。効かないブラウザでは、文を言葉のまとまり
   （漢字・カタカナ・英数で始まり、続くひらがな・記号までを 1 つ）に分け、まとまりの中では折らないようにする。
   12 文字以上の日本語の文だけが対象。まとまりは最長 14 文字（長すぎると狭い画面ではみ出すため） */
(function () {
	if (window.CSS && CSS.supports && CSS.supports('word-break', 'auto-phrase')) return;
	if (!window.Intl || !Intl.Segmenter) return;
	var seg = new Intl.Segmenter('ja', { granularity: 'word' });
	var KANJI = /[一-鿿]/, JA = /[぀-ヿ一-鿿]/, HEAD = /^[゠-ヿ一-鿿A-Za-z0-9０-９Ａ-Ｚａ-ｚ「『（]/, SPACE = /^\s+$/, OPEN = /[「『（]$/;
	function chunks(text) {
		var out = [], cur = '';
		var it = seg.segment(text)[Symbol.iterator](), s;
		while (!(s = it.next()).done) {
			var t = s.value.segment;
			if (SPACE.test(t)) { if (cur) out.push(cur); out.push(t); cur = ''; continue; }
			var startsNew = HEAD.test(t) && t.charAt(0) !== '・' && t.charAt(0) !== 'ー' && cur && !OPEN.test(cur);
			/* 2026-11-28 「担当／者」「企業／連携」のように漢字の言葉の途中で折れないよう、漢字が続く間は 1 つにまとめる（8 文字まで） */
			if (startsNew && KANJI.test(cur.slice(-1)) && KANJI.test(t.charAt(0)) && cur.length + t.length <= 8) startsNew = false;
			/* 2026-11-28 「ご／相談」「お／気軽に」のように頭の「お・ご」だけ前の行に残らないよう、次の言葉の側に付ける */
			if (startsNew && KANJI.test(t.charAt(0)) && /(^|[ぁ-ん、。・])[おご]$/.test(cur)) { if (cur.length > 1) out.push(cur.slice(0, -1)); cur = cur.slice(-1) + t; continue; }
			if (startsNew || (cur.length + t.length > 14 && !/^[、。・」』）！？]/.test(t))) { if (cur) out.push(cur); cur = t; } else { cur += t; }
		}
		if (cur) out.push(cur);
		return out;
	}
	var nodes = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
	while ((n = w.nextNode())) {
		var p = n.parentElement;
		if (!p || !p.closest('h1,h2,h3,p,dd,dt,li,small,.ct-go-title,.ct-go-lead') || p.closest('script,style,.np,[aria-hidden="true"],button,input,textarea,select,label')) continue;
		if (n.nodeValue.trim().length < (p.closest('.ct-go-title,.ct-go-lead') ? 6 : 12) || !JA.test(n.nodeValue)) continue;
		if (/flex|grid/.test(getComputedStyle(p).display)) continue; // 横並びの箱の直下の文字は包まない（包むと 1 つずつ並んで折り返さなくなる）
		nodes.push(n);
	}
	nodes.forEach(function (node) {
		var f = document.createDocumentFragment();
		chunks(node.nodeValue).forEach(function (c) {
			if (SPACE.test(c) || c.length < 2) { f.appendChild(document.createTextNode(c)); return; }
			var sp = document.createElement('span'); sp.className = 'np'; sp.textContent = c; f.appendChild(sp);
		});
		node.parentNode.replaceChild(f, node);
	});
})();
/* 2026-11-27 事業内容のカードが画面より縦に長いと、止まった時に下の行（タグ）が画面の外に残り、次のカードに隠れる。
   → 長いカードだけ、下の端が画面の下に来た所で止める（止まる位置を上へずらす）。画面に収まるカードは今まで通り。
   スクロール中は何もしない（読み込み・画面の大きさが変わった時だけ測る）。 */
(function () {
	var cards = document.querySelectorAll('.sv-card');
	if (!cards.length) return;
	var fit = function () {
		var vh = window.innerHeight, i, c, base, h;
		for (i = 0; i < cards.length; i++) cards[i].style.top = '';
		for (i = 0; i < cards.length; i++) {
			c = cards[i];
			if (getComputedStyle(c).position !== 'sticky') continue;
			base = parseFloat(getComputedStyle(c).top) || 0;
			h = c.offsetHeight;
			if (base + h > vh - 8) c.style.top = Math.round(vh - h - 8) + 'px';
		}
	};
	var t; var ask = function () { clearTimeout(t); t = setTimeout(fit, 120); };
	window.addEventListener('load', fit);
	window.addEventListener('resize', ask);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
	fit();
})();
