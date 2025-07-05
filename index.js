const { bin, install, Tunnel } = require("cloudflared");
const { getServers, setServers, lookup } = require("dns");
const { existsSync } = require("fs");
const { EventEmitter } = require("events");
const { Timer } = require("@gibme/timer");
const fetch = require("@gibme/fetch").default;

class Cloudflared extends EventEmitter {
    constructor(local_url, check_interval = 2000) {
        super();
        this.local_url = local_url;
        this.system_dns_servers = getServers();
        this._connections = new Set();
        this._dns_ready = false;
        this._https_ready = false;

        setServers([
            ...this.system_dns_servers,
            "1.1.1.1",
            "8.8.8.8",
            "9.9.9.9"
        ]);

        this.dns_servers = getServers();

        this.dns_timer = new Timer(check_interval, true);
        this.https_timer = new Timer(check_interval, true);
        this.ready_timer = new Timer(check_interval, true);

        this.dns_timer.on("tick", async () => {
            if (this.hostname) {
                if (await this.dns_exists()) {
                    this._dns_ready = true;
                    this.emit("subservice", {
                        timestamp: new Date(),
                        url: this.url,
                        hostname: this.hostname,
                        connections: this.connections,
                        type: "dns"
                    });
                    this.dns_timer.destroy();
                } else {
                    this.emit("progress", {
                        timestamp: new Date(),
                        url: this.url,
                        hostname: this.hostname,
                        connections: this.connections,
                        type: "dns",
                        status: "not_ready"
                    });
                }
            }
        });

        this.https_timer.on("tick", async () => {
            if (this.hostname) {
                if (await this.https_exists()) {
                    this._https_ready = true;
                    this.emit("subservice", {
                        timestamp: new Date(),
                        url: this.url,
                        hostname: this.hostname,
                        connections: this.connections,
                        type: "https"
                    });
                    this.https_timer.destroy();
                } else {
                    this.emit("progress", {
                        timestamp: new Date(),
                        url: this.url,
                        hostname: this.hostname,
                        connections: this.connections,
                        type: "https",
                        status: "not_ready"
                    });
                }
            }
        });

        this.ready_timer.on("tick", async () => {
            if (this.ready) {
                this.emit("ready", {
                    timestamp: new Date(),
                    url: this.url,
                    hostname: this.hostname,
                    connections: this.connections
                });
                this.ready_timer.destroy();
            }
        });
    }

    get url() {
        return this._url;
    }

    get hostname() {
        return this._hostname;
    }

    get connections() {
        return this._connections;
    }

    get dns_ready() {
        return this._dns_ready;
    }

    get https_ready() {
        return this._https_ready;
    }

    get ready() {
        return !!this._url;
        //return this.dns_ready && this.https_ready;
    }

    get tunnel() {
        return this._tunnel;
    }

    static async install_cloudflared() {
        try {
            if (!existsSync(bin)) {
                await install(bin);
            }
            return bin;
        } catch (_) {
            return null;
        }
    }

    on(event, listener) {
        return super.on(event, listener);
    }

    once(event, listener) {
        return super.once(event, listener);
    }

    off(event, listener) {
        return super.off(event, listener);
    }

    async start(timeout = 30000) {
        if (this.tunnel) return true;

        if (!(await Cloudflared.install_cloudflared())) return false;

        this._timeout = setTimeout(() => {
            if (!this.ready) {
                this.stop();
                this.emit("timeout", new Error("Tunnel could not be started within the given timeout."));
            }
        }, timeout);

        try {
            this._tunnel = Tunnel.quick(this.local_url);
            this._tunnel.once("url", (url) => {
                this._url = url;
                this._hostname = new URL(url).hostname;
            });

            this._tunnel.once("connected", (connection) => {
                this._connections.clear();
                this._connections.add(connection);
            });

            this.emit("started");
            return true;
        } catch (_) {
            this.cleanup();
            return false;
        }
    }

    async stop() {
        this.cleanup();
        if (!this.tunnel) return true;

        try {
            this.tunnel.process.kill("SIGINT");
        } catch (_) {}

        try {
            this.tunnel.process.kill();
        } catch (_) {}

        const result = this.tunnel.stop();
        delete this._tunnel;
        this.emit("stopped");
        return result;
    }

    cleanup() {
        this.dns_timer.destroy();
        this.https_timer.destroy();
        this.ready_timer.destroy();
        delete this._hostname;
        this._connections.clear();
        delete this._url;
    }

    async https_exists() {
        try {
            if (this.url) {
                await fetch.get(this.url);
                return true;
            } else {
                return false;
            }
        } catch (_) {
            return false;
        }
    }

    async dns_exists() {
        return new Promise((resolve) => {
            if (this.hostname) {
                lookup(this.hostname, (error) => {
                    resolve(!error);
                });
            } else {
                resolve(false);
            }
        });
    }
}

module.exports = Cloudflared;
    
