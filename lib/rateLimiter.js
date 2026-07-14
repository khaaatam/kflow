class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 5) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.clients = new Map();
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, data] of this.clients) {
            if (now - data.windowStart > this.windowMs) {
                this.clients.delete(key);
            }
        }
    }

    check(key) {
        this._cleanup();
        const now = Date.now();
        const clientData = this.clients.get(key);

        if (!clientData || now - clientData.windowStart > this.windowMs) {
            this.clients.set(key, { windowStart: now, count: 1 });
            return true;
        }

        if (clientData.count >= this.maxRequests) {
            return false;
        }

        clientData.count++;
        return true;
    }

    reset(key) {
        this.clients.delete(key);
    }
}

module.exports = RateLimiter;
