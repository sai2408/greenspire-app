// Not wired to any redirect logic yet — true "app installed? open it : send to
// store" behavior requires a hosted web fallback page (for the detection) plus
// real store listings (as the redirect target), neither of which exist yet.
// Fill these in once the app is actually published, so wiring up that flow
// later is just a config change here rather than a re-architecture.
export const STORE_URLS = {
  ios: '', // e.g. https://apps.apple.com/app/idXXXXXXXXXX
  android: '', // e.g. https://play.google.com/store/apps/details?id=com.emergent.healthyspire.l1ggr9
};
