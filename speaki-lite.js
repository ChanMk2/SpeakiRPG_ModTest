/*
 * SpeakiLite — slim mobile mod for Speaki RPG (Android WebView client)
 *
 * Features: custom emoji chat, local-model chat translation, EXP tracker,
 *           FPS / ping counter, optional WebGL MSAA disable (flicker workaround).
 *
 * This is a re-implementation of a small subset of SpeakiMod+
 * (https://github.com/DJTOMATO/SpeakiRPG, GPL-3.0), which itself derives from
 * SpeakiMod by Alluseri (BSD-3-Clause, https://github.com/Alluseri/SpeakiMod).
 * Licensed under GPL-3.0-or-later. See LICENSE.
 *
 * Runs as a WebView "document start" script, i.e. BEFORE the game's own code. Nothing is downloaded at runtime except
 * the emoji catalogs (emojis*.txt). The game state (window.gameState) is exposed by the bundled injector.js.
 */
(() => {
	'use strict';
	if (window.__speakiLite) return;
	window.__speakiLite = { version: '0.1.0' };

	const VERSION = '0.1.0';

	// ------------------------------------------------------------------
	// Storage
	// ------------------------------------------------------------------
	const LS = {
		get(key, def) {
			try { const v = localStorage.getItem('spkl-' + key); return v === null ? def : v; } catch (_) { return def; }
		},
		set(key, val) { try { localStorage.setItem('spkl-' + key, String(val)); } catch (_) { /* ignore */ } },
		getJSON(key, def) {
			try { const v = localStorage.getItem('spkl-' + key); return v === null ? def : JSON.parse(v); } catch (_) { return def; }
		},
		setJSON(key, val) { try { localStorage.setItem('spkl-' + key, JSON.stringify(val)); } catch (_) { /* ignore */ } },
	};

	const EXP_WINDOWS = [1, 5, 10, 15, 30, 60];
	const TRANSLATE_TARGETS = [
		['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'],
		['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['ru', 'Русский'],
	];

	function defaultTarget() {
		const l = (navigator.language || 'ko').toLowerCase();
		if (l.startsWith('zh')) return 'zh-CN';
		const base = l.split('-')[0];
		return TRANSLATE_TARGETS.some(([c]) => c === base) ? base : 'ko';
	}

	const cfg = {
		aaOff: LS.get('aa-off', '1') === '1',
		fpsPing: LS.get('fps-ping', '1') === '1',
		exp: LS.get('exp', '1') === '1',
		expPerHour: LS.get('exp-hour', '0') === '1',
		expWindow: (() => { const n = parseInt(LS.get('exp-window', '1'), 10); return EXP_WINDOWS.includes(n) ? n : 1; })(),
		translate: LS.get('tr', '0') === '1',
		trTarget: LS.get('tr-target', defaultTarget()),
		uiScale: (() => { const v = parseFloat(LS.get('ui-scale', '1')); return v >= 0.7 && v <= 1.6 ? v : 1; })(),
		emojiSize: (() => { const n = parseInt(LS.get('emoji-size', '36'), 10); return n >= 20 && n <= 80 ? n : 36; })(),
	};

	// ------------------------------------------------------------------
	// i18n (ko / en / ja / zh-CN / zh-TW / es) - switchable at runtime
	// ------------------------------------------------------------------
	const UI_LANGS = [['auto', 'Auto'], ['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['es', 'Español']];
	const STR = {
		en: {
			settings: '⚙ SpeakiLite settings', close: 'Close', uiLang: 'Language', uiScale: 'UI size',
			secDisplay: 'Display', fpsPing: 'Show FPS / ping', expTracker: 'EXP tracker',
			expPerHour: 'Show per hour (off = per minute)', expWindow: 'Averaging window (min)', expReset: 'Reset EXP tracker',
			secTranslate: 'Chat translation (on-device model)', trAuto: 'Auto-translate chat', trTarget: 'Translate into',
			trHint: 'Even with auto-translate off, tapping a chat line translates just that line. A language model is downloaded once on first use.',
			secBlock: 'Blocked users', blockHide: 'Hide blocked users\' characters & voices',
			blockHint: 'Uses the block list from the game. Hides their character, emotes, voice, chat bubbles and hearts.',
			secGraphics: 'Graphics', resolution: 'Resolution override', resolutionOff: 'Off',
			resolutionHint: 'Applies instantly. Only works in the mobile layout.',
			aaOff: 'Disable anti-aliasing (stops floor flicker)', aaHint: 'Needs a reload to take effect.', applyReload: 'Reload to apply',
			secDiag: 'Diagnostics', glRefresh: 'Refresh',
			expMin: '{0} EXP/min', expHour: '{0} EXP/hour', expMeasuring: 'Measuring EXP…',
			nextMin: 'Lv.{0} · next in ~{1}m', nextHour: 'Lv.{0} · next in ~{1}h', nextNA: 'Lv.{0} · next -',
			trDownloading: 'Downloading translation model… (first time only)', trReady: 'Translation model ready',
			trNoBridge: 'On-device translation is not available in this app', trFail: 'Translation failed', trNothing: 'Nothing to translate',
			glNone: '(no WebGL context yet)',
			emojiTabStandard: "Standard",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "No favorite emojis yet. Right-click an emoji to add it!",
			emojiWarning: "Remember you can submit emoji images in our Support Discord Server!\nOnly other Mod users will be able to see your custom emojis! So use at ease!",
			emojiWarningFav: "You can add/remove emotes in this list using the right click mouse button on any emoji",
			emojiSizeIncreaseTooltip: "Increase emoji size (+)",
			emojiSizeDecreaseTooltip: "Decrease emoji size (−)",
			emojiFavAdded: "Added {0} to favorites.",
			emojiFavRemoved: "Removed {0} from favorites.",
			emojiTitle: "Emoji",
		},
		ko: {
			settings: '⚙ SpeakiLite 설정', close: '닫기', uiLang: '언어', uiScale: 'UI 크기',
			secDisplay: '표시', fpsPing: 'FPS / 핑 표시', expTracker: '경험치 추적',
			expPerHour: '시간당으로 표시 (끄면 분당)', expWindow: '평균 구간(분)', expReset: '경험치 추적 초기화',
			secTranslate: '채팅 번역 (기기 내 모델)', trAuto: '채팅 자동 번역', trTarget: '번역할 언어',
			trHint: '자동 번역이 꺼져 있어도 채팅 줄을 탭하면 그 줄만 번역됩니다. 처음 쓰는 언어는 모델을 한 번 내려받습니다.',
			secBlock: '차단한 유저', blockHide: '차단한 유저의 캐릭터·보이스 숨기기',
			blockHint: '게임의 차단 목록을 사용합니다. 캐릭터, 이모트, 보이스, 말풍선, 하트를 숨깁니다.',
			secGraphics: '그래픽', resolution: '해상도 오버라이드', resolutionOff: '끔',
			resolutionHint: '즉시 적용됩니다. 모바일 레이아웃에서만 동작합니다.',
			aaOff: '안티앨리어싱 끄기 (바닥 깜빡임 방지)', aaHint: '적용하려면 새로고침이 필요합니다.', applyReload: '새로고침',
			secDiag: '진단', glRefresh: '새로고침',
			expMin: '{0} EXP/분', expHour: '{0} EXP/시간', expMeasuring: 'EXP 측정 중…',
			nextMin: 'Lv.{0} · 다음까지 ~{1}분', nextHour: 'Lv.{0} · 다음까지 ~{1}시간', nextNA: 'Lv.{0} · 다음까지 -',
			trDownloading: '번역 모델을 내려받는 중… (처음 한 번만)', trReady: '번역 모델 준비 완료',
			trNoBridge: '이 앱에서는 기기 내 번역을 쓸 수 없습니다', trFail: '번역하지 못했습니다', trNothing: '번역할 내용이 없습니다',
			glNone: '(아직 WebGL 컨텍스트 없음)',
			emojiTabStandard: "기본",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "아직 즐겨찾는 이모지가 없습니다. 이모지를 우클릭하여 추가해보세요!",
			emojiWarning: "지원 디스코드 서버에서 이모지 이미지를 제출할 수 있다는 것을 잊지 마세요!\n커스텀 이모티콘은 모드 사용자에게만 표시되니 안심하고 사용하세요!",
			emojiWarningFav: "아무 이모지나 우클릭하여 이 목록에 즐겨찾기를 추가하거나 제거할 수 있습니다",
			emojiSizeIncreaseTooltip: "이모지 크기 확대 (+)",
			emojiSizeDecreaseTooltip: "이모지 크기 축소 (−)",
			emojiFavAdded: "{0}을(를) 즐겨찾기에 추가했습니다.",
			emojiFavRemoved: "{0}을(를) 즐겨찾기에서 제거했습니다.",
			emojiTitle: "이모지",
		},
		ja: {
			settings: '⚙ SpeakiLite 設定', close: '閉じる', uiLang: '言語', uiScale: 'UIサイズ',
			secDisplay: '表示', fpsPing: 'FPS / Ping を表示', expTracker: '経験値トラッカー',
			expPerHour: '1時間あたりで表示（オフで1分あたり）', expWindow: '平均する期間（分）', expReset: '経験値トラッカーをリセット',
			secTranslate: 'チャット翻訳（端末内モデル）', trAuto: 'チャットを自動翻訳', trTarget: '翻訳先の言語',
			trHint: '自動翻訳がオフでも、チャット行をタップするとその行だけ翻訳されます。初めて使う言語はモデルを一度ダウンロードします。',
			secBlock: 'ブロックしたユーザー', blockHide: 'ブロックしたユーザーのキャラとボイスを隠す',
			blockHint: 'ゲームのブロックリストを使用します。キャラ、エモート、ボイス、吹き出し、ハートを非表示にします。',
			secGraphics: 'グラフィック', resolution: '解像度オーバーライド', resolutionOff: 'オフ',
			resolutionHint: '即時反映されます。モバイルレイアウトでのみ動作します。',
			aaOff: 'アンチエイリアスを無効化（床のちらつき対策）', aaHint: '反映には再読み込みが必要です。', applyReload: '再読み込み',
			secDiag: '診断', glRefresh: '更新',
			expMin: '{0} EXP/分', expHour: '{0} EXP/時間', expMeasuring: 'EXP 計測中…',
			nextMin: 'Lv.{0} · 次まで約{1}分', nextHour: 'Lv.{0} · 次まで約{1}時間', nextNA: 'Lv.{0} · 次まで -',
			trDownloading: '翻訳モデルをダウンロード中…（初回のみ）', trReady: '翻訳モデルの準備ができました',
			trNoBridge: 'このアプリでは端末内翻訳を利用できません', trFail: '翻訳に失敗しました', trNothing: '翻訳する内容がありません',
			glNone: '（WebGL コンテキストはまだありません）',
			emojiTabStandard: "標準",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "お気に入りの絵文字はまだありません。絵文字を右クリックして追加してください！",
			emojiWarning: "サポートDiscordサーバーで絵文字の画像を投稿できることをお忘れなく！\nカスタム絵文字のみのチャットはMODを使用しているプレイヤーにしか表示されませんのでお気を付けください！",
			emojiWarningFav: "任意の絵文字を右クリックして、このリストからお気に入りを追加/削除できます",
			emojiSizeIncreaseTooltip: "絵文字サイズ拡大 (+)",
			emojiSizeDecreaseTooltip: "絵文字サイズ縮小 (−)",
			emojiFavAdded: "{0} をお気に入りに追加しました。",
			emojiFavRemoved: "{0} をお気に入りから削除しました。",
			emojiTitle: "絵文字",
		},
		'zh-CN': {
			settings: '⚙ SpeakiLite 设置', close: '关闭', uiLang: '语言', uiScale: '界面大小',
			secDisplay: '显示', fpsPing: '显示 FPS / 延迟', expTracker: '经验追踪',
			expPerHour: '按小时显示（关闭则按分钟）', expWindow: '平均区间（分钟）', expReset: '重置经验追踪',
			secTranslate: '聊天翻译（本机模型）', trAuto: '自动翻译聊天', trTarget: '翻译成',
			trHint: '即使关闭自动翻译，点按聊天行也会只翻译那一行。首次使用某种语言时会下载一次模型。',
			secBlock: '已屏蔽的用户', blockHide: '隐藏已屏蔽用户的角色和语音',
			blockHint: '使用游戏内的屏蔽列表。会隐藏其角色、表情动作、语音、聊天气泡和爱心。',
			secGraphics: '图形', resolution: '分辨率覆盖', resolutionOff: '关闭',
			resolutionHint: '立即生效。仅在移动布局下有效。',
			aaOff: '关闭抗锯齿（防止地面闪烁）', aaHint: '需要重新加载才能生效。', applyReload: '重新加载',
			secDiag: '诊断', glRefresh: '刷新',
			expMin: '{0} EXP/分钟', expHour: '{0} EXP/小时', expMeasuring: '正在测量 EXP…',
			nextMin: 'Lv.{0} · 约{1}分钟后升级', nextHour: 'Lv.{0} · 约{1}小时后升级', nextNA: 'Lv.{0} · 升级 -',
			trDownloading: '正在下载翻译模型…（仅首次）', trReady: '翻译模型已就绪',
			trNoBridge: '此应用不支持本机翻译', trFail: '翻译失败', trNothing: '没有可翻译的内容',
			glNone: '（尚无 WebGL 上下文）',
			emojiTabStandard: "Standard",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "暂无收藏的表情。右键点击表情即可添加！",
			emojiWarning: "请记得您可以在我们的支持 Discord 服务器中提交表情符号图片！\n只有其他 MOD 用户才能看到您的自定义表情符号！请放心使用！",
			emojiWarningFav: "您可以对任意表情点击鼠标右键，在此列表中添加/移除表情",
			emojiSizeIncreaseTooltip: "放大表情符号 (+)",
			emojiSizeDecreaseTooltip: "缩小表情符号 (−)",
			emojiFavAdded: "已将 {0} 添加到收藏。",
			emojiFavRemoved: "已将 {0} 从收藏移除。",
			emojiTitle: "表情",
		},
		'zh-TW': {
			settings: '⚙ SpeakiLite 設定', close: '關閉', uiLang: '語言', uiScale: '介面大小',
			secDisplay: '顯示', fpsPing: '顯示 FPS / 延遲', expTracker: '經驗追蹤',
			expPerHour: '以小時顯示（關閉則以分鐘）', expWindow: '平均區間（分鐘）', expReset: '重設經驗追蹤',
			secTranslate: '聊天翻譯（本機模型）', trAuto: '自動翻譯聊天', trTarget: '翻譯成',
			trHint: '即使關閉自動翻譯，點按聊天行也會只翻譯那一行。首次使用某種語言時會下載一次模型。',
			secBlock: '已封鎖的使用者', blockHide: '隱藏已封鎖使用者的角色與語音',
			blockHint: '使用遊戲內的封鎖清單。會隱藏其角色、表情動作、語音、聊天泡泡與愛心。',
			secGraphics: '圖形', resolution: '解析度覆寫', resolutionOff: '關閉',
			resolutionHint: '立即生效。僅在行動版版面下有效。',
			aaOff: '關閉抗鋸齒（避免地面閃爍）', aaHint: '需要重新載入才會生效。', applyReload: '重新載入',
			secDiag: '診斷', glRefresh: '重新整理',
			expMin: '{0} EXP/分鐘', expHour: '{0} EXP/小時', expMeasuring: '正在測量 EXP…',
			nextMin: 'Lv.{0} · 約{1}分鐘後升級', nextHour: 'Lv.{0} · 約{1}小時後升級', nextNA: 'Lv.{0} · 升級 -',
			trDownloading: '正在下載翻譯模型…（僅首次）', trReady: '翻譯模型已就緒',
			trNoBridge: '此應用程式不支援本機翻譯', trFail: '翻譯失敗', trNothing: '沒有可翻譯的內容',
			glNone: '（尚無 WebGL 內容）',
			emojiTabStandard: "Standard",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "尚無最愛表情符號。右鍵點擊表情符號即可加入！",
			emojiWarning: "請記得您可以在我們的支援 Discord 伺服器中提交表情符號圖片！\n只有其他 MOD 使用者才能看到您的自訂表情符號！請安心使用！",
			emojiWarningFav: "您可以對任何表情符號點擊滑鼠右鍵，在此清單中新增/移除表情",
			emojiSizeIncreaseTooltip: "放大表情符號 (+)",
			emojiSizeDecreaseTooltip: "縮小表情符號 (−)",
			emojiFavAdded: "已將 {0} 加入最愛。",
			emojiFavRemoved: "已將 {0} 從最愛移除。",
			emojiTitle: "表情",
		},
		es: {
			settings: '⚙ Ajustes de SpeakiLite', close: 'Cerrar', uiLang: 'Idioma', uiScale: 'Tamaño de la interfaz',
			secDisplay: 'Pantalla', fpsPing: 'Mostrar FPS / ping', expTracker: 'Seguimiento de EXP',
			expPerHour: 'Mostrar por hora (apagado = por minuto)', expWindow: 'Ventana de promedio (min)', expReset: 'Reiniciar seguimiento de EXP',
			secTranslate: 'Traducción del chat (modelo en el dispositivo)', trAuto: 'Traducir el chat automáticamente', trTarget: 'Traducir a',
			trHint: 'Aunque la traducción automática esté apagada, al tocar una línea del chat se traduce solo esa línea. El modelo de idioma se descarga una vez la primera vez.',
			secBlock: 'Usuarios bloqueados', blockHide: 'Ocultar personajes y voces de usuarios bloqueados',
			blockHint: 'Usa la lista de bloqueo del juego. Oculta su personaje, emotes, voz, burbujas de chat y corazones.',
			secGraphics: 'Gráficos', resolution: 'Forzar resolución', resolutionOff: 'No',
			resolutionHint: 'Se aplica al instante. Solo funciona en el diseño móvil.',
			aaOff: 'Desactivar antialiasing (evita el parpadeo del suelo)', aaHint: 'Requiere recargar para aplicarse.', applyReload: 'Recargar',
			secDiag: 'Diagnóstico', glRefresh: 'Actualizar',
			expMin: '{0} EXP/min', expHour: '{0} EXP/hora', expMeasuring: 'Midiendo EXP…',
			nextMin: 'Nv.{0} · siguiente en ~{1} min', nextHour: 'Nv.{0} · siguiente en ~{1} h', nextNA: 'Nv.{0} · siguiente -',
			trDownloading: 'Descargando modelo de traducción… (solo la primera vez)', trReady: 'Modelo de traducción listo',
			trNoBridge: 'La traducción en el dispositivo no está disponible en esta app', trFail: 'Error de traducción', trNothing: 'Nada que traducir',
			glNone: '(aún no hay contexto WebGL)',
			emojiTabStandard: "Standard",
			emojiTabCustom: "MMO",
			emojiTabTrickcal: "1",
			emojiTabTrickcal2: "2",
			emojiTabTrickcal3: "3",
			emojiTabFav: "💚",
			emojiNoFavs: "Aún no tienes emojis favoritos. ¡Haz clic derecho en un emoji para añadirlo!",
			emojiWarning: "¡Recuerda que puedes enviar imágenes de emojis en nuestro servidor de Discord de soporte!\n¡Solo otros usuarios del Mod podrán ver tus emojis personalizados! ¡Úsalos con tranquilidad!",
			emojiWarningFav: "Puedes añadir o quitar emojis de esta lista haciendo clic derecho sobre cualquier emoji",
			emojiSizeIncreaseTooltip: "Aumentar tamaño de emoji (+)",
			emojiSizeDecreaseTooltip: "Reducir tamaño de emoji (−)",
			emojiFavAdded: "Se añadió {0} a favoritos.",
			emojiFavRemoved: "Se eliminó {0} de favoritos.",
			emojiTitle: "Emoji",
		},
	};
	function resolveLang(pref) {
		if (pref && pref !== 'auto' && STR[pref]) return pref;
		const l = (navigator.language || 'en').toLowerCase();
		if (l.startsWith('ko')) return 'ko';
		if (l.startsWith('ja')) return 'ja';
		if (l === 'zh-tw' || l === 'zh-hk' || l.startsWith('zh-hant')) return 'zh-TW';
		if (l.startsWith('zh')) return 'zh-CN';
		if (l.startsWith('es')) return 'es';
		return 'en';
	}
	let uiLangPref = LS.get('ui-lang', 'auto');
	let LANG = resolveLang(uiLangPref);
	const T = (key, ...args) => {
		let s = (STR[LANG] && STR[LANG][key]) || STR.en[key] || key;
		args.forEach((a, i) => { s = s.split(`{${i}}`).join(a); });
		return s;
	};

	// ------------------------------------------------------------------
	// Early part #1: WebGL patches (must run before the game creates its context)
	// ------------------------------------------------------------------
	const glTracked = []; // WeakRef<WebGLRenderingContext>

	function installGlPatches() {
		try {
			const proto = HTMLCanvasElement.prototype;
			const origGetContext = proto.getContext;
			proto.getContext = function (type, attrs, ...rest) {
				const isGl = type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl';
				let a = attrs;
				if (isGl && cfg.aaOff) a = Object.assign({}, attrs, { antialias: false });
				const ctx = origGetContext.call(this, type, a, ...rest);
				if (isGl && ctx) {
					try { glTracked.push(new WeakRef(ctx)); } catch (_) { /* no WeakRef */ }
				}
				return ctx;
			};
		} catch (e) { console.warn('[SpeakiLite] getContext patch failed', e); }

		// Render-target MSAA (three.js WebGLRenderTarget{samples>0}) goes through this call.
		// samples=0 is valid in WebGL2 and degrades to a plain renderbuffer.
		try {
			if (window.WebGL2RenderingContext) {
				const p2 = WebGL2RenderingContext.prototype;
				const orig = p2.renderbufferStorageMultisample;
				p2.renderbufferStorageMultisample = function (target, samples, internalformat, width, height) {
					return orig.call(this, target, cfg.aaOff ? 0 : samples, internalformat, width, height);
				};
			}
		} catch (e) { console.warn('[SpeakiLite] MSAA renderbuffer patch failed', e); }
	}
	installGlPatches();

	function glDiagnostics() {
		const list = glTracked.map(r => r.deref()).filter(Boolean);
		if (!list.length) return T('glNone');
		return list.map(gl => {
			let attrs = {};
			try { attrs = gl.getContextAttributes() || {}; } catch (_) { /* lost */ }
			const get = p => { try { return gl.getParameter(p); } catch (_) { return '?'; } };
			let renderer = '?';
			try {
				const ext = gl.getExtension('WEBGL_debug_renderer_info');
				renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : get(gl.RENDERER);
			} catch (_) { /* ignore */ }
			const cls = (gl.canvas && gl.canvas.className) || 'canvas';
			return `${cls}: AA=${attrs.antialias} samples=${get(gl.SAMPLES)} depth=${get(gl.DEPTH_BITS)} ${renderer}`;
		}).join('\n');
	}

	// ------------------------------------------------------------------
	// Same as the original mod (SpeakiMod.js): the game WebSocket URL gets "emoji=1&mod=1" appended. The server uses
	// this to decide whether a connection receives chat text containing custom emoji tags (":name:"); connections
	// without it get that text filtered. Must run before the game opens its socket, i.e. at document start.
	// ------------------------------------------------------------------
	if (!window.__speakiWsHooked && typeof window.WebSocket !== 'undefined') {
		window.__speakiWsHooked = true;
		const OrigWebSocket = window.WebSocket;
		window.WebSocket = new Proxy(OrigWebSocket, {
			construct(target, args) {
				let [url, protocols] = args;
				if (typeof url === 'string' && (url.includes('/ws/') || url.includes('/game') || url.includes('overture.io.kr'))) {
					let sep = url.includes('?') ? '&' : '?';
					if (!url.includes('emoji=1')) {
						url += sep + 'emoji=1';
						sep = '&';
					}
					if (!url.includes('mod=1')) {
						url += sep + 'mod=1';
					}
					args[0] = url;
				}
				return Reflect.construct(target, args);
			},
			apply(target, thisArg, args) {
				let [url, protocols] = args;
				if (typeof url === 'string' && (url.includes('/ws/') || url.includes('/game') || url.includes('overture.io.kr'))) {
					let sep = url.includes('?') ? '&' : '?';
					if (!url.includes('emoji=1')) {
						url += sep + 'emoji=1';
						sep = '&';
					}
					if (!url.includes('mod=1')) {
						url += sep + 'mod=1';
					}
					args[0] = url;
				}
				return Reflect.construct(target, args);
			}
		});
	}

	// ------------------------------------------------------------------
	// Early part #2: ping endpoint / auth token / block-list sniffing
	// ------------------------------------------------------------------
	let pingOrigin = 'https://sr1.overture.io.kr';
	try {
		const origFetch = window.fetch;
		window.fetch = function (...args) {
			let p;
			try {
				const a0 = args[0];
				const url = typeof a0 === 'string' ? a0 : (a0 && a0.url) || '';
				const m = /^https:\/\/(sr1|relay)\.overture\.io\.kr\/api\//.exec(url);
				if (m) pingOrigin = `https://${m[1]}.overture.io.kr`;
				blockSniffRequest(args, url);
				p = origFetch.apply(this, args);
				if (url.includes('/api/block')) blockSniffResponse(args, url, p);
				return p;
			} catch (_) { /* fall through */ }
			return p || origFetch.apply(this, args);
		};
	} catch (_) { /* ignore */ }

	let started = false;
	function startLite() {
		if (started) return;
		started = true;
		onBody(init);
	}

	function onBody(fn) {
		if (document.body) return fn();
		document.addEventListener('DOMContentLoaded', fn, { once: true });
	}
	// ------------------------------------------------------------------
	// Small helpers
	// ------------------------------------------------------------------
	function h(tag, props, ...kids) {
		const el = document.createElement(tag);
		if (props) {
			for (const [k, v] of Object.entries(props)) {
				if (v === undefined || v === null) continue;
				if (k === 'style') el.style.cssText = v;
				else if (k === 'class') el.className = v;
				else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
				else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
				else el.setAttribute(k, v);
			}
		}
		for (const c of kids.flat()) if (c !== null && c !== undefined) el.append(c.nodeType ? c : document.createTextNode(String(c)));
		return el;
	}

	// Keep touches on our own UI from steering the game camera / character.
	const SHIELD_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'wheel'];
	function shield(el) {
		for (const t of SHIELD_EVENTS) el.addEventListener(t, e => e.stopPropagation(), { passive: true });
	}

	const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

	let toastEl = null, toastTimer = 0;
	function toast(msg, ms = 2400) {
		if (!document.body) return;
		if (!toastEl) {
			toastEl = h('div', { id: 'spkl-toast' });
			shield(toastEl);
			document.body.appendChild(toastEl);
		}
		toastEl.textContent = msg;
		toastEl.style.opacity = '1';
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { if (toastEl) toastEl.style.opacity = '0'; }, ms);
	}

	// ------------------------------------------------------------------
	// Emoji catalogs (same source files as the desktop mod, cached locally)
	// ------------------------------------------------------------------
	const RAW = 'https://raw.githubusercontent.com/DJTOMATO/SpeakiRPG';
	const RAW_PINNED = RAW + '/161e1bca722be72c67da40a04da2880ea83b1928'; // same fallback commit as upstream
	const PACKS = [
		{ id: 'custom', file: 'emojis.txt', tab: 'tabCustom' },
		{ id: 'trickcal', file: 'emojis2.txt', tab: 'tabTrickcal' },
		{ id: 'trickcal2', file: 'emojis3.txt', tab: 'tabTrickcal2' },
		{ id: 'trickcal3', file: 'emojis4.txt', tab: 'tabTrickcal3' },
	];
	const STANDARD_EMOJIS = ['👍', '👎', '👋', '🙏', '👏', '🙌', '🤝', '😊', '😂', '🤣', '😍', '😎', '🤔', '😅', '😭', '🥺', '🔥', '💯', '❤️', '✨', '🎉', '💀', '👀', '🗣️', '💰', '💎', '🟣', '⭐', '❌', '✅', '💪', '🤷', '🤦', '🎈', '🎂', '🥳', '🙄', '🤐', '🥵', '🥶', '🤯', '😴', '🤮', '🤡', '👻', '👽', '💩', '🤖', '🎃'];

	const emoji = { packs: { custom: {}, trickcal: {}, trickcal2: {}, trickcal3: {} }, all: {} };

	function rebuildEmojiIndex() {
		emoji.all = Object.assign({}, emoji.packs.custom, emoji.packs.trickcal, emoji.packs.trickcal2, emoji.packs.trickcal3);
	}

	function parseCatalog(text) {
		const out = {};
		for (const raw of text.split('\n')) {
			const line = raw.trim();
			if (!line) continue;
			const i = line.indexOf(',');
			if (i < 1) continue;
			const name = line.slice(0, i).replace(/:/g, '').trim();
			const url = line.slice(i + 1).trim();
			if (name && /^https:\/\//.test(url)) out[name] = url;
		}
		return out;
	}

	async function fetchCatalog(pack) {
		const tryUrl = async base => {
			const r = await fetch(`${base}/main/${pack.file}`, { cache: 'no-cache' });
			if (!r.ok) throw new Error('HTTP ' + r.status);
			return parseCatalog(await r.text());
		};
		try { return await tryUrl(RAW); } catch (_) { /* fall back to pinned commit */ }
		return await fetch(`${RAW_PINNED}/${pack.file}`).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(parseCatalog);
	}

	function loadEmojiCaches() {
		for (const p of PACKS) {
			const c = LS.getJSON('emoji-cache-' + p.id, null);
			if (c && c.m && typeof c.m === 'object') emoji.packs[p.id] = c.m;
		}
		rebuildEmojiIndex();
	}

	async function refreshEmojiCatalogs() {
		let changed = false;
		await Promise.all(PACKS.map(async p => {
			try {
				const map = await fetchCatalog(p);
				if (Object.keys(map).length && JSON.stringify(map) !== JSON.stringify(emoji.packs[p.id])) {
					emoji.packs[p.id] = map;
					LS.setJSON('emoji-cache-' + p.id, { t: Date.now(), m: map });
					changed = true;
				}
			} catch (e) { emoji.lastError = `${p.file}: ${(e && e.message) || e}`; console.warn('[SpeakiLite] emoji catalog failed:', p.file, e && e.message); }
		}));
		if (changed) {
			rebuildEmojiIndex();
			rescanChatEmojis();
			if (lunEmojiPickerPanel) renderEmojiGrid();
		}
	}

	const TAG_RE = /:([^:\s]{1,64}):/g;

	function makeEmojiNode(name, url) {
		const img = h('img', { src: url, alt: `:${name}:`, loading: 'lazy', decoding: 'async', draggable: 'false' });
		img.addEventListener('error', () => { img.style.opacity = '0.35'; }, { once: true });
		return h('span', { class: 'spkl-emoji', 'data-name': name, title: `:${name}:` }, img);
	}

	// Replace ":name:" tags in text nodes below `root` with <img>s (idempotent).
	function renderEmojiIn(root) {
		if (!root || !Object.keys(emoji.all).length) return;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: n => (n.nodeValue && n.nodeValue.includes(':') && n.parentElement && !n.parentElement.closest('.spkl-emoji')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
		});
		const nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		for (const node of nodes) {
			const text = node.nodeValue;
			TAG_RE.lastIndex = 0;
			let last = 0, m, frag = null;
			while ((m = TAG_RE.exec(text))) {
				const url = emoji.all[m[1]];
				if (!url) { TAG_RE.lastIndex = m.index + 1; continue; }
				frag = frag || document.createDocumentFragment();
				if (m.index > last) frag.append(text.slice(last, m.index));
				frag.append(makeEmojiNode(m[1], url));
				last = m.index + m[0].length;
			}
			if (frag) {
				if (last < text.length) frag.append(text.slice(last));
				node.replaceWith(frag);
			}
		}
	}

	function rescanChatEmojis() {
		document.querySelectorAll('.sr-chatbox__body-text').forEach(renderEmojiIn);
	}

	// --- chat input helpers ---------------------------------------------------
	// ------------------------------------------------------------------
	// Emoji picker: port of the original mod. Movable by dragging its header, resizable with the browser's native
	// resize handle (CSS "resize: both"), same tabs / warning banner / +- size buttons, same size & position
	// persistence keys. Tabs do not touch input focus (so tapping them never opens the keyboard).
	// ------------------------------------------------------------------
	const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } };
	const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* ignore */ } };

	let lunEmojiPickerPanel = null;
	let lunEmojiTab = 'standard';
	let lunEmojiFreq = {};
	try { lunEmojiFreq = JSON.parse(lsGet('spkmod-emoji-freq', '{}')) || {}; } catch (_) { lunEmojiFreq = {}; }
	let lunEmojiFavorites = [];
	try { lunEmojiFavorites = JSON.parse(lsGet('spkmod-emoji-fav', '[]')) || []; } catch (_) { lunEmojiFavorites = []; }
	let lunEmojiSize = parseInt(lsGet('spkmod-emoji-size', '35'), 10);
	if (isNaN(lunEmojiSize) || lunEmojiSize < 20 || lunEmojiSize > 80) lunEmojiSize = 35;

	function toggleFavoriteEmoji(id) {
		if (lunEmojiFavorites.includes(id)) {
			lunEmojiFavorites = lunEmojiFavorites.filter(x => x !== id);
			toast(T('emojiFavRemoved', id), 1600);
		} else {
			lunEmojiFavorites.push(id);
			toast(T('emojiFavAdded', id), 1600);
		}
		lsSet('spkmod-emoji-fav', JSON.stringify(lunEmojiFavorites));
		if (lunEmojiTab === 'fav') renderEmojiGrid();
	}

	function getSortedEmojis() {
		return [...STANDARD_EMOJIS].sort((a, b) => (lunEmojiFreq[b] || 0) - (lunEmojiFreq[a] || 0));
	}

	// makeDraggable(), trimmed to what the picker uses (same drag rules and position persistence)
	function makeDraggable(element, handles) {
		if (!element || !handles) return;
		if (element.__spkmodDraggable) return;
		element.__spkmodDraggable = true;

		const posKey = element.id ? 'spkmod-pos-' + element.id : null;
		if (posKey) {
			const savedPos = lsGet(posKey, null);
			if (savedPos) {
				try {
					const parsedPos = JSON.parse(savedPos);
					if (parsedPos.top && parsedPos.left) {
						const topNum = parseFloat(parsedPos.top);
						const leftNum = parseFloat(parsedPos.left);
						if (!isNaN(topNum) && !isNaN(leftNum)) {
							const minTop = 35;
							const maxTop = Math.max(minTop, window.innerHeight - 120);
							element.style.top = Math.max(minTop, Math.min(topNum, maxTop)) + 'px';
							element.style.left = Math.max(0, Math.min(leftNum, window.innerWidth - 60)) + 'px';
							element.dataset.userDragged = 'true';
						} else {
							element.style.top = parsedPos.top;
							element.style.left = parsedPos.left;
							element.dataset.userDragged = 'true';
						}
					}
				} catch (_) { /* ignore broken saved position */ }
			}
		}

		handles.forEach(handle => {
			if (handle && handle.addEventListener) handle.addEventListener('dragstart', e => e.preventDefault());
		});

		let isDragging = false;
		let startPointerX = 0, startPointerY = 0;
		let startElemLeft = 0, startElemTop = 0;
		let hasMovedSignificant = false;

		function onPointerDown(e) {
			if (isDragging) return;
			if (e.button !== undefined && e.button !== 0) return;

			const target = e.target;
			if (target) {
				const isInteractive = (
					target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT' ||
					target.tagName === 'TEXTAREA' || target.tagName === 'A' ||
					target.closest('button') || target.closest('input') || target.closest('select') ||
					target.closest('textarea') || target.closest('a')
				);
				if (isInteractive) return;
			}

			const rect = element.getBoundingClientRect();
			startElemLeft = parseFloat(element.style.left);
			if (isNaN(startElemLeft)) startElemLeft = rect.left;
			startElemTop = parseFloat(element.style.top);
			if (isNaN(startElemTop)) startElemTop = rect.top;

			startPointerX = e.clientX;
			startPointerY = e.clientY;
			hasMovedSignificant = false;
			isDragging = true;

			if (e.pointerId && target && target.setPointerCapture) {
				try { target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
			}

			window.addEventListener('pointermove', onMove, { passive: false });
			window.addEventListener('pointerup', onUp);
			window.addEventListener('pointercancel', onUp);
			window.addEventListener('mousemove', onMove, { passive: false });
			window.addEventListener('mouseup', onUp);
		}

		function onMove(ev) {
			if (!isDragging) return;
			const deltaX = ev.clientX - startPointerX;
			const deltaY = ev.clientY - startPointerY;
			if (!hasMovedSignificant && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
				hasMovedSignificant = true;
				element.dataset.userDragged = 'true';
				element.dataset.justDragged = 'true';
			}
			if (hasMovedSignificant) {
				ev.preventDefault();
				const minTop = 35;
				const maxTop = Math.max(minTop, window.innerHeight - 45);
				const maxLeft = Math.max(0, window.innerWidth - 60);
				element.style.left = Math.round(Math.min(Math.max(0, startElemLeft + deltaX), maxLeft)) + 'px';
				element.style.top = Math.round(Math.min(Math.max(minTop, startElemTop + deltaY), maxTop)) + 'px';
			}
		}

		function onUp(ev) {
			if (!isDragging) return;
			isDragging = false;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			if (ev && ev.pointerId && ev.target && ev.target.releasePointerCapture) {
				try { ev.target.releasePointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
			}
			if (hasMovedSignificant) {
				element.dataset.userDragged = 'true';
				if (posKey) lsSet(posKey, JSON.stringify({ top: element.style.top, left: element.style.left }));
				setTimeout(() => { element.dataset.justDragged = 'false'; }, 120);
			}
		}

		handles.forEach(handle => {
			if (handle) {
				handle.addEventListener('pointerdown', onPointerDown);
				handle.addEventListener('mousedown', onPointerDown);
			}
		});
	}

	function toggleEmojiPicker(anchorBtn) {
		if (lunEmojiPickerPanel) {
			lunEmojiPickerPanel.remove();
			lunEmojiPickerPanel = null;
			window.lunEmojiTargetInput = null;
			return;
		}

		lunEmojiPickerPanel = document.createElement('div');
		lunEmojiPickerPanel.id = 'spkmod-emoji-picker-v2';

		const isMobile = typeof window.speakiMobile !== 'undefined' || (typeof navigator !== 'undefined' && /mobi|android/i.test(navigator.userAgent));
		const defaultW = isMobile ? '360px' : '420px';
		const defaultH = isMobile ? '320px' : '420px';
		lunEmojiPickerPanel.style.cssText = `position: fixed; width: ${defaultW}; height: ${defaultH}; max-width: 95vw; max-height: 80vh; min-width: 200px; min-height: 150px; resize: both; overflow: hidden; background: rgba(20, 20, 20, 0.95); border: 1px solid #555; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; gap: 4px; z-index: 2147483646 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto; box-sizing: content-box; font-family: sans-serif;`;
		lunEmojiPickerPanel.style.setProperty('z-index', '2147483646', 'important');
		const emojiSizeKey = 'spkmod-size-spkmod-emoji-picker-v2';

		try {
			const savedSize = lsGet(emojiSizeKey, null);
			if (savedSize) {
				const parsedSize = JSON.parse(savedSize);
				const sw = parseInt(parsedSize && parsedSize.width, 10);
				const sh = parseInt(parsedSize && parsedSize.height, 10);
				if (!isNaN(sw) && !isNaN(sh)) {
					lunEmojiPickerPanel.style.width = Math.max(200, Math.min(Math.round(window.innerWidth * 0.95), sw)) + 'px';
					lunEmojiPickerPanel.style.height = Math.max(150, Math.min(Math.round(window.innerHeight * 0.8), sh)) + 'px';
				}
			}
		} catch (_) { /* ignore */ }

		if (!lsGet('spkmod-pos-spkmod-emoji-picker-v2', null)) {
			if (isMobile) {
				lunEmojiPickerPanel.style.left = Math.max(10, (window.innerWidth / 2) - 180) + 'px';
				lunEmojiPickerPanel.style.top = Math.max(10, (window.innerHeight / 2) - 160) + 'px';
				lunEmojiPickerPanel.style.bottom = 'auto';
			} else if (anchorBtn) {
				const btnRect = anchorBtn.getBoundingClientRect();
				const panelW = 420;
				const panelH = 420;
				let left = btnRect.right + 10;
				if (left + panelW > window.innerWidth - 10) left = btnRect.left - panelW - 10;
				if (left < 10) left = Math.max(10, (window.innerWidth - panelW) / 2);
				let top = btnRect.bottom - panelH;
				if (top < 10) top = Math.max(10, btnRect.top);
				if (top + panelH > window.innerHeight - 10) top = Math.max(10, window.innerHeight - panelH - 10);
				lunEmojiPickerPanel.style.left = left + 'px';
				lunEmojiPickerPanel.style.top = top + 'px';
				lunEmojiPickerPanel.style.bottom = 'auto';
			} else {
				lunEmojiPickerPanel.style.left = Math.max(10, (window.innerWidth - 420) / 2) + 'px';
				lunEmojiPickerPanel.style.top = Math.max(10, (window.innerHeight - 420) / 2) + 'px';
				lunEmojiPickerPanel.style.bottom = 'auto';
			}
		}

		// Prevent scrolling inside the panel from zooming the game camera
		lunEmojiPickerPanel.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
		lunEmojiPickerPanel.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
		lunEmojiPickerPanel.addEventListener('mousedown', (e) => { e.stopPropagation(); });
		lunEmojiPickerPanel.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });

		renderEmojiGrid();
		document.body.appendChild(lunEmojiPickerPanel);
		lunEmojiPickerPanel.style.setProperty('z-index', '2147483646', 'important');

		if (typeof ResizeObserver !== 'undefined') {
			const panelEl = lunEmojiPickerPanel;
			const cs = getComputedStyle(panelEl);
			let lastW = Math.round(parseFloat(cs.width)) || 0;
			let lastH = Math.round(parseFloat(cs.height)) || 0;
			const sizeObserver = new ResizeObserver(() => {
				if (!panelEl.isConnected) { sizeObserver.disconnect(); return; }
				const c = getComputedStyle(panelEl);
				const w = Math.round(parseFloat(c.width));
				const h = Math.round(parseFloat(c.height));
				if (!w || !h || (w === lastW && h === lastH)) return;
				lastW = w; lastH = h;
				lsSet(emojiSizeKey, JSON.stringify({ width: w, height: h }));
			});
			sizeObserver.observe(panelEl);
		}

		const closeHandler = (e) => {
			if (!lunEmojiPickerPanel) return;
			if (e.target && !document.contains(e.target)) return;

			const path = e.composedPath ? e.composedPath() : [];
			let isInside = false;
			if (path.length > 0) {
				isInside = path.includes(lunEmojiPickerPanel) || (anchorBtn && path.includes(anchorBtn)) || (window.lunEmojiTargetInput && path.includes(window.lunEmojiTargetInput));
			}

			if (!isInside) {
				let el = e.target;
				while (el) {
					if (el === lunEmojiPickerPanel || (anchorBtn && el === anchorBtn) || (window.lunEmojiTargetInput && el === window.lunEmojiTargetInput)) {
						isInside = true;
						break;
					}
					el = el.parentElement;
				}
			}

			if (!isInside) {
				lunEmojiPickerPanel.remove();
				lunEmojiPickerPanel = null;
				window.lunEmojiTargetInput = null;
				document.removeEventListener('mousedown', closeHandler);
				document.removeEventListener('touchstart', closeHandler);
			}
		};
		setTimeout(() => {
			document.addEventListener('mousedown', closeHandler);
			document.addEventListener('touchstart', closeHandler, { passive: true });
		}, 10);
	}

	function renderEmojiGrid() {
		if (!lunEmojiPickerPanel) return;

		let headerWrap = lunEmojiPickerPanel.querySelector('.spkmod-emoji-header');
		let header = lunEmojiPickerPanel.querySelector('#spkmod-emoji-tabs');
		let grid = lunEmojiPickerPanel.querySelector('#spkmod-emoji-grid');

		if (!headerWrap) {
			lunEmojiPickerPanel.innerHTML = '';

			headerWrap = document.createElement('div');
			headerWrap.className = 'spkmod-emoji-header';
			headerWrap.style.cssText = 'cursor: move; user-select: none; touch-action: none;';

			const warningBanner = document.createElement('div');
			warningBanner.id = 'spkmod-emoji-warning';
			warningBanner.style.cssText = 'color: #ffaa00; font-size: 11px; text-align: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px dashed #555; font-weight: bold; font-family: sans-serif; white-space: pre-line; line-height: 1.35;';
			headerWrap.appendChild(warningBanner);

			header = document.createElement('div');
			header.id = 'spkmod-emoji-tabs';
			header.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px; border-bottom: 1px solid #444; padding-bottom: 4px; flex-wrap: wrap;';
			headerWrap.appendChild(header);

			lunEmojiPickerPanel.appendChild(headerWrap);

			grid = document.createElement('div');
			grid.id = 'spkmod-emoji-grid';
			grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; flex-grow: 1; overflow-y: auto; align-content: flex-start;';
			lunEmojiPickerPanel.appendChild(grid);

			const fixEmojiPanelPos = () => {
				if (lunEmojiPickerPanel.style.bottom !== 'auto') {
					lunEmojiPickerPanel.style.top = lunEmojiPickerPanel.getBoundingClientRect().top + 'px';
					lunEmojiPickerPanel.style.bottom = 'auto';
				}
			};
			headerWrap.addEventListener('mousedown', fixEmojiPanelPos);
			headerWrap.addEventListener('touchstart', fixEmojiPanelPos, { passive: true });

			makeDraggable(lunEmojiPickerPanel, [headerWrap]);
		}

		const warningBannerEl = lunEmojiPickerPanel.querySelector('#spkmod-emoji-warning');
		if (warningBannerEl) warningBannerEl.innerText = lunEmojiTab === 'fav' ? T('emojiWarningFav') : T('emojiWarning');

		header.innerHTML = '';

		const tabBtn = (tab, label) => {
			const btn = document.createElement('button');
			btn.innerText = label;
			btn.style.cssText = `flex: 1; padding: 4px; cursor: pointer; border-radius: 4px; background: ${lunEmojiTab === tab ? 'rgba(255,255,255,0.2)' : 'transparent'}; border: none; color: #fff;`;
			btn.onclick = () => { lunEmojiTab = tab; renderEmojiGrid(); };
			return btn;
		};
		header.appendChild(tabBtn('standard', '😀 ' + T('emojiTabStandard')));
		header.appendChild(tabBtn('custom', '⭐ ' + T('emojiTabCustom')));
		header.appendChild(tabBtn('trickcal', '🍀 ' + T('emojiTabTrickcal')));
		header.appendChild(tabBtn('trickcal2', '🍀 ' + T('emojiTabTrickcal2')));
		header.appendChild(tabBtn('trickcal3', '🍀 ' + T('emojiTabTrickcal3')));
		header.appendChild(tabBtn('fav', T('emojiTabFav')));

		const btnSizePlus = document.createElement('button');
		btnSizePlus.innerText = '+';
		btnSizePlus.title = T('emojiSizeIncreaseTooltip');
		btnSizePlus.style.cssText = `flex: 0 0 22px; width: 22px; padding: 2px 0; cursor: ${lunEmojiSize >= 80 ? 'default' : 'pointer'}; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid #555; color: #fff; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; line-height: 1; user-select: none; opacity: ${lunEmojiSize >= 80 ? '0.4' : '1'};`;
		btnSizePlus.onclick = (e) => {
			e.stopPropagation();
			if (lunEmojiSize >= 80) return;
			lunEmojiSize = Math.min(80, (lunEmojiSize || 35) + 5);
			lsSet('spkmod-emoji-size', String(lunEmojiSize));
			renderEmojiGrid();
		};

		const btnSizeMinus = document.createElement('button');
		btnSizeMinus.innerText = '−';
		btnSizeMinus.title = T('emojiSizeDecreaseTooltip');
		btnSizeMinus.style.cssText = `flex: 0 0 22px; width: 22px; padding: 2px 0; cursor: ${lunEmojiSize <= 20 ? 'default' : 'pointer'}; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid #555; color: #fff; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; line-height: 1; user-select: none; opacity: ${lunEmojiSize <= 20 ? '0.4' : '1'};`;
		btnSizeMinus.onclick = (e) => {
			e.stopPropagation();
			if (lunEmojiSize <= 20) return;
			lunEmojiSize = Math.max(20, (lunEmojiSize || 35) - 5);
			lsSet('spkmod-emoji-size', String(lunEmojiSize));
			renderEmojiGrid();
		};

		header.appendChild(btnSizePlus);
		header.appendChild(btnSizeMinus);

		grid.innerHTML = '';
		const curCustomSize = lunEmojiSize || 35;
		const curStdSize = Math.max(16, curCustomSize - 4);
		const curStdFontSize = Math.max(12, Math.round(curCustomSize * 0.55));

		const stdTile = (emojiChar, countFreq, rerender) => {
			const btn = document.createElement('button');
			btn.innerText = emojiChar;
			btn.style.cssText = `width: ${curStdSize}px; height: ${curStdSize}px; background: rgba(255,255,255,0.1); border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: ${curStdFontSize}px; display: flex; align-items: center; justify-content: center; transition: background 0.1s;`;
			btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
			btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.1)';
			btn.onclick = () => {
				lunEmojiFreq[emojiChar] = (lunEmojiFreq[emojiChar] || 0) + 1;
				lsSet('spkmod-emoji-freq', JSON.stringify(lunEmojiFreq));
				if (rerender) renderEmojiGrid();
				insertEmojiIntoChat(emojiChar);
			};
			btn.oncontextmenu = (e) => { e.preventDefault(); toggleFavoriteEmoji(emojiChar); };
			return btn;
		};
		const customTile = (name, url) => {
			const btn = document.createElement('button');
			btn.title = `:${name}:`;
			btn.setAttribute('data-url', url);
			btn.style.cssText = `width: ${curCustomSize}px; height: ${curCustomSize}px; background: rgba(255,255,255,0.1); border: 1px solid transparent; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.1s; padding: 2px;`;
			btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
			btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.1)';
			const img = document.createElement('img');
			img.src = url;
			img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
			btn.appendChild(img);
			btn.onclick = () => { insertEmojiIntoChat(`:${name}: `); };
			btn.oncontextmenu = (e) => { e.preventDefault(); toggleFavoriteEmoji(name); };
			return btn;
		};

		if (lunEmojiTab === 'fav') {
			if (lunEmojiFavorites.length === 0) {
				const noFavs = document.createElement('div');
				noFavs.innerText = T('emojiNoFavs');
				noFavs.style.cssText = 'color: #aaa; width: 100%; text-align: center; margin-top: 20px; font-size: 13px;';
				grid.appendChild(noFavs);
			} else {
				lunEmojiFavorites.forEach(id => {
					const url = emoji.all[id];
					grid.appendChild(url ? customTile(id, url) : stdTile(id, true, false));
				});
			}
		} else if (lunEmojiTab === 'standard') {
			getSortedEmojis().forEach(e => grid.appendChild(stdTile(e, true, true)));
		} else {
			const targetEmojis = emoji.packs[lunEmojiTab] || emoji.packs.custom;
			Object.entries(targetEmojis).forEach(([name, url]) => grid.appendChild(customTile(name, url)));
		}

		lunEmojiPickerPanel.appendChild(grid);
	}

	function insertEmojiIntoChat(emojiText) {
		let target = null;
		if (window.lunEmojiTargetInput && document.body.contains(window.lunEmojiTargetInput)) {
			target = window.lunEmojiTargetInput;
		} else if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
			target = document.activeElement;
		} else {
			target = document.querySelector(".sr-chatbox__input, .sr-chatbox input, input[placeholder*='chat']");
		}

		if (!target) return;

		target.focus();
		const isTextarea = target.tagName === 'TEXTAREA';
		const start = (typeof target.selectionStart === 'number') ? target.selectionStart : target.value.length;
		const end = (typeof target.selectionEnd === 'number') ? target.selectionEnd : target.value.length;

		let inserted = false;
		try {
			inserted = document.execCommand('insertText', false, emojiText);
		} catch (_) {
			inserted = false;
		}

		if (!inserted) {
			const val = target.value || '';
			const maxLen = target.maxLength > 0 ? target.maxLength : 500;
			const nextVal = val.slice(0, start) + emojiText + val.slice(end);
			if (nextVal.length <= maxLen) {
				const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
				const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
				if (nativeSetter) {
					nativeSetter.call(target, nextVal);
				} else {
					target.value = nextVal;
				}
				target.selectionStart = target.selectionEnd = start + emojiText.length;
				target.dispatchEvent(new Event('input', { bubbles: true }));
				target.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
	}

	// used by the diagnostics panel
	function findChatInput() {
		return document.querySelector(".sr-chatbox input, input[placeholder*='chat']");
	}

	function hookChatEmojiButton() {
		const chatInput = document.querySelector(".sr-chatbox input, input[placeholder*='chat']");
		if (!chatInput) return;
		const container = chatInput.parentElement;

		let btn = document.getElementById('spkmod-emoji-btn');
		if (!btn) {
			btn = document.createElement('button');
			btn.id = 'spkmod-emoji-btn';
			btn.innerText = '😀';
			btn.title = T('emojiTitle');
			btn.style.cssText = 'position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; background: transparent; border: none; cursor: pointer; z-index: 999999; font-size: 16px; display: flex; align-items: center; justify-content: center; filter: grayscale(100%); transition: filter 0.2s; pointer-events: auto; user-select: none;';
			btn.onmousedown = (e) => { e.preventDefault(); };
			btn.onmouseenter = () => btn.style.filter = 'none';
			btn.onmouseleave = () => btn.style.filter = 'grayscale(100%)';
			btn.onclick = (e) => {
				e.preventDefault();
				window.lunEmojiTargetInput = chatInput;
				toggleEmojiPicker(btn);
			};
			container.style.position = 'relative';
			container.appendChild(btn);

			chatInput.style.paddingRight = '30px';
		} else {
			btn.title = T('emojiTitle');
			btn.onclick = (e) => {
				e.preventDefault();
				window.lunEmojiTargetInput = chatInput;
				toggleEmojiPicker(btn);
			};
		}
	}

	// Long-press (= "contextmenu" on touch) on a rendered chat emoji adds/removes it from the favorites, like right-click on desktop
	function installChatEmojiContextMenu() {
		document.addEventListener('contextmenu', (e) => {
			const target = e.target.closest && e.target.closest('.spkl-emoji');
			if (!target) return;
			e.preventDefault();
			e.stopPropagation();
			let name = target.getAttribute('data-name');
			if (!name) name = (target.getAttribute('title') || '').replace(/^:|:$/g, '').trim();
			if (name) toggleFavoriteEmoji(name);
		}, true);
	}

	// ------------------------------------------------------------------
	// Native bridge for the on-device translation model
	// ------------------------------------------------------------------
	const bridge = { pending: new Map(), seq: 0, wired: false };

	function getNative() {
		const n = window.SpeakiLocalAI;
		if (n && !bridge.wired) {
			bridge.wired = true;
			n.onmessage = ev => {
				let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
				const p = bridge.pending.get(m.id);
				if (!p) return;
				if (m.progress) { p.arm(180000); if (p.onProgress) p.onProgress(m); return; }
				bridge.pending.delete(m.id);
				clearTimeout(p.timer);
				p.resolve(m);
			};
		}
		return n || null;
	}

	function nativeCall(payload, onProgress, timeoutMs = 20000) {
		return new Promise(resolve => {
			const n = getNative();
			if (!n) return resolve({ ok: false, error: 'no_bridge' });
			const id = String(++bridge.seq);
			const p = { resolve, onProgress, timer: 0 };
			p.arm = ms => { clearTimeout(p.timer); p.timer = setTimeout(() => { bridge.pending.delete(id); resolve({ ok: false, error: 'timeout' }); }, ms); };
			p.arm(timeoutMs);
			bridge.pending.set(id, p);
			try { n.postMessage(JSON.stringify(Object.assign({ id }, payload))); }
			catch (e) { bridge.pending.delete(id); clearTimeout(p.timer); resolve({ ok: false, error: String(e) }); }
		});
	}

	// ------------------------------------------------------------------
	// Chat translation
	// ------------------------------------------------------------------
	// Translation cache: copied from the original mod (priority/LRU min-heap, 1500 entries, key "source|target:normalized text")
	const lunTranslateCache = new Map(); // `${source}|${target}:${text}` -> translated text
	const lunTranslateMaxLen = 480;
	const MAX_TRANSLATE_CACHE = 1500;

	const lunTranslatePriorityHeap = [];
	const lunTranslateHeapNodeByKey = new Map();
	let lunTranslateCacheSequence = 0;

	function cacheNodeIsLowerPriority(a, b) {
	    if (a.priority !== b.priority) {
	        return a.priority < b.priority;
	    }
	    return a.lastUsed < b.lastUsed;
	}

	function cacheHeapSwap(i, j) {
	    const temp = lunTranslatePriorityHeap[i];

	    lunTranslatePriorityHeap[i] = lunTranslatePriorityHeap[j];
	    lunTranslatePriorityHeap[j] = temp;

	    lunTranslatePriorityHeap[i].heapIndex = i;
	    lunTranslatePriorityHeap[j].heapIndex = j;
	}

	function cacheHeapSiftUp(index) {
	    while (index > 0) {
	        const parent = Math.floor((index - 1) / 2);

	        if (!cacheNodeIsLowerPriority(
	            lunTranslatePriorityHeap[index],
	            lunTranslatePriorityHeap[parent]
	        )) {
	            break;
	        }

	        cacheHeapSwap(index, parent);
	        index = parent;
	    }

	    return index;
	}

	function cacheHeapSiftDown(index) {
	    const heap = lunTranslatePriorityHeap;

	    while (true) {
	        const left = index * 2 + 1;
	        const right = left + 1;
	        let smallest = index;

	        if (
	            left < heap.length &&
	            cacheNodeIsLowerPriority(heap[left], heap[smallest])
	        ) {
	            smallest = left;
	        }

	        if (
	            right < heap.length &&
	            cacheNodeIsLowerPriority(heap[right], heap[smallest])
	        ) {
	            smallest = right;
	        }

	        if (smallest === index) break;

	        cacheHeapSwap(index, smallest);
	        index = smallest;
	    }

	    return index;
	}

	function cacheHeapFix(index) {
	    index = cacheHeapSiftUp(index);
	    cacheHeapSiftDown(index);
	}

	function cacheHeapInsert(node) {
	    node.heapIndex = lunTranslatePriorityHeap.length;
	    lunTranslatePriorityHeap.push(node);
	    cacheHeapSiftUp(node.heapIndex);
	}

	function cacheHeapPopMin() {
	    const heap = lunTranslatePriorityHeap;

	    if (heap.length === 0) return null;

	    const min = heap[0];
	    const last = heap.pop();

	    if (heap.length > 0) {
	        heap[0] = last;
	        last.heapIndex = 0;
	        cacheHeapSiftDown(0);
	    }

	    min.heapIndex = -1;
	    return min;
	}

	function cacheGet(key) {
	    if (!lunTranslateCache.has(key)) return undefined;

	    const node = lunTranslateHeapNodeByKey.get(key);

	    if (node) {
	        node.priority++;
	        node.lastUsed = ++lunTranslateCacheSequence;
	        cacheHeapFix(node.heapIndex);
	    }

	    return lunTranslateCache.get(key);
	}

	function cacheSet(key, value) {

	    const existing = lunTranslateHeapNodeByKey.get(key);

	    if (existing) {
	        existing.priority++;
	        existing.lastUsed = ++lunTranslateCacheSequence;
	        cacheHeapFix(existing.heapIndex);
	        return;
	    }

	    if (lunTranslateCache.size >= MAX_TRANSLATE_CACHE) {
	        const victim = cacheHeapPopMin();

	        if (victim) {
	            lunTranslateCache.delete(victim.key);
	            lunTranslateHeapNodeByKey.delete(victim.key);
	        }
	    }

	    lunTranslateCache.set(key, value);

	    const node = {
	        key,
	        priority: 1,
	        lastUsed: ++lunTranslateCacheSequence,
	        heapIndex: -1
	    };

	    lunTranslateHeapNodeByKey.set(key, node);
	    cacheHeapInsert(node);
	}

	const tr = { chain: Promise.resolve(), backlog: 0, warnedNoBridge: false };
	const TR_BACKLOG_MAX = 30;

	function guessSource(text) {
		if (/[\u3040-\u30FF]/.test(text)) return 'ja';     // kana wins over han
		if (/[\uAC00-\uD7A3]/.test(text)) return 'ko';
		if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
		if (/[\u0400-\u04FF]/.test(text)) return 'ru';
		return null; // let the native language-id decide
	}

	// Same flow as translateChatText() in the original mod, with the on-device model instead of the web APIs.
	// Resolves to the translated string, null (nothing to show) or { error } (not cached).
	async function translateChatText(text, source, target) {
		if (!text || !text.trim() || source === target) return null;
		if (text.length > lunTranslateMaxLen) text = text.slice(0, lunTranslateMaxLen);

		// Strip all :emoji_name: patterns completely from translation input
		const safeText = text.replace(/:[a-zA-Z0-9_]+:/g, '').trim().replace(/\s+/g, ' ');

		// If the message was entirely composed of emojis (or left empty), don't translate it
		if (!safeText) return null;

		const normalized = safeText.toLowerCase();
		const cacheKey = `${source || 'auto'}|${target}:${normalized}`;
		const cached = cacheGet(cacheKey);
		if (cached !== undefined) return cached;
		if (tr.backlog >= TR_BACKLOG_MAX) return null;

		tr.backlog++;
		const run = tr.chain.then(async () => {
			const res = await nativeCall({ op: 'translate', text: safeText, source, target }, m => {
				if (m.state === 'downloading') toast(T('trDownloading'), 4000);
			});
			if (res.ok && res.downloaded) toast(T('trReady'), 1500);
			if (!res.ok) {
				if (res.error === 'no_bridge' && !tr.warnedNoBridge) { tr.warnedNoBridge = true; toast(T('trNoBridge')); }
				return { error: res.error };
			}
			const translated = res.text && res.text.trim() ? res.text.trim() : null;
			if (!translated) return null;

			// Check against the stripped text, so it doesn't just re-translate identical text
			if (translated.toLowerCase() === safeText.toLowerCase()) return null;

			cacheSet(cacheKey, translated);
			return translated;
		}).finally(() => { tr.backlog--; });
		tr.chain = run.catch(() => { /* keep the chain alive */ });
		return run;
	}

	function translateText(text) {
		return translateChatText(text, guessSource(String(text || '')), cfg.trTarget);
	}

	async function translateAndShow(name, msg, force) {
		const res = await translateText(msg);
		const gs = window.gameState;
		if (res && typeof res === 'object' && res.error) {
			if (force) toast(T(res.error === 'no_bridge' ? 'trNoBridge' : 'trFail'));
			return;
		}
		if (!res) { if (force) toast(T('trNothing')); return; }
		if (gs && gs.chatBox && gs.chatBox.__spklOrig) gs.chatBox.__spklOrig(-1338, '↳ ' + name, res);
	}

	// ------------------------------------------------------------------
	// Chat hook + DOM post-processing
	//
	// Real game DOM (from the bundle):
	//   .sr-chatbox__log > .sr-chatbox__row[data-player-name]  > span.sr-chatbox__sender "[name]" + span.sr-chatbox__body-text " msg"
	//   .sr-chatbox__preview-overlay > span.sr-chatbox__preview-overlay-line  (same two spans, rebuilt for every message)
	// In the mobile layout the log is collapsed (max-height:0) and ONLY the preview line is visible, so both are processed.
	// ------------------------------------------------------------------
	const chat = { logObs: null, logEl: null, prevObs: null, prevEl: null };

	function isOwn(name) {
		const gs = window.gameState;
		const me = gs && (gs.myPlayerName || (gs.myStat && gs.myStat.name));
		return !!me && String(name).trim() === String(me).trim();
	}

	function hookChatBox() {
		const gs = window.gameState;
		const cb = gs && gs.chatBox;
		if (!cb || typeof cb.append !== 'function' || cb.__spklHooked) return;
		const orig = cb.append.bind(cb);
		cb.__spklOrig = orig;
		cb.__spklHooked = true;
		cb.append = (id, name, msg, ...rest) => {
			try {
				if (id !== -1337 && id !== -1338 && typeof msg === 'string' && msg.trim() && cfg.translate && !isOwn(name)) {
					translateAndShow(name, msg, false);
				}
			} catch (e) { console.warn('[SpeakiLite] chat hook error', e); }
			return orig(id, name, msg, ...rest);
		};
	}

	function lineInfo(body) {
		const row = body.closest('.sr-chatbox__row');
		const prev = body.previousElementSibling;
		const sender = (prev && prev.classList && prev.classList.contains('sr-chatbox__sender')) ? prev : (row && row.querySelector('.sr-chatbox__sender'));
		const name = (row && row.dataset && row.dataset.playerName) || (sender ? sender.textContent.trim().replace(/^\[|\]$/g, '') : '');
		return { name, msg: (body.textContent || '').trim() };
	}

	function processBody(body) {
		if (body.dataset.spkl) return;
		body.dataset.spkl = '1';
		const info = lineInfo(body);
		if (String(info.name).startsWith('↳')) body.classList.add('spkl-translated'); // our own translation lines: yellow
		renderEmojiIn(body);
		if (!body.closest('.sr-chatbox__log')) return; // the preview line is not interactive
		body.addEventListener('click', ev => {
			if (ev.target.closest && ev.target.closest('.spkl-emoji')) return; // long-press on an emoji = favorite, not translate
			const cur = lineInfo(body);
			if (String(cur.name).startsWith('↳')) return; // never re-translate a translation
			translateAndShow(cur.name, cur.msg, true);
		});
	}

	function handleAdded(node) {
		if (node.nodeType !== 1) return;
		if (node.matches && node.matches('.sr-chatbox__body-text')) processBody(node);
		if (node.querySelectorAll) node.querySelectorAll('.sr-chatbox__body-text').forEach(processBody);
	}

	function ensureChatObserver() {
		const log = document.querySelector('.sr-chatbox__log');
		if (log && chat.logEl !== log) {
			if (chat.logObs) chat.logObs.disconnect();
			chat.logEl = log;
			chat.logObs = new MutationObserver(muts => { for (const m of muts) m.addedNodes.forEach(handleAdded); });
			chat.logObs.observe(log, { childList: true, subtree: true });
			log.querySelectorAll('.sr-chatbox__body-text').forEach(processBody);
		}
		const prev = document.querySelector('.sr-chatbox__preview-overlay-line');
		if (prev && chat.prevEl !== prev) {
			if (chat.prevObs) chat.prevObs.disconnect();
			chat.prevEl = prev;
			chat.prevObs = new MutationObserver(muts => { for (const m of muts) m.addedNodes.forEach(handleAdded); });
			chat.prevObs.observe(prev, { childList: true, subtree: true });
			prev.querySelectorAll('.sr-chatbox__body-text').forEach(processBody);
		}
	}

	// ------------------------------------------------------------------
	// FPS (counts frames in which the game actually drew) and ping
	// ------------------------------------------------------------------
	// FPS = frames in which the game actually drew (original mod's approach). spkmodIsGameGl() includes the
	// change from DJTOMATO/SpeakiRPG PR #61: a renderer re-created by the game gets the "canvas" class.
	const fps = { value: 0, running: false };
	const ping = { value: null, last: 0, inflight: false, backoff: 0 };
	const spkmodFpsState = { enabled: false, drawn: false, frames: 0 };
	let lunFpsLastRenderedFrames = 0;
	let lunLastFrameTime = performance.now();

	function spkmodResetFpsBaseline() {
		lunLastFrameTime = performance.now();
		lunFpsLastRenderedFrames = spkmodFpsState.frames;
		spkmodFpsState.drawn = false;
	}

	document.addEventListener('visibilitychange', spkmodResetFpsBaseline);
	const spkmodGameGl = new WeakSet();

	function spkmodIsGameGl(gl) {
		if (spkmodGameGl.has(gl)) return true;
		const cl = gl.canvas && gl.canvas.classList;
		if (cl && (cl.contains('sr-game-canvas') || cl.contains('canvas'))) {
			spkmodGameGl.add(gl);
			return true;
		}
		return false;
	}

	(function installGameFpsHooks() {
		const methods = ['drawArrays', 'drawElements', 'drawRangeElements', 'drawArraysInstanced', 'drawElementsInstanced'];
		const prototypes = [
			window.WebGLRenderingContext && window.WebGLRenderingContext.prototype,
			window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype
		].filter(Boolean);

		for (const proto of new Set(prototypes)) {
			for (const name of methods) {
				const descriptor = Object.getOwnPropertyDescriptor(proto, name);
				if (!descriptor || typeof descriptor.value !== 'function') continue;

				const original = descriptor.value;
				if (original.__spkmodActualFpsHook) continue;

				const wrapped = function () {
					if (spkmodFpsState.enabled && spkmodIsGameGl(this)) {
						spkmodFpsState.drawn = true;
					}
					return original.apply(this, arguments);
				};
				wrapped.__spkmodActualFpsHook = true;

				try {
					Object.defineProperty(proto, name, { ...descriptor, value: wrapped });
				} catch (_) { /* ignore */ }
			}
		}
	})();

	function fpsLoop() {
		const now = performance.now();
		if (cfg.fpsPing !== spkmodFpsState.enabled) {
			spkmodFpsState.enabled = cfg.fpsPing;
			spkmodResetFpsBaseline();
		}
		if (!cfg.fpsPing) { fps.running = false; return; }

		if (spkmodFpsState.drawn) {
			spkmodFpsState.frames++;
			spkmodFpsState.drawn = false;
		}
		if (now - lunLastFrameTime >= 1000) {
			fps.value = Math.round((spkmodFpsState.frames - lunFpsLastRenderedFrames) * 1000 / (now - lunLastFrameTime));
			lunFpsLastRenderedFrames = spkmodFpsState.frames;
			lunLastFrameTime = now;
			pingTick();
		}
		requestAnimationFrame(fpsLoop);
	}

	function applyFps() {
		if (cfg.fpsPing && !fps.running) {
			fps.running = true;
			spkmodFpsState.enabled = true;
			spkmodResetFpsBaseline();
			requestAnimationFrame(fpsLoop);
		}
	}

	// no-cors GET: the response is opaque (so no CORS headers needed), but its timing is still the RTT.
	async function pingTick() {
		const now = performance.now();
		if (ping.inflight || now < ping.backoff || document.hidden || now - ping.last < 5000) return;
		ping.inflight = true;
		const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
		const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : 0;
		const t0 = performance.now();
		try {
			await fetch(`${pingOrigin}/health/live`, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctl ? ctl.signal : undefined });
			const ms = performance.now() - t0;
			ping.value = ping.value === null ? Math.round(ms) : Math.round(ms * 0.6 + ping.value * 0.4);
			ping.last = performance.now();
		} catch (_) {
			ping.backoff = performance.now() + 5000;
		} finally {
			clearTimeout(timer);
			ping.inflight = false;
		}
	}


	// ------------------------------------------------------------------
	// EXP tracker — ported from original SpeakiMod.js
	// ------------------------------------------------------------------
	var lunExpTrackerStartExp = 0;
	var lunExpTrackerSpeed = 0;
	var lunExpTrackerInitialized = false;
	var lunExpTrackerSamples = [];
	var lunExpTrackerLastSampleTick = 0;

	const expState = {
		name: null,
		rate: 0,
		level: null,
		remaining: null,
		ready: false
	};

	function resetExp() {
		lunExpTrackerInitialized = false;
		lunExpTrackerSamples = [];
		lunExpTrackerLastSampleTick = 0;
		window.lunExpTrackerIgnoredExp = 0;
		window.lunExpTrackerLastRawExp = undefined;

		expState.rate = 0;
		expState.remaining = null;
		expState.ready = false;
	}

	function expPoll() {
		const gs = window.gameState;
		const st = gs && gs.myStat;
		if (!st || typeof st.exp !== 'number' || isNaN(st.exp)) return;

		const name = st.name || gs.myPlayerName || null;
		if (expState.name !== null && name !== expState.name) resetExp();
		expState.name = name;

		const playerExp = st.exp;
		const maxExp = st.maxExp;
		const level = st.level;
		const now = Date.now();
		const windowSec = cfg.expWindow * 60;

		if (window.lunExpTrackerLastRawExp === undefined) {
			window.lunExpTrackerLastRawExp = playerExp;
			window.lunExpTrackerLastMaxExp = maxExp;
		}

		let trueGainedThisFrame = playerExp - window.lunExpTrackerLastRawExp;
		
		if (trueGainedThisFrame < 0) {
			// Leveled up!
			trueGainedThisFrame = (window.lunExpTrackerLastMaxExp - window.lunExpTrackerLastRawExp) + playerExp;
		}

		if (trueGainedThisFrame > 20000) {
			window.lunExpTrackerIgnoredExp = (window.lunExpTrackerIgnoredExp || 0) + trueGainedThisFrame;
		}

		window.lunExpTrackerLastRawExp = playerExp;
		window.lunExpTrackerLastMaxExp = maxExp;

		const currentEffectiveExp = playerExp - (window.lunExpTrackerIgnoredExp || 0);

		if (!lunExpTrackerInitialized) {
			lunExpTrackerSamples = [{ time: now, exp: currentEffectiveExp }];
			lunExpTrackerStartExp = playerExp;
			lunExpTrackerLastSampleTick = now;
			lunExpTrackerInitialized = true;
		} else {
			const lastSampleExp = lunExpTrackerSamples[ lunExpTrackerSamples.length - 1 ].exp;
			if (lastSampleExp > currentEffectiveExp) {
				resetExp();
				lunExpTrackerSamples = [{ time: now, exp: playerExp }];
				lunExpTrackerStartExp = playerExp;
				lunExpTrackerLastSampleTick = now;
				lunExpTrackerInitialized = true;
			} else {
				if (now - lunExpTrackerLastSampleTick >= 1000) {
					lunExpTrackerSamples.push({ time: now, exp: currentEffectiveExp });
					lunExpTrackerLastSampleTick = now;
				}
			}
		}

		const windowMs = windowSec * 1000;
		const cutoffTime = now - windowMs;

		while (lunExpTrackerSamples.length > 1 && lunExpTrackerSamples[1].time <= cutoffTime) {
			lunExpTrackerSamples.shift();
		}

		const oldestSample = lunExpTrackerSamples[0];
		const elapsedSec = oldestSample ? Math.max(1, (now - oldestSample.time) / 1000) : 1;
		const expGained = oldestSample ? Math.max(0, currentEffectiveExp - oldestSample.exp) : 0;
		const divisor = windowSec;

		lunExpTrackerSpeed = divisor > 0 ? expGained / divisor : 0;

		// SpeakiLite HUD connection
		expState.rate = lunExpTrackerSpeed;
		expState.level = typeof level === 'number' ? level : null;

		expState.remaining = lunExpTrackerSpeed > 0 ? (maxExp - playerExp) / lunExpTrackerSpeed : null;
		expState.ready = lunExpTrackerInitialized;
	}

	function fmtNum(n) {
		n = Math.round(n);
		if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
		return String(n);
	}

	// ------------------------------------------------------------------
	// Blocked users: hide character, emotes, voice, chat bubbles and hearts
	// (port of the desktop mod's behaviour; the list comes from the game's own /api/block)
	// ------------------------------------------------------------------
	const blk = { names: new Set(), ids: new Map(), local: new Set(), localAt: 0, token: '', loaded: false, nextFetchAt: 0, anyHid: false, enabled: LS.get('block', '1') === '1' };
	const normName = n => (typeof n === 'string' ? n.trim().toLocaleLowerCase() : '');

	function refreshLocalBlocked() {
		const now = Date.now();
		if (now - blk.localAt < 3000) return;
		blk.localAt = now;
		try {
			const stored = JSON.parse(localStorage.getItem('sr1_blocked_players') || '[]');
			blk.local = new Set(Array.isArray(stored) ? stored.map(normName).filter(Boolean) : []);
		} catch (_) { blk.local = new Set(); }
	}

	function isBlockedUser(name) {
		const c = normName(name);
		return !!c && (blk.names.has(c) || blk.local.has(c));
	}

	function authFromArgs(args) {
		try {
			let hd = args[1] && args[1].headers;
			if (!hd && args[0] && typeof args[0] === 'object') hd = args[0].headers;
			if (!hd) return '';
			if (typeof hd.get === 'function') return hd.get('Authorization') || hd.get('authorization') || '';
			if (Array.isArray(hd)) { const e = hd.find(x => String(x[0]).toLowerCase() === 'authorization'); return e ? String(e[1]) : ''; }
			return hd.Authorization || hd.authorization || '';
		} catch (_) { return ''; }
	}

	function blockSniffRequest(args) {
		const auth = authFromArgs(args);
		if (auth && /^bearer /i.test(auth) && auth !== blk.token) { blk.token = auth; blk.nextFetchAt = 0; }
	}

	function applyBlockData(data) {
		if (data && Array.isArray(data.blocks)) {
			blk.names.clear(); blk.ids.clear();
			for (const b of data.blocks) {
				const n = normName(b && b.nickname);
				if (!n) continue;
				blk.names.add(n);
				if (b.blockId !== undefined && b.blockId !== null) blk.ids.set(String(b.blockId), n);
			}
			blk.loaded = true;
		} else if (data && typeof data.nickname === 'string') {
			const n = normName(data.nickname);
			if (n) { blk.names.add(n); if (data.blockId !== undefined && data.blockId !== null) blk.ids.set(String(data.blockId), n); }
		}
		updateBlockedVisibility();
	}

	function blockSniffResponse(args, url, promise) {
		let method = 'GET';
		try {
			if (args[1] && args[1].method) method = args[1].method;
			else if (args[0] && args[0].method) method = args[0].method;
		} catch (_) { /* ignore */ }
		method = String(method).toUpperCase();
		promise.then(res => {
			if (method === 'DELETE') {
				const bId = url.split('?')[0].split('/').pop();
				if (blk.ids.has(bId)) { blk.names.delete(blk.ids.get(bId)); blk.ids.delete(bId); updateBlockedVisibility(); }
				blk.nextFetchAt = Date.now() + 1500; // re-sync shortly after
				return null;
			}
			return res.clone().json().then(applyBlockData);
		}).catch(() => { /* never disturb the game's own request */ });
	}

	function getAuthHeader() {
		try {
			if (typeof window.getNativeAuthToken === 'function') {
				let t = window.getNativeAuthToken();
				if (t) { t = String(t); return /^bearer /i.test(t) ? t : 'Bearer ' + t; }
			}
		} catch (_) { /* ignore */ }
		return blk.token;
	}

	async function fetchBlocklist() {
		const auth = getAuthHeader();
		if (!auth) return;
		blk.nextFetchAt = Date.now() + 120000; // periodic re-sync
		try {
			const res = await window.fetch(`${pingOrigin}/api/block`, { method: 'GET', cache: 'no-store', headers: { Authorization: auth } });
			if (res.ok) applyBlockData(await res.json());
		} catch (_) { blk.nextFetchAt = Date.now() + 10000; }
	}

	function remotePlayerMap() {
		const rp = window.gameState && window.gameState.remotePlayers;
		const m = rp && rp.remotePlayers;
		return m && typeof m.forEach === 'function' ? m : null;
	}

	function updateBlockedVisibility() {
		if (!blk.enabled && !blk.anyHid) return;
		const m = remotePlayerMap();
		if (!m) return;
		let hid = false;
		m.forEach(pl => {
			const c = pl && pl.container;
			if (!c) return;
			if (blk.enabled && isBlockedUser(pl.info && pl.info.name)) {
				if (c.visible !== false) c.visible = false;
				pl.__spklHid = true; hid = true;
			} else if (pl.__spklHid) { // only undo what we did
				c.visible = true; pl.__spklHid = false;
			}
		});
		blk.anyHid = hid;
	}

	function blockTick() {
		if (!blk.anyHid && (!blk.enabled || (blk.names.size === 0 && blk.local.size === 0))) return;
		updateBlockedVisibility();
	}

	function findRemotePlayer(playerId) {
		const m = remotePlayerMap();
		if (!m) return null;
		let p = typeof m.get === 'function' ? (m.get(playerId) || m.get(Number(playerId)) || m.get(String(playerId))) : null;
		if (p) return p;
		let found = null;
		m.forEach(item => { if (!found && item && item.info && item.info.playerId == playerId) found = item; });
		return found;
	}

	const playerBlocked = pl => !!(blk.enabled && pl && isBlockedUser((pl.info && pl.info.name) || pl.name));

	function containerOwnerBlocked(container) {
		const m = remotePlayerMap();
		if (!container || !m) return false;
		const players = []; m.forEach(pl => players.push(pl));
		for (let cur = container; cur; cur = cur.parent) {
			for (const pl of players) if (pl && pl.container === cur) return playerBlocked(pl);
		}
		return false;
	}

	function bubbleSourceBlocked(src) {
		if (!src || !blk.enabled) return false;
		if (containerOwnerBlocked(src) || containerOwnerBlocked(src.container)) return true;
		if (isBlockedUser(src.info && src.info.name) || isBlockedUser(src.name)) return true;
		const m = remotePlayerMap();
		let hit = false;
		if (m) m.forEach(pl => { const i = pl && pl.info; if (i && (src === i.playerId || src === i.id || src === i.userId) && isBlockedUser(i.name)) hit = true; });
		return hit;
	}

	function hookBlockFeatures() {
		const gs = window.gameState;
		if (!gs) return;
		if (!gs.__spklBlockVoice) {
			if (typeof gs.handleEmote === 'function') {
				const orig = gs.handleEmote;
				gs.handleEmote = function (e) {
					// suppress animation, voice line and sound for blocked users
					if (e && e.playerId !== this.myPlayerId && playerBlocked(findRemotePlayer(e.playerId))) return;
					return orig.apply(this, arguments);
				};
			}
			if (typeof gs.remoteSoundDistance === 'function') {
				const orig = gs.remoteSoundDistance;
				gs.remoteSoundDistance = function (pos) {
					const m = blk.enabled && pos ? remotePlayerMap() : null;
					if (m) {
						let muted = false;
						m.forEach(pl => {
							if (muted || !playerBlocked(pl)) return;
							const c = pl.container && pl.container.position;
							if (c === pos || (c && Math.hypot(c.x - pos.x, c.z - pos.z) < 0.1)) muted = true;
						});
						if (muted) return 999999; // far away => volume 0
					}
					return orig.apply(this, arguments);
				};
			}
			gs.__spklBlockVoice = true;
		}
		const bub = gs.chatBubbles;
		if (bub && typeof bub.show === 'function' && !bub.__spklBlock) {
			const orig = bub.show.bind(bub);
			bub.show = (src, ...rest) => (bubbleSourceBlocked(src) ? undefined : orig(src, ...rest));
			bub.__spklBlock = true;
		}
		const be = gs.bloomEffects;
		if (be && typeof be.spawnHearts === 'function' && !be.__spklBlock) {
			const orig = be.spawnHearts.bind(be);
			be.spawnHearts = (container, ...rest) => (blk.enabled && containerOwnerBlocked(container) ? undefined : orig(container, ...rest));
			be.__spklBlock = true;
		}
	}

	function blockEnsure() {
		refreshLocalBlocked();
		hookBlockFeatures();
		if (Date.now() >= blk.nextFetchAt && getAuthHeader()) fetchBlocklist();
	}

	// ------------------------------------------------------------------
	// Resolution override: same contract as the desktop mod. The upstream injector patches the game's
	// pixel-ratio function to read window.spkmodResolutionOverride on every call, so changing it and
	// firing "resize" applies immediately - no reload.
	// ------------------------------------------------------------------
	const RES_KEY = 'spkmod-resolution-override';
	function getResolutionOverride() {
		try { const v = parseFloat(localStorage.getItem(RES_KEY)); return v >= 1 && v <= 3.5 ? v : 1; } catch (_) { return 1; }
	}
	function applyResolutionOverride(value) {
		const v = value >= 1 && value <= 3.5 ? value : 1;
		window.spkmodResolutionOverride = v;
		try { localStorage.setItem(RES_KEY, String(v)); } catch (_) { /* ignore */ }
		try { window.dispatchEvent(new Event('resize')); } catch (_) { /* ignore */ }
	}

	// ------------------------------------------------------------------
	// Diagnostics (shown in the settings panel, so problems can be reported without a PC)
	// ------------------------------------------------------------------
	function diagnostics() {
		const c = document.querySelector('canvas.sr-game-canvas') || document.querySelector('canvas.canvas') || document.querySelector('canvas');
		const mobile = !!(document.body && document.body.classList.contains('sr-mobile-layout'));
		let l1 = `layout: ${mobile ? 'mobile' : 'PC'} | override: ${window.spkmodResolutionOverride === undefined ? '-' : window.spkmodResolutionOverride}`;
		if (c) l1 += ` | canvas ${c.width}×${c.height} (CSS ${c.clientWidth}×${c.clientHeight} = ${(c.width / Math.max(1, c.clientWidth)).toFixed(2)}×, DPR ${(window.devicePixelRatio || 1).toFixed(2)})`;
		const counts = PACKS.map(pk => Object.keys(emoji.packs[pk.id]).length).join('/');
		return [
			l1,
			glDiagnostics(),
			`emoji: ${counts}${emoji.lastError ? ' | err: ' + emoji.lastError : ''} | button: ${document.getElementById('spkmod-emoji-btn') ? 'yes' : 'no'} | input: ${findChatInput() ? 'yes' : 'no'}`,
			`block: ${blk.names.size + blk.local.size} | token: ${getAuthHeader() ? 'yes' : 'no'} | loaded: ${blk.loaded}`,
			`injector: v${window.speakiInjectorVer || '-'} | native bridge: ${window.SpeakiLocalAI ? 'yes' : 'no'}`,
		].join('\n');
	}

	// ------------------------------------------------------------------
	// HUD
	// ------------------------------------------------------------------
	const hud = { el: null, l1: null, l2: null, l3: null };

	function buildHud() {
		hud.l1 = h('div', { class: 'spkl-l' });
		hud.l2 = h('div', { class: 'spkl-l' });
		hud.l3 = h('div', { class: 'spkl-l' });
		hud.el = h('div', { id: 'spkl-hud' }, h('span', { class: 'spkl-gear' }, '⚙'), hud.l1, hud.l2, hud.l3);
		shield(hud.el);
		const pos = LS.getJSON('hud-pos', { x: 6, y: 6 });
		hud.el.style.left = pos.x + 'px';
		hud.el.style.top = pos.y + 'px';

		let drag = null;
		hud.el.addEventListener('pointerdown', e => {
			drag = { sx: e.clientX, sy: e.clientY, ox: hud.el.offsetLeft, oy: hud.el.offsetTop, moved: false };
			try { hud.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
		});
		hud.el.addEventListener('pointermove', e => {
			if (!drag) return;
			const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
			if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
			if (drag.moved) {
				hud.el.style.left = clamp(drag.ox + dx, 0, Math.max(0, innerWidth - hud.el.offsetWidth)) + 'px';
				hud.el.style.top = clamp(drag.oy + dy, 0, Math.max(0, innerHeight - hud.el.offsetHeight)) + 'px';
			}
		});
		const end = e => {
			if (!drag) return;
			if (drag.moved) LS.setJSON('hud-pos', { x: hud.el.offsetLeft, y: hud.el.offsetTop });
			else if (e.type === 'pointerup') toggleSettings();
			drag = null;
		};
		hud.el.addEventListener('pointerup', end);
		hud.el.addEventListener('pointercancel', end);
		addEventListener('resize', () => {
			if (!hud.el) return;
			hud.el.style.left = clamp(hud.el.offsetLeft, 0, Math.max(0, innerWidth - hud.el.offsetWidth)) + 'px';
			hud.el.style.top = clamp(hud.el.offsetTop, 0, Math.max(0, innerHeight - hud.el.offsetHeight)) + 'px';
		});
		document.body.appendChild(hud.el);
	}

	function updateHud() {
		if (!hud.el) return;
		hud.l1.style.display = cfg.fpsPing ? '' : 'none';
		if (cfg.fpsPing) hud.l1.textContent = `${fps.value} FPS | ${ping.value === null ? '--' : ping.value}ms`;

		const hasExp = cfg.exp && expState.level !== null;
		hud.l2.style.display = hud.l3.style.display = hasExp ? '' : 'none';
		if (!hasExp) return;
		if (!expState.ready) {
			hud.l2.textContent = T('expMeasuring');
			hud.l3.textContent = T('nextNA', expState.level);
			return;
		}
		const rate = cfg.expPerHour ? expState.rate * 3600 : expState.rate * 60;
		hud.l2.textContent = T(cfg.expPerHour ? 'expHour' : 'expMin', fmtNum(rate));
		const rem = expState.remaining;
		if (rem === null || !isFinite(rem) || rem < 0) hud.l3.textContent = T('nextNA', expState.level);
		else if (rem >= 3600) hud.l3.textContent = T('nextHour', expState.level, (rem / 3600).toFixed(1));
		else hud.l3.textContent = T('nextMin', expState.level, Math.max(1, Math.round(rem / 60)));
	}

	// ------------------------------------------------------------------
	// Settings panel
	// ------------------------------------------------------------------
	const settings = { el: null, diag: null };

	function applyUiScale(v) {
		cfg.uiScale = v >= 0.7 && v <= 1.6 ? v : 1;
		LS.set('ui-scale', cfg.uiScale);
		try { document.documentElement.style.setProperty('--spkl-s', String(cfg.uiScale)); } catch (_) { /* ignore */ }
		if (hud.el) window.dispatchEvent(new Event('resize')); // re-clamp the HUD into the viewport
	}

	function setUiLang(pref) {
		uiLangPref = pref; LS.set('ui-lang', pref); LANG = resolveLang(pref);
		const btn = document.getElementById('spkmod-emoji-btn'); if (btn) btn.title = T('emojiTitle');
		if (lunEmojiPickerPanel) renderEmojiGrid();
		updateHud();
		rebuildSettings();
	}

	function rebuildSettings() {
		if (!settings.el) return;
		const body = settings.el.querySelector('.spkl-set-body');
		const top = body ? body.scrollTop : 0;
		settings.el.remove(); settings.el = null;
		toggleSettings();
		const nb = settings.el && settings.el.querySelector('.spkl-set-body');
		if (nb) nb.scrollTop = top;
	}

	function toggleSettings() {
		if (settings.el) { settings.el.remove(); settings.el = null; return; }
		const check = (label, checked, onChange) => h('label', { class: 'spkl-row' }, h('input', { type: 'checkbox', checked, onchange: e => onChange(e.target.checked) }), h('span', null, label));
		const select = (label, options, value, onChange) => h('label', { class: 'spkl-row' }, h('span', null, label),
			h('select', { onchange: e => onChange(e.target.value) }, options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t))));
		const fmtRes = v => (v <= 1 ? T('resolutionOff') : '×' + v.toFixed(2));

		const cur = getResolutionOverride();
		const resVal = h('span', { class: 'spkl-val' }, fmtRes(cur));
		const resInput = h('input', { type: 'range', min: '1', max: '3.5', step: '0.05', value: String(cur), class: 'spkl-range' });
		resInput.addEventListener('input', () => { resVal.textContent = fmtRes(parseFloat(resInput.value)); });
		resInput.addEventListener('change', () => { applyResolutionOverride(parseFloat(resInput.value)); settings.diag.textContent = diagnostics(); });
		const scaleVal = h('span', { class: 'spkl-val' }, '×' + cfg.uiScale.toFixed(2));
		const scaleInput = h('input', { type: 'range', min: '0.7', max: '1.6', step: '0.05', value: String(cfg.uiScale), class: 'spkl-range' });
		scaleInput.addEventListener('input', () => { scaleVal.textContent = '×' + parseFloat(scaleInput.value).toFixed(2); });
		scaleInput.addEventListener('change', () => applyUiScale(parseFloat(scaleInput.value)));
		const scaleRow = h('div', { class: 'spkl-col' }, h('div', { class: 'spkl-rowtop' }, h('span', null, T('uiScale')), scaleVal), scaleInput);
		const resRow = h('div', { class: 'spkl-col' }, h('div', { class: 'spkl-rowtop' }, h('span', null, T('resolution')), resVal), resInput);

		settings.diag = h('pre', { class: 'spkl-gl' }, diagnostics());

		settings.el = h('div', { id: 'spkl-settings' },
			h('div', { class: 'spkl-set-head' }, h('b', null, T('settings')), h('button', { type: 'button', class: 'spkl-mini', title: T('close'), onclick: toggleSettings }, '✕')),
			h('div', { class: 'spkl-set-body' },
				select(T('uiLang'), UI_LANGS, uiLangPref, v => setUiLang(v)),
				scaleRow,

				h('h4', null, T('secDisplay')),
				check(T('fpsPing'), cfg.fpsPing, v => { cfg.fpsPing = v; LS.set('fps-ping', v ? 1 : 0); applyFps(); updateHud(); }),
				check(T('expTracker'), cfg.exp, v => { cfg.exp = v; LS.set('exp', v ? 1 : 0); updateHud(); }),
				check(T('expPerHour'), cfg.expPerHour, v => { cfg.expPerHour = v; LS.set('exp-hour', v ? 1 : 0); resetExp(); updateHud(); }),
				select(T('expWindow'), EXP_WINDOWS.map(n => [n, String(n)]), cfg.expWindow, v => { cfg.expWindow = parseInt(v, 10); LS.set('exp-window', v); resetExp(); updateHud(); }),
				h('button', { type: 'button', class: 'spkl-btn', onclick: () => { resetExp(); updateHud(); } }, T('expReset')),

				h('h4', null, T('secTranslate')),
				check(T('trAuto'), cfg.translate, v => { cfg.translate = v; LS.set('tr', v ? 1 : 0); if (v) toast(T('trDownloading'), 2600); }),
				select(T('trTarget'), TRANSLATE_TARGETS, cfg.trTarget, v => { cfg.trTarget = v; LS.set('tr-target', v); }),
				h('p', { class: 'spkl-hint' }, T('trHint')),

				h('h4', null, T('secBlock')),
				check(T('blockHide'), blk.enabled, v => { blk.enabled = v; LS.set('block', v ? 1 : 0); updateBlockedVisibility(); }),
				h('p', { class: 'spkl-hint' }, T('blockHint')),

				h('h4', null, T('secGraphics')),
				resRow,
				h('p', { class: 'spkl-hint' }, T('resolutionHint')),
				check(T('aaOff'), cfg.aaOff, v => { cfg.aaOff = v; LS.set('aa-off', v ? 1 : 0); }),
				h('p', { class: 'spkl-hint' }, T('aaHint')),
				h('button', { type: 'button', class: 'spkl-btn', onclick: () => location.reload() }, T('applyReload')),

				h('div', { class: 'spkl-glhead' }, h('span', null, T('secDiag')), h('button', { type: 'button', class: 'spkl-mini', onclick: () => { settings.diag.textContent = diagnostics(); } }, T('glRefresh'))),
				settings.diag,
				h('p', { class: 'spkl-hint' }, `SpeakiLite ${VERSION}`)));
		shield(settings.el);
		document.body.appendChild(settings.el);
	}

	// ------------------------------------------------------------------
	// Styles
	// ------------------------------------------------------------------
	// All sizes are in em, relative to a per-widget base font-size multiplied by --spkl-s (the "UI size" setting).
	const CSS = `
#spkl-hud,#spkl-settings,#spkl-toast{box-sizing:border-box}
#spkl-hud *,#spkl-settings *{box-sizing:border-box}
#spkl-hud{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:.09em;padding:.27em .64em;border-radius:.64em;background:rgba(10,14,22,.62);color:#e8eefc;font-family:system-ui,sans-serif;font-weight:600;font-size:calc(var(--spkl-s,1)*11px);line-height:1.25;touch-action:none;user-select:none;-webkit-user-select:none;white-space:nowrap;text-shadow:0 1px 2px #000}
#spkl-hud .spkl-gear{position:absolute;right:.36em;top:.09em;opacity:.55;font-size:1em}
#spkl-hud .spkl-l{padding-right:1.1em}
#spkl-toast{position:fixed;z-index:2147483600;left:50%;top:.8em;transform:translateX(-50%);max-width:80vw;padding:.5em 1em;border-radius:999px;background:rgba(10,14,22,.9);color:#fff;font-family:system-ui,sans-serif;font-weight:600;font-size:calc(var(--spkl-s,1)*12px);opacity:0;transition:opacity .25s;pointer-events:none;text-align:center}
.spkl-emoji img{height:1.6em;vertical-align:middle;padding:0 1px;display:inline-block}
.sr-chatbox__body-text.spkl-translated{color:#ffd54a!important;-webkit-text-fill-color:#ffd54a!important}
#spkl-settings{position:fixed;z-index:2147483550;left:50%;top:50%;transform:translate(-50%,-50%);width:min(27.7em,calc(100vw - 1.2em));max-height:calc(100% - 1.2em);display:flex;flex-direction:column;border-radius:.92em;background:rgba(18,20,28,.97);border:1px solid #4a5163;box-shadow:0 8px 28px rgba(0,0,0,.6);color:#f2f5ff;font-family:system-ui,sans-serif;font-size:calc(var(--spkl-s,1)*13px);line-height:1.35}
.spkl-set-head{display:flex;justify-content:space-between;align-items:center;padding:.6em .77em;border-bottom:1px solid #394055}
.spkl-set-body{overflow-y:auto;padding:.3em .92em .92em;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;min-height:0}
.spkl-set-body h4{margin:.92em 0 .3em;font-size:.92em;color:#9fb4ff;letter-spacing:.02em}
.spkl-row{display:flex;align-items:center;justify-content:space-between;gap:.77em;padding:.38em 0}
.spkl-row select{max-width:55%;background:#232837;color:#fff;border:1px solid #4a5163;border-radius:.46em;padding:.3em;font-size:1em}
.spkl-row input[type=checkbox]{order:2;width:1.54em;height:1.54em;flex:none}
.spkl-col{padding:.38em 0}.spkl-rowtop{display:flex;justify-content:space-between;margin-bottom:.15em}.spkl-val{color:#9fb4ff;font-weight:600}.spkl-range{width:100%;accent-color:#38bdf8}
.spkl-btn{margin:.46em 0;padding:.54em .77em;border:0;border-radius:.54em;background:#3d5afe;color:#fff;font-weight:600;font-size:1em}
.spkl-hint{margin:.3em 0;color:#98a2bd;font-size:.85em}
.spkl-glhead{display:flex;justify-content:space-between;align-items:center;margin-top:.6em;color:#9fb4ff;font-size:.92em}
.spkl-gl{margin:.3em 0;padding:.46em;border-radius:.46em;background:#0d1019;color:#b9c4e6;font:.77em/1.35 ui-monospace,monospace;white-space:pre-wrap;word-break:break-all}
`;

	// ------------------------------------------------------------------
	// Init
	// ------------------------------------------------------------------
	function init() {
		document.head.appendChild(h('style', { id: 'spkl-style' }, CSS));
		loadEmojiCaches();
		refreshEmojiCatalogs();
		applyUiScale(cfg.uiScale);
		installChatEmojiContextMenu();
		buildHud();
		applyFps();
		updateHud();

		// Poll instead of observing the whole DOM: the game's HUD mutates constantly.
		if (typeof window.spkmodResolutionOverride === 'undefined') window.spkmodResolutionOverride = getResolutionOverride();
		setInterval(() => {
			hookChatBox();
			ensureChatObserver();
			hookChatEmojiButton();
			blockEnsure();
		}, 1000);
		setInterval(blockTick, 50);
		setInterval(expPoll, 50);
		setInterval(updateHud, 1000);
	}

	// handy for debugging from chrome://inspect
	window.__speakiLite.debug = { cfg, expState, fps, spkmodFpsState, ping, emoji, blk, cacheGet, cacheSet, lunTranslateCache, glDiagnostics, diagnostics, translateText, applyResolutionOverride, applyUiScale };

	// Kick off last, so every binding above is initialised even if the document is already parsed.
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startLite, { once: true });
	else startLite();
})();
