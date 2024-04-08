export interface Logger {
    prefix?: string;
    info(message: string, ...parameters: any[]): void;
    warn(message: string, ...parameters: any[]): void;
    error(message: string, ...parameters: any[]): void;
    debug(message: string, ...parameters: any[]): void;
}

export class ConsoleLogger implements Logger {
    public readonly prefix?: string;
    public readonly logLevel: number;

    constructor(logLevel: number = 0, prefix?: string) {
        this.prefix = prefix;
        this.logLevel = logLevel;
    }

    log(message: string, ...parameters: any[]): void {
        var fullMessage = (this.prefix) ? message : this.prefix + " " + message;
        console.log(fullMessage, ...parameters)
    }

    debug(message: string, ...parameters: any[]): void {
        if (this.logLevel <= 1) this.log(message, ...parameters);
    }

    info(message: string, ...parameters: any[]): void {
        if (this.logLevel <= 2) this.log(message, ...parameters);
    }

    warn(message: string, ...parameters: any[]): void {
        if (this.logLevel <= 3) this.log(message, ...parameters);
    }

    error(message: string, ...parameters: any[]): void {
        if (this.logLevel <= 4) this.log(message, ...parameters);
    }
}
