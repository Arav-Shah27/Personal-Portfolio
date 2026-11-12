/* The QR code under the Party Tree: my LinkedIn, with the quiet border a
   scanner needs. Kept apart from the 3D so the flat code works without it. */
import qrcode from "qrcode-generator";

export const LINKEDIN = "https://www.linkedin.com/in/arav-shah-6a986b35b/";
const QUIET = 4;   /* the blank border a scanner needs around the code */

export function qrMatrix(text = LINKEDIN) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), size = n + QUIET * 2;
  const dark = (r, c) => r >= QUIET && c >= QUIET && r < n + QUIET && c < n + QUIET && q.isDark(r - QUIET, c - QUIET);
  return { size, dark };
}

