// Handlers accept both metaKey and ctrlKey; only the visible hint differs by platform.
export const isMacPlatform=(nav=globalThis.navigator)=>/mac|iphone|ipad/i.test(nav?.userAgentData?.platform||nav?.platform||'');
// "⌘/Ctrl+…" hints are already explicit and stay unchanged.
export const shortcutLabel=(text,mac=isMacPlatform())=>mac?text:text.replace(/⇧⌘/g,'Ctrl+Shift+').replace(/⌘(?!\/)/g,'Ctrl+');
