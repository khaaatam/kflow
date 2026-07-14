const logger = require('../lib/logger');

describe('Logger', () => {
    test('exports debug, info, warn, error functions', () => {
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
    });

    test('does not throw when logging', () => {
        expect(() => logger.debug('test')).not.toThrow();
        expect(() => logger.info('test')).not.toThrow();
        expect(() => logger.warn('test')).not.toThrow();
        expect(() => logger.error('test')).not.toThrow();
    });
});
