import * as Effect from 'effect/Effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient';
import * as HttpClient from 'effect/unstable/http/HttpClient';
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest';
import * as HttpApiClient from 'effect/unstable/httpapi/HttpApiClient';

import { authClient } from '@/client/auth-client';
import { api } from '@sufra-web/worker/contract/api.ts';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5173';

const runtime = ManagedRuntime.make(FetchHttpClient.layer);

export const getClient = () =>
  runtime.runPromise(
    HttpApiClient.make(api, {
      baseUrl: API_URL,
      transformClient: HttpClient.mapRequest(
        HttpClientRequest.setHeader('cookie', authClient.getCookie())
      ),
    })
  );

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  runtime.runPromise(effect as Effect.Effect<A, E, never>);
