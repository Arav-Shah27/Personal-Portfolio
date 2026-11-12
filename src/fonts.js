/* fonts are self-hosted from npm (fontsource), so the first paint never waits
   on a third-party server. unicode-range means a visitor only downloads the
   latin files. Three faces:
     Pixelify Sans   clean square pixel letters for the name and titles
     Geist           a plain, clean sans for everything you read
     Geist Mono      small labels, dates, tags and the nav */
import "@fontsource-variable/pixelify-sans/wght.css";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist/wght-italic.css";
import "@fontsource-variable/geist-mono/wght.css";
