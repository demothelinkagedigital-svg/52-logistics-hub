import { createMiddleware } from "@tanstack/react-start";

type CsrfSecFetchSite = "same-origin" | "same-site" | "cross-site" | "none";
type CsrfContext = {
  request: Request;
  pathname: string;
  handlerType: "serverFn" | "router";
};
type Matcher<T> = T | T[] | ((value: T | (string & {}), context: CsrfContext) => boolean | Promise<boolean>);
type CsrfOptions = {
  filter?: (context: CsrfContext) => boolean | Promise<boolean>;
  origin?: Matcher<string>;
  secFetchSite?: Matcher<CsrfSecFetchSite>;
  referer?: boolean | ((referer: string, context: CsrfContext) => boolean | Promise<boolean>);
  allowRequestsWithoutOriginCheck?: boolean;
  failureResponse?: Response | ((context: CsrfContext) => Response | Promise<Response>);
};

const csrfSymbol = Symbol.for("tanstack-start:csrf-middleware");

export function createCsrfMiddleware(options: CsrfOptions = {}) {
  const middleware = createMiddleware().server(async (context) => {
    const csrfContext: CsrfContext = {
      request: context.request,
      pathname: context.pathname,
      handlerType: context.handlerType,
    };

    if (options.filter && !(await options.filter(csrfContext))) return context.next();

    const result = await validateRequest(options, csrfContext);
    if (result === true || (result === undefined && options.allowRequestsWithoutOriginCheck)) {
      return context.next();
    }

    if (typeof options.failureResponse === "function") {
      return options.failureResponse(csrfContext);
    }
    return options.failureResponse?.clone() ?? new Response("Forbidden", { status: 403 });
  });

  Object.defineProperty(middleware, csrfSymbol, { value: true });
  return middleware;
}

async function validateRequest(options: CsrfOptions, context: CsrfContext): Promise<boolean | undefined> {
  const fetchSite = context.request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null) return matchValue(options.secFetchSite ?? "same-origin", fetchSite, context);

  const origin = context.request.headers.get("Origin");
  if (origin !== null) {
    return options.origin
      ? matchValue(options.origin, origin, context)
      : origin === new URL(context.request.url).origin;
  }

  const referer = context.request.headers.get("Referer");
  if (referer === null || options.referer === false) return undefined;
  if (typeof options.referer === "function") return options.referer(referer, context);

  if (options.origin) {
    const refererOrigin = getOriginFromUrl(referer);
    return refererOrigin !== undefined && matchValue(options.origin, refererOrigin, context);
  }
  return isRefererSameOrigin(referer, new URL(context.request.url).origin);
}

async function matchValue<T extends string>(
  matcher: Matcher<T>,
  value: string,
  context: CsrfContext,
): Promise<boolean> {
  if (typeof matcher === "function") return matcher(value, context);
  if (Array.isArray(matcher)) return matcher.includes(value as T);
  return value === matcher;
}

function getOriginFromUrl(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function isRefererSameOrigin(referer: string, requestOrigin: string): boolean {
  if (referer === requestOrigin) return true;
  if (!referer.startsWith(requestOrigin)) return false;
  if (referer.length === requestOrigin.length) return true;
  const nextCharacter = referer.charCodeAt(requestOrigin.length);
  return nextCharacter === 47 || nextCharacter === 63 || nextCharacter === 35;
}
