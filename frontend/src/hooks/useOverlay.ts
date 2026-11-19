import { useEffect, useRef } from "react";
import { useIsMobile } from "./useIsMobile";

// Пока открыта панель поверх страницы, сама страница не прокручивается.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

// На телефоне системная «назад» должна закрывать панель, а не уводить со
// страницы: при открытии кладём в историю запись-заглушку с тем же адресом.
// Закрыли крестиком или фоном — убираем заглушку сами; ушли по ссылке из
// панели — заглушку не трогаем, иначе откатили бы переход.
export function useBackClose(active: boolean, onClose: () => void) {
  const mobile = useIsMobile();
  const handler = useRef(onClose);
  useEffect(() => {
    handler.current = onClose;
  });
  useEffect(() => {
    if (!active || !mobile) return;
    const id = Math.random().toString(36).slice(2);
    window.history.pushState({ ...window.history.state, overlay: id }, "");
    let popped = false;
    const onPop = () => {
      popped = true;
      handler.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped && window.history.state?.overlay === id) window.history.back();
    };
  }, [active, mobile]);
}
