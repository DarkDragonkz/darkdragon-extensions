/* eslint-disable @typescript-eslint/no-explicit-any */
export class URLBuilder {
    parameters: Record<string, any | any[]> = {}
    pathComponents: string[] = []
    baseUrl: string
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/(^\/)?(?=.*)(\/$)?/gim, '')
    }

    addPathComponent(component: string): URLBuilder {
        this.pathComponents.push(component.replace(/(^\/)?(?=.*)(\/$)?/gim, ''))
        return this
    }

    addQueryParameter(key: string, value: any | any[]): URLBuilder {
        this.parameters[key] = value
        return this
    }

    buildUrl({addTrailingSlash, includeUndefinedParameters} = {addTrailingSlash: false, includeUndefinedParameters: false}): string {
        let finalUrl = this.baseUrl + '/'

        finalUrl += this.pathComponents.join('/')
        finalUrl += addTrailingSlash ? '/' : ''
        const params: string[] = []

        for (const [key, value] of Object.entries(this.parameters)) {
            if (value == null && !includeUndefinedParameters) continue

            if (Array.isArray(value)) {
                const items = value
                    .map((item) => item == null ? (includeUndefinedParameters ? '' : undefined) : String(item))
                    .filter((item): item is string => item !== undefined)
                if (items.length === 0 && !includeUndefinedParameters) continue
                const encoded = items.map((item) => encodeURIComponent(item))
                params.push(`${key}=${encoded.join(',')}`)
                continue
            }

            if (typeof value === 'object') {
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (subValue == null && !includeUndefinedParameters) continue
                    params.push(`${key}[${subKey}]=${encodeURIComponent(String(subValue ?? ''))}`)
                }
                continue
            }

            params.push(`${key}=${encodeURIComponent(String(value))}`)
        }

        finalUrl += params.length > 0 ? `?${params.join('&')}` : ''

        return finalUrl
    }
}
