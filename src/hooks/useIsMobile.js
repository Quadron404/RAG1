import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const noHover = window.matchMedia('(hover: none)').matches;
      const narrow = window.innerWidth <= 900;
      setMobile((coarse && noHover) || narrow);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return mobile;
}
