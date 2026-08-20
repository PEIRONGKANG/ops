import { describe, expect, it } from 'vitest';

import { createSessionStore } from './sessionStore';

describe('sessionStore', () => {
  it('does not persist the access token in browser storage', () => {
    const session = createSessionStore();

    session.setAccessToken('access-token');

    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(session.getSnapshot().accessToken).toBe('access-token');
  });
});
