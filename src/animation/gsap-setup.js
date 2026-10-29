import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Ignore the iOS address-bar resize so pinned and scrubbed sections don't jump.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };
