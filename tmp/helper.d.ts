export declare class URLBuilder {
    parameters: Record<string, any | any[]>;
    pathComponents: string[];
    baseUrl: string;
    constructor(baseUrl: string);
    addPathComponent(component: string): URLBuilder;
    addQueryParameter(key: string, value: any | any[]): URLBuilder;
    buildUrl({ addTrailingSlash, includeUndefinedParameters }?: {
        addTrailingSlash: boolean;
        includeUndefinedParameters: boolean;
    }): string;
}
