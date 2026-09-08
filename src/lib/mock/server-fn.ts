/* -------------------------------------------------------------------------- */
/*  Demo function runtime                                                      */
/*                                                                            */
/*  Drop-in replacements for the server-function helpers. Everything runs      */
/*  locally against the demo dataset — no network, no database.                */
/* -------------------------------------------------------------------------- */

import { demoClient, getDemoUserId } from "./client";

type AnyFn = (...args: any[]) => any;

export type DemoContext = {
  supabase: typeof demoClient;
  userId: string;
  claims: Record<string, unknown>;
};

export const requireSupabaseAuth = { __requiresAuth: true } as const;

class DemoFnBuilder<TData = void> {
  private requiresAuth = false;
  private validator: AnyFn | null = null;

  middleware(list: unknown[]) {
    if (list.some((m) => m === requireSupabaseAuth)) this.requiresAuth = true;
    return this;
  }

  inputValidator<T>(fn: (input: any) => T): DemoFnBuilder<T> {
    this.validator = fn;
    return this as unknown as DemoFnBuilder<T>;
  }

  handler<TResult>(fn: (args: { data: TData; context: DemoContext }) => TResult | Promise<TResult>) {
    const requiresAuth = this.requiresAuth;
    const validator = this.validator;
    return async (opts?: { data?: TData }): Promise<TResult> => {
      const userId = getDemoUserId();
      if (requiresAuth && !userId) throw new Error("Please sign in to continue.");
      const data = (validator ? validator(opts?.data) : opts?.data) as TData;
      return fn({
        data,
        context: { supabase: demoClient, userId: userId ?? "", claims: {} },
      });
    };
  }
}

export function createServerFn(_options?: { method?: string }) {
  return new DemoFnBuilder<any>();
}

/** Matches the shape the routes already import; the function runs in-browser. */
export function useServerFn<T extends AnyFn>(fn: T): T {
  return fn;
}
