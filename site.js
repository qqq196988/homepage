const links = [...document.querySelectorAll(".main-nav a")];
const sections = links
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const activeId = `#${entry.target.id}`;
      links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === activeId);
      });
    });
  },
  { rootMargin: "-40% 0px -45% 0px", threshold: 0.01 }
);

sections.forEach((section) => observer.observe(section));
