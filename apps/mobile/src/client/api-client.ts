import * as Effect from 'effect/Effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient';
import * as HttpClient from 'effect/unstable/http/HttpClient';
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest';
import * as HttpApiClient from 'effect/unstable/httpapi/HttpApiClient';

import { getAuthClient } from '@/client/auth-client';
import { getServerUrl } from '@/client/server';
import { api } from '@sufra-web/worker/contract/api.ts';
import { publicApi } from '@sufra-web/worker/contract/public-api.ts';

const runtime = ManagedRuntime.make(FetchHttpClient.layer);

/**
 * The typed authed client. Built per call against the user-state server origin (ADR 0018) with the
 * SecureStore session cookie replayed — callers sit past both the Connect and the sign-in gates.
 */
export const getClient = async () => {
  const baseUrl = getServerUrl();
  if (!baseUrl) {
    throw new Error('getClient() before the Connect tier set a server origin (ADR 0018)');
  }
  return runtime.runPromise(
    HttpApiClient.make(api, {
      baseUrl,
      transformClient: HttpClient.mapRequest(
        HttpClientRequest.setHeader('cookie', getAuthClient().getCookie())
      ),
    })
  );
};

/**
 * The typed PUBLIC (unauth) client, against an EXPLICIT candidate origin — the Connect screen probes a
 * server the user just typed, BEFORE anything is stored, so unlike `getClient` this can't read the
 * stored origin. The setup-status endpoint doubles as "is this actually a Sufra server?" (ADR 0018).
 */
export const getPublicClient = (baseUrl: string) =>
  runtime.runPromise(HttpApiClient.make(publicApi, { baseUrl }));

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  runtime.runPromise(effect as Effect.Effect<A, E, never>);
