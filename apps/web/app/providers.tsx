'use client';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@lexbridge/shared';
import { ReactNode, useState } from 'react';
import { apiOrigin } from '../lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new ApolloClient({
        link: new HttpLink({
          uri: `${apiOrigin()}/graphql`,
          credentials: 'include',
          headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE },
        }),
        cache: new InMemoryCache(),
      }),
  );
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
