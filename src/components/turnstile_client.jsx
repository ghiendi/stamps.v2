// Widget Turnstile phía client (Cloudflare) — bản FIX:
// - Chỉ render đúng 1 widget (chống double-mount ở React StrictMode)
// - Ổn định callback qua ref (tránh re-render tạo widget mới)
// - Cleanup remove() khi unmount
// - Không dùng class "cf-turnstile" để tránh auto-render trùng lặp

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

function ensure_turnstile_script() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cf-turnstile-script')) return;
  const s = document.createElement('script');
  s.id = 'cf-turnstile-script';
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  document.head.appendChild(s);
}

export default forwardRef(function Turnstile_client({ site_key, on_token }, ref) {
  const container_ref = useRef(null);        // (vi) thẻ div nơi render widget
  const widget_id_ref = useRef(null);        // (vi) id widget hiện tại
  const on_token_ref = useRef(on_token);     // (vi) giữ callback mới nhất
  on_token_ref.current = on_token;

  useImperativeHandle(ref, () => ({
    // (vi) Cho phép parent reset thủ công sau mỗi lần submit
    reset_turnstile: () => {
      try { globalThis.turnstile?.reset(widget_id_ref.current); } catch (_) { }
    },
  }));

  useEffect(() => {
    ensure_turnstile_script();

    let cancelled = false;
    let poll_id = null;

    const render_once = () => {
      if (cancelled) return;
      // (vi) Tránh render lại nếu đã có widget
      if (widget_id_ref.current !== null) return;

      if (!globalThis.turnstile || !container_ref.current) {
        poll_id = setTimeout(render_once, 50);
        return;
      }

      // (vi) Render explicit, truyền callback ổn định
      const id = globalThis.turnstile.render(container_ref.current, {
        sitekey: site_key,
        callback: (tok) => on_token_ref.current?.(tok),
        'expired-callback': () => { try { globalThis.turnstile.reset(id); } catch (_) { } },
        'error-callback': () => { try { globalThis.turnstile.reset(id); } catch (_) { } },
      });
      widget_id_ref.current = id;
    };

    render_once();

    return () => {
      cancelled = true;
      if (poll_id) clearTimeout(poll_id);
      // (vi) Cleanup — remove widget khi unmount (chống double-mount StrictMode)
      try { globalThis.turnstile?.remove(widget_id_ref.current); } catch (_) { }
      widget_id_ref.current = null;
    };
    // (vi) Chỉ phụ thuộc site_key; không phụ thuộc on_token để tránh render lại
  }, [site_key]);

  // (vi) KHÔNG gán class "cf-turnstile" — tránh auto-render thêm widget
  return <div ref={container_ref} />;
});
