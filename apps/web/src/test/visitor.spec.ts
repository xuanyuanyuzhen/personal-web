import { getVisitorId, readVisitorId } from '../utils/visitor';

describe('visitorId', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('generates and persists a visitor id', () => {
    const visitorId = getVisitorId();

    expect(visitorId).toMatch(/^visitor_/);
    expect(readVisitorId()).toBe(visitorId);
    expect(getVisitorId()).toBe(visitorId);
  });
});
