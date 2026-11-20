// Shape of the app's test hooks (src/testHooks.ts), so e2e code can call them typed.
import type { DriftnoteTestHooks } from "../../src/testHooksApi";

declare global {
  interface Window {
    __driftnote?: DriftnoteTestHooks;
  }
}
