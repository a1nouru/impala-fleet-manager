// Kill switch for slip OCR verification. Set NEXT_PUBLIC_SLIP_VERIFICATION=off
// on a deployment (Railway service variable, then redeploy) to disable it;
// remove the variable and redeploy to turn it back on. No code change needed.
export const SLIP_VERIFICATION_ENABLED = process.env.NEXT_PUBLIC_SLIP_VERIFICATION !== "off";
