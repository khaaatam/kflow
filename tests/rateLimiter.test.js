const RateLimiter = require('../lib/rateLimiter');

describe('RateLimiter', () => {
    test('allows requests within limit', () => {
        const limiter = new RateLimiter(60000, 3);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
    });

    test('blocks requests over limit', () => {
        const limiter = new RateLimiter(60000, 2);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(false);
    });

    test('tracks users independently', () => {
        const limiter = new RateLimiter(60000, 1);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user2')).toBe(true);
        expect(limiter.check('user1')).toBe(false);
        expect(limiter.check('user2')).toBe(false);
    });

    test('reset clears user data', () => {
        const limiter = new RateLimiter(60000, 1);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(false);
        limiter.reset('user1');
        expect(limiter.check('user1')).toBe(true);
    });
});
