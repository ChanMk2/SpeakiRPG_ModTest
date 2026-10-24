try {
    // Sanitize native audio settings early before i18n/game bundle boots
    const s = localStorage.getItem("sr1_settings");
    if (s) {
        const p = JSON.parse(s);
        if (p && p.muteAll) {
            p.muteAll = false;
            localStorage.setItem("sr1_settings", JSON.stringify(p));
        }
    }
} catch (_) {}

try {
    const isMobile =
        typeof window.speakiMobile !== "undefined" ||
        (typeof navigator !== "undefined" &&
            /mobi|android|iphone|ipad|ipod/i.test(
                navigator.userAgent || ""
            )) ||
        (typeof window.matchMedia === "function" &&
            window.matchMedia("(pointer: coarse)").matches &&
            navigator.maxTouchPoints > 0);

    if (!isMobile) {
        window.spkmodResolutionOverride = 1;
        try {
            localStorage.removeItem("spkmod-resolution-override");
        } catch (_) {}
    } else {
        const v = parseFloat(
            localStorage.getItem("spkmod-resolution-override")
        );

        window.spkmodResolutionOverride =
            v >= 1 && v <= 3 ? v : 1;
    }
} catch (_) {
    window.spkmodResolutionOverride = 1;
}


// ============================================================
// SpeakiMod injection
// ============================================================

window.injectSpeakiMod = () => {
    if (window.__speakiModInjected) {
        if (typeof window.__speakiInitInGame === "function") {
            window.__speakiInitInGame();
        }
        return;
    }

    window.__speakiModInjected = true;

    setTimeout(async () => {
        try {
            const modCode = await (
                await fetch(
                    "https://raw.githubusercontent.com/ChanMk2/SpeakiRPG_ModTest/refs/heads/main/SpeakiMod.js?t=" +
                    Date.now()
                )
            ).text();

            const blob = URL.createObjectURL(
                new Blob(
                    [modCode],
                    { type: "text/javascript" }
                )
            );

            const inj = document.createElement("script");
            inj.type = "module";
            inj.crossOrigin = "";
            inj.src = blob;

            document.head.appendChild(inj);
        } catch (e) {
            console.error(
                "[SpeakiMod] Failed to inject SpeakiMod.js:",
                e
            );
        }
    }, 100);
};


// ============================================================
// Game source patch
// ============================================================

async function patchScript(og, src) {
    og.type = "text/speakimod";
    og.removeAttribute("src");
    og.remove();

    let code = await (await fetch(src)).text();

    // --------------------------------------------------------
    // DIRECT SOURCE REPLACEMENT
    //
    // 메인 번들의 createRenderer() 안에서
    //
    // t.setPixelRatio(_o()),
    // t.shadowMap.enabled=pU,
    // this.renderer=t}
    //
    // 부분을 직접 교체한다.
    //
    // AA 및 shadowMap 설정은 변경하지 않는다.
    // --------------------------------------------------------

    const rendererSourcePattern =
        /t\.setPixelRatio\(_o\(\)\),t\.shadowMap\.enabled=pU,this\.renderer=t\}/;

    if (rendererSourcePattern.test(code)) {
        code = code.replace(
            rendererSourcePattern,
            `t.setPixelRatio(_o()),t.shadowMap.enabled=pU,this.renderer=t;
window.__speakiSourceReplaceStatus="렌더러 소스 교체 삽입 완료";
window.__speakiBlobHookStatus="injector.js의 직접 소스 교체를 사용 중";
window.__speakiRendererV3=t;
window.__speakiGameObjectV3=this;
try{
    const __speakiOriginalRenderV3=t.render;

    if(typeof __speakiOriginalRenderV3==="function"){
        t.render=function(){
            window.__speakiRenderCallsV3=
                (window.__speakiRenderCallsV3||0)+1;

            const __speakiSceneArgV3=arguments[0];

            if(
                __speakiSceneArgV3 &&
                typeof __speakiSceneArgV3.traverse==="function"
            ){
                window.__speakiSceneHitsV3=
                    (window.__speakiSceneHitsV3||0)+1;

                window.__speakiSceneV3=__speakiSceneArgV3;
                window.__speakiCameraV3=arguments[1];
            }

            return __speakiOriginalRenderV3.apply(
                this,
                arguments
            );
        };

        window.__speakiRendererHookStatus=
            "게임 소스 직접 교체: render() 후킹 완료";
    }else{
        window.__speakiRendererHookStatus=
            "교체 코드는 실행됐지만 render()를 찾지 못함";
    }
}catch(__speakiRenderHookErrorV3){
    window.__speakiHookErrorV3=
        String(__speakiRenderHookErrorV3);

    window.__speakiRendererHookStatus=
        "렌더러 후킹 오류";
}
}`
        );

        window.__speakiSourceReplaceStatus =
            "메인 번들에서 렌더러 패턴을 찾아 교체 코드를 삽입함";

        window.__speakiRendererHookStatus =
            "교체 코드 삽입 완료; createRenderer() 실행 대기 중";

        console.log(
            "[SpeakiMod] Renderer source replacement inserted."
        );
    } else {
        window.__speakiSourceReplaceStatus =
            "실패: 현재 게임 소스에서 렌더러 패턴을 찾지 못함";

        window.__speakiRendererHookStatus =
            "실패: renderer source pattern not found";

        console.error(
            "[SpeakiMod] Renderer source pattern not found:",
            src
        );
    }


    // --------------------------------------------------------
    // 기존 모드 기능: Identify minified i18n function
    // --------------------------------------------------------

    const m_i18n = (
        code.match(
            /function (\w+?)\(e\)\s*\{\s*let \w+\s*=\s*\w+\[\w+\(\)\];\s*return Object\.prototype\.hasOwnProperty\.call\(\w+,\s*e\)\s*\?\s*\w+\[e\]\s*:/
        ) || []
    )[1] || "null";

    const m_settingsMatch = code.match(
        /case[\x60'"]muteAll[\x60'"]\s*:\s*(\w+)\(\{muteAll:!(\w+)\(\)\.muteAll\}\)/
    ) || [];

    const m_updateSettings = m_settingsMatch[1] || "null";
    const m_getSettings = m_settingsMatch[2] || "null";

    const m_listenerMatch = code.match(
        /function\s+(\w+)\((\w+)\)\{(\w+)=new \w+,\2\.add\(\3\)/
    ) || [];

    const m_vc = m_listenerMatch[3] || "null";

    const m_tokenMatch = code.match(
        /function (\w+)\(\)\{return \w+\}function \w+\(\w+\)\{\w+=\w+\.accessToken/
    ) || [];

    const m_getToken = m_tokenMatch[1] || "null";

    const m_refreshMatch = code.match(
        /function (\w+)\(\)\{if\(\w+\)return \w+;let \w+=\w+\(\)\.finally\(\(\)=>\{\w+=null\}/
    ) || [];

    const m_refreshToken = m_refreshMatch[1] || "null";


    // --------------------------------------------------------
    // Existing resolution override patch
    // --------------------------------------------------------

    code = code.replace(
        /function (\w+)\(\)\{let (\w+);if\((\w+)\(\)\)(\w+)=(\w+)\(\)\.resolutionScale;else\{let (\w+)=window\.devicePixelRatio;/,

        (_m, fn, e, isMobileLayout, e2, getSettings, dpr) =>
            `function ${fn}(){if(window.spkmodResolutionOverride>1&&${isMobileLayout}())return Math.min(window.spkmodResolutionOverride,4);let ${e};if(${isMobileLayout}())${e2}=${getSettings}().resolutionScale;else{let ${dpr}=window.devicePixelRatio;`
    );


    // --------------------------------------------------------
    // Existing relative asset import patch
    // --------------------------------------------------------

    code = code.replaceAll(
        /from\s*"\.\//g,
        'from "https://speakirpg.overture.io.kr/assets/'
    );


    // --------------------------------------------------------
    // Existing GameState and injector hooks
    // --------------------------------------------------------

    const reqChannelPattern =
        /connect\(([^)]*)\)\s*\{\s*this\.requestedChannel\s*=/;

    if (reqChannelPattern.test(code)) {
        code = code.replace(
            reqChannelPattern,

            `connect($1){
                window.speakiInjectorVer = 2;
                window.gameState = this;
                window.getAudioListener = () => ${m_vc};
                window.i18n = ${m_i18n};
                window.getGameSettings = ${m_getSettings};
                window.updateGameSettings = ${m_updateSettings};
                window.getNativeAuthToken = ${m_getToken};
                window.refreshAuthToken = ${m_refreshToken};
                this.requestedChannel=`
        );
    }

    const handleLoginPattern =
        /handleLogin\(([^)]*)\)\s*\{/;

    if (handleLoginPattern.test(code)) {
        code = code.replace(
            handleLoginPattern,

            `handleLogin($1){
                window.gameState = this;
                window.getAudioListener = () => ${m_vc};
                window.getGameSettings = ${m_getSettings};
                window.updateGameSettings = ${m_updateSettings};
                window.getNativeAuthToken = ${m_getToken};
                window.refreshAuthToken = ${m_refreshToken};

                if (typeof window.injectSpeakiMod === "function")
                    window.injectSpeakiMod();`
        );
    }

    code += `
try {
    window.getAudioListener = () => ${m_vc};
    window.getGameSettings = ${m_getSettings};
    window.updateGameSettings = ${m_updateSettings};
    window.getNativeAuthToken = ${m_getToken};
    window.refreshAuthToken = ${m_refreshToken};
} catch (_) {}
`;


    // --------------------------------------------------------
    // Execute patched game source
    // --------------------------------------------------------

    const blob = URL.createObjectURL(
        new Blob(
            [code],
            { type: "text/javascript" }
        )
    );

    const inj = document.createElement("script");
    inj.type = "module";
    inj.crossOrigin = "";
    inj.src = blob;

    document.head.appendChild(inj);

    // Early injection for pre-login features
    window.injectSpeakiMod();
}


// ============================================================
// Watch for the original game bundle and patch it
// ============================================================

const observer = new MutationObserver(muts => {
    for (const mut of muts) {
        for (const node of mut.addedNodes) {
            if (node.tagName?.toLowerCase() === "script") {
                const src = node.getAttribute("src");

                if (src?.includes("assets/index-")) {
                    patchScript(node, src);
                    observer.disconnect();
                    return;
                }
            }
        }
    }
});

observer.observe(
    document,
    {
        childList: true,
        subtree: true
    }
);

const existing = document.querySelector(
    'script[src*="/assets/index-"]'
);

if (existing) {
    const src = existing.getAttribute("src");

    if (src?.includes("assets/index-")) {
        patchScript(existing, src);
        observer.disconnect();
    }
}